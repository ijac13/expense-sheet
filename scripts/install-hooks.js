#!/usr/bin/env node
'use strict';

// Points git at the tracked hook directory. Relative, not absolute: git resolves
// a relative core.hooksPath against the top level of the *current* working tree,
// so every worktree runs its own checked-out copy with no per-worktree setup.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS_PATH = 'scripts/hooks';
const repoRoot = path.resolve(__dirname, '..');

function git(args) {
  return spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

const topLevel = git(['rev-parse', '--show-toplevel']);
if (topLevel.status !== 0) {
  // Not a git checkout (e.g. an npm tarball install). Nothing to do.
  process.exit(0);
}

const current = git(['config', '--get', 'core.hooksPath']);
if (current.status === 0 && current.stdout.trim() === HOOKS_PATH) {
  process.exit(0);
}

const set = git(['config', 'core.hooksPath', HOOKS_PATH]);
if (set.status !== 0) {
  process.stderr.write(
    'install-hooks: could not set core.hooksPath: ' + (set.stderr || '').trim() + '\n'
  );
  process.exit(0);
}

process.stdout.write(`install-hooks: core.hooksPath set to ${HOOKS_PATH}\n`);
