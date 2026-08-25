'use strict';

// Test helpers. This directory is the one path the scanner skips (D4), so the
// must-block literals the tests need may live here safely.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK_FILES = ['scripts/hooks/pre-commit', 'scripts/hooks/pii-scan.js', 'scripts/install-hooks.js'];

const tempDirs = [];

function git(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function mkTemp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return fs.realpathSync(dir);
}

function cleanupAll() {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

function copyHookFiles(destRoot) {
  for (const rel of HOOK_FILES) {
    const dest = path.join(destRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, rel), dest);
  }
  fs.chmodSync(path.join(destRoot, 'scripts/hooks/pre-commit'), 0o755);
}

// A scratch repo with the hook installed exactly the way install-hooks.js does it.
function makeRepo({ install = true } = {}) {
  const dir = mkTemp('pii-hook-');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Hook Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  copyHookFiles(dir);
  // Goes through the real installer, so the install ACs depend on what
  // install-hooks.js actually writes rather than on a hardcoded value here.
  if (install) {
    const res = spawnSync('node', [path.join(dir, 'scripts/install-hooks.js')], { encoding: 'utf8' });
    if (res.status !== 0) throw new Error('install-hooks.js failed: ' + res.stderr);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'seed', '--no-verify');
  return dir;
}

function write(dir, rel, content) {
  const dest = path.join(dir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  return dest;
}

function stage(dir, rel, content) {
  write(dir, rel, content);
  git(dir, 'add', '--', rel);
}

// Runs the hook the way git does: cwd is the working-tree top level.
function runHook(dir) {
  return spawnSync(path.join(dir, 'scripts/hooks/pre-commit'), [], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
}

function commit(dir, message, { noVerify = false, cwd = dir } = {}) {
  const args = ['commit', '-q', '-m', message];
  if (noVerify) args.push('--no-verify');
  return git(cwd, ...args);
}

function headCount(dir) {
  const res = git(dir, 'rev-list', '--count', 'HEAD');
  return res.status === 0 ? parseInt(res.stdout.trim(), 10) : -1;
}

function realPrepareScript(pkgRelDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, pkgRelDir, 'package.json'), 'utf8'));
  return pkg.scripts && pkg.scripts.prepare;
}

module.exports = {
  REPO_ROOT,
  HOOK_FILES,
  git,
  mkTemp,
  cleanupAll,
  copyHookFiles,
  makeRepo,
  write,
  stage,
  runHook,
  commit,
  headCount,
  realPrepareScript,
};
