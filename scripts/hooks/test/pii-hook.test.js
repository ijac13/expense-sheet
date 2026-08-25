'use strict';

// Acceptance tests for entity 056. Every phone number and email here is a
// constructed stand-in of the right shape, never a real value.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scan = require('../pii-scan.js');
const H = require('./helpers.js');

const BLOCK_PHONES = ['0912345678', '0987654321', '0912-345-678', '0912 345 678'];
const BLOCK_INTL = ['+886912345678', '+886-912-345-678', '886912345678'];
const BLOCK_EMAILS = ['real.person@gmail.com', 'someone.real@company.com.tw', 'a.b+tag@outlook.com'];
const ALLOW_EMAILS = [
  'ijac@example.com',
  'user-one@example.com',
  'user-two@example.com',
  'stranger@example.com',
  'test@example.com',
  'firebase-adminsdk-xxx@my-project.iam.gserviceaccount.com',
  'TODO_SERVICE_ACCOUNT@TODO_PROJECT.com',
  'your-email@gmail.com',
];

test.after(() => H.cleanupAll());

// ---------------------------------------------------------------- Installation

test('AC-1 the hook is tracked with mode 100755', () => {
  const res = H.git(H.REPO_ROOT, 'ls-files', '-s', 'scripts/hooks/pre-commit');
  assert.strictEqual(res.status, 0);
  assert.match(
    res.stdout.trim(),
    /^100755 /,
    'expected mode 100755 in the git index; run: git update-index --chmod=+x scripts/hooks/pre-commit'
  );
});

test('AC-2/AC-3 npm install at root, app/, or functions/ sets core.hooksPath', { timeout: 180000 }, (t) => {
  const npmCheck = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  if (npmCheck.status !== 0) return t.skip('npm unavailable');

  // The prepare lines come from the real package.json files, so editing those
  // to something that does not install the hook fails this test.
  const prepares = {
    '.': H.realPrepareScript('.'),
    app: H.realPrepareScript('app'),
    functions: H.realPrepareScript('functions'),
  };
  for (const [where, script] of Object.entries(prepares)) {
    assert.ok(script, `${where}/package.json is missing a prepare script`);
  }

  for (const target of ['.', 'app', 'functions']) {
    const dir = H.mkTemp('pii-npm-');
    H.git(dir, 'init', '-q', '-b', 'main');
    H.copyHookFiles(dir);
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: 'root-fixture', version: '1.0.0', scripts: { prepare: prepares['.'] } })
    );
    for (const sub of ['app', 'functions']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
      fs.writeFileSync(
        path.join(dir, sub, 'package.json'),
        JSON.stringify({ name: sub, version: '1.0.0', scripts: { prepare: prepares[sub] } })
      );
    }

    assert.notStrictEqual(
      H.git(dir, 'config', '--get', 'core.hooksPath').stdout.trim(),
      'scripts/hooks',
      'fixture must start unconfigured'
    );

    const installDir = target === '.' ? dir : path.join(dir, target);
    const res = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], {
      cwd: installDir,
      encoding: 'utf8',
    });
    assert.strictEqual(res.status, 0, `npm install in ${target} failed: ${res.stderr}`);
    assert.strictEqual(
      H.git(dir, 'config', '--get', 'core.hooksPath').stdout.trim(),
      'scripts/hooks',
      `npm install in ${target}/ did not set core.hooksPath`
    );
  }
});

test('AC-4 a configured checkout blocks a phone-number commit and creates no commit', () => {
  const dir = H.makeRepo();
  const before = H.headCount(dir);
  H.stage(dir, 'notes.md', 'phone 0912345678\n');
  const res = H.commit(dir, 'add notes');
  assert.notStrictEqual(res.status, 0, 'commit should have been rejected');
  assert.strictEqual(H.headCount(dir), before, 'no commit should have been created');
});

test('AC-5 a worktree with no npm install and no node_modules still blocks', () => {
  const dir = H.makeRepo();
  const wt = path.join(H.mkTemp('pii-wt-parent-'), 'wt');
  const added = H.git(dir, 'worktree', 'add', '-q', '-b', 'feature', wt);
  assert.strictEqual(added.status, 0, `worktree add failed: ${added.stderr}`);

  assert.ok(!fs.existsSync(path.join(wt, 'node_modules')), 'worktree must have no node_modules');
  assert.ok(fs.existsSync(path.join(wt, 'scripts/hooks/pre-commit')), 'hook must be checked out');

  const before = H.headCount(wt);
  H.stage(wt, 'leak.md', 'phone 0912345678\n');
  const res = H.commit(wt, 'leak');
  assert.notStrictEqual(res.status, 0, 'zero-setup worktree failed open — this is the Husky failure');
  assert.strictEqual(H.headCount(wt), before);
});

test('AC-6 the hook fires when git commit runs from app/ and functions/ subdirectories', () => {
  for (const sub of ['app', 'functions']) {
    const dir = H.makeRepo();
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
    H.stage(dir, `${sub}/leak.md`, 'phone 0912345678\n');
    const res = H.commit(dir, 'leak', { cwd: path.join(dir, sub) });
    assert.notStrictEqual(res.status, 0, `commit from ${sub}/ was not blocked`);
  }
});

test('AC-7 install-hooks.js is idempotent and exits 0 outside a git checkout', () => {
  const dir = H.mkTemp('pii-idem-');
  H.git(dir, 'init', '-q', '-b', 'main');
  H.copyHookFiles(dir);
  const installer = path.join(dir, 'scripts/install-hooks.js');

  const first = spawnSync('node', [installer], { encoding: 'utf8' });
  assert.strictEqual(first.status, 0);
  assert.strictEqual(H.git(dir, 'config', '--get', 'core.hooksPath').stdout.trim(), 'scripts/hooks');

  for (let i = 0; i < 3; i++) {
    const again = spawnSync('node', [installer], { encoding: 'utf8' });
    assert.strictEqual(again.status, 0, 'repeat run should exit 0');
    assert.strictEqual(
      H.git(dir, 'config', '--get', 'core.hooksPath').stdout.trim(),
      'scripts/hooks',
      'repeat run changed the value'
    );
  }
  assert.strictEqual(
    H.git(dir, 'config', '--get-all', 'core.hooksPath').stdout.trim().split('\n').length,
    1,
    'repeat runs must not append duplicate config entries'
  );

  const bare = H.mkTemp('pii-nogit-');
  H.copyHookFiles(bare);
  const outside = spawnSync('node', [path.join(bare, 'scripts/install-hooks.js')], {
    cwd: bare,
    encoding: 'utf8',
  });
  assert.strictEqual(outside.status, 0, 'must exit 0 outside a git checkout');
});

// ------------------------------------------------------------------ Detection

test('AC-8 local phone shapes are blocked', () => {
  const dir = H.makeRepo();
  for (const value of BLOCK_PHONES) {
    H.stage(dir, 'f.md', `contact ${value}\n`);
    const res = H.runHook(dir);
    assert.strictEqual(res.status, 1, `${value} was not blocked`);
    assert.match(res.stderr, /phone-local/);
  }
});

test('AC-9 international phone shapes are blocked', () => {
  const dir = H.makeRepo();
  for (const value of BLOCK_INTL) {
    H.stage(dir, 'f.md', `contact ${value}\n`);
    const res = H.runHook(dir);
    assert.strictEqual(res.status, 1, `${value} was not blocked`);
    assert.match(res.stderr, /phone-intl/);
  }
});

test('AC-10 real-looking emails are blocked', () => {
  const dir = H.makeRepo();
  for (const value of BLOCK_EMAILS) {
    H.stage(dir, 'f.md', `mail ${value}\n`);
    const res = H.runHook(dir);
    assert.strictEqual(res.status, 1, `${value} was not blocked`);
    assert.match(res.stderr, /email/);
  }
});

test('AC-11 allowlisted addresses are never blocked', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'safe.md', ALLOW_EMAILS.map((e) => `contact ${e}`).join('\n') + '\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 0, `allowlisted addresses were blocked:\n${res.stderr}`);
  assert.strictEqual(res.stderr, '');
});

test('AC-12 the reserved test block is allowed, one digit outside it is blocked', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'fixtures.md', 'a 0900000001\nb 0900000002\n');
  assert.strictEqual(H.runHook(dir).status, 0, 'reserved-range fixtures must not be blocked');

  H.stage(dir, 'fixtures.md', 'c 0900010001\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 1, '0900010001 is outside the reserved block and must be blocked');
  assert.match(res.stderr, /0900010001/);
});

test('D2 the digit lookarounds keep phone shapes from matching inside longer digit runs', () => {
  // A phone shape embedded in a longer digit run is not a phone number.
  // These fixtures discriminate: drop either lookaround and they start matching.
  for (const embedded of ['20240912345678', '1230912345678', '09123456789', 'v1230912345678x']) {
    assert.deepStrictEqual(
      scan.scanLine(embedded),
      [],
      `${embedded} embeds a phone shape in a longer digit run and must not match`
    );
  }
  // ...but the same shape standing alone still matches, so the guard is not just off.
  assert.strictEqual(scan.scanLine('call 0912345678 now').length, 1);
  assert.strictEqual(scan.scanLine('id=0912345678').length, 1);
});

test('AC-13 the tracked tree has no PII under app/, functions/, docs/, or the root', () => {
  const files = H.git(H.REPO_ROOT, 'ls-files').stdout.split('\n').filter(Boolean);
  const findings = [];
  let scanned = 0;
  for (const f of files) {
    if (f === 'package-lock.json' || f.endsWith('/package-lock.json')) continue;
    if (f.startsWith('.next/') || f.startsWith('node_modules/')) continue;
    const inScope = f.startsWith('app/') || f.startsWith('functions/') || f.startsWith('docs/') || !f.includes('/');
    if (!inScope) continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(H.REPO_ROOT, f));
    } catch {
      continue;
    }
    if (buf.subarray(0, 8000).includes(0)) continue;
    scanned++;
    findings.push(...scan.scanText(f, buf.toString('utf8')));
  }
  assert.ok(scanned > 50, `expected a substantial scan, only scanned ${scanned} files`);
  assert.deepStrictEqual(
    findings.map((f) => `${f.file}:${f.line} ${f.kind}`),
    [],
    'live tracked tree is not clean'
  );
});

test('AC-14 a blocked commit reports path, line, kind and value on stderr and exits 1', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'deep/notes.md', 'line one\nline two\ncontact 0912345678\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 1);
  assert.match(res.stderr, /deep\/notes\.md:3/, 'expected file path and correct line number');
  assert.match(res.stderr, /phone-local/, 'expected match kind');
  assert.match(res.stderr, /0912345678/, 'expected matched value');
});

test('AC-15 a clean commit exits 0 and writes nothing to stderr', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'clean.md', 'nothing to see here\ncontact test@example.com\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 0);
  assert.strictEqual(res.stderr, '', 'stderr must be empty on a clean run');
});

// ------------------------------------------------------------------- Override

test('AC-16 --no-verify succeeds on content the hook blocks', () => {
  const dir = H.makeRepo();
  const before = H.headCount(dir);
  H.stage(dir, 'notes.md', 'phone 0912345678\n');
  assert.notStrictEqual(H.commit(dir, 'blocked').status, 0);
  const res = H.commit(dir, 'override', { noVerify: true });
  assert.strictEqual(res.status, 0, `--no-verify should succeed: ${res.stderr}`);
  assert.strictEqual(H.headCount(dir), before + 1);
});

test('AC-17 an inline suppression comment is not honored', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'notes.js', 'const phone = "0912345678"; // pii-allow\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 1, 'a "// pii-allow" comment must not bypass the scanner');
  assert.match(res.stderr, /0912345678/);
});

// ----------------------------------------------------------------- Edge cases

test('AC-18 a deletion-only change exits 0', () => {
  const dir = H.makeRepo();
  H.stage(dir, 'legacy.md', 'keep me\nphone 0912345678\nmail real.person@gmail.com\n');
  H.commit(dir, 'seed legacy', { noVerify: true });

  H.stage(dir, 'legacy.md', 'keep me\n');
  const diff = H.git(dir, 'diff', '--cached').stdout;
  assert.match(diff, /^-phone /m, 'the staged diff must actually remove the PII line');
  assert.strictEqual(H.runHook(dir).status, 0, 'removing PII must never be blocked');
});

test('AC-19 a binary file with PII bytes exits 0 and the skip count is reported', () => {
  const dir = H.makeRepo();
  const payload = Buffer.concat([
    Buffer.from([0x00, 0x01, 0x02, 0x00]),
    Buffer.from('0912345678 real.person@gmail.com'),
    Buffer.alloc(1024, 0),
  ]);
  fs.writeFileSync(path.join(dir, 'blob.bin'), payload);
  H.git(dir, 'add', '--', 'blob.bin');

  assert.match(H.git(dir, 'diff', '--cached', '--numstat').stdout, /^-\t-\t/m, 'git must see it as binary');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 0, 'binary content is an accepted, documented gap');
  assert.strictEqual(res.stderr, '');
  assert.match(res.stdout, /skipped 1 binary file/, 'the skip must be reported, not silent');
});

test('AC-20 a 60,000-line added diff scans in under 2 seconds', () => {
  const dir = H.makeRepo();
  const lines = [];
  for (let i = 0; i < 60000; i++) lines.push(`row ${i} value sub-17000000000${i % 100} ok`);
  H.stage(dir, 'big.txt', lines.join('\n') + '\n');

  const started = Date.now();
  const res = H.runHook(dir);
  const elapsed = Date.now() - started;
  assert.strictEqual(res.status, 0, `large clean diff should pass: ${res.stderr}`);
  assert.ok(elapsed < 2000, `hook took ${elapsed}ms, budget is 2000ms`);
});

test('AC-20b a leak on the last line of a huge diff is still caught', () => {
  const dir = H.makeRepo();
  const lines = [];
  for (let i = 0; i < 60000; i++) lines.push(`row ${i} value ok`);
  lines.push('contact 0912345678');
  H.stage(dir, 'big.txt', lines.join('\n') + '\n');
  const res = H.runHook(dir);
  assert.strictEqual(res.status, 1, 'the scanner must not give up on large input');
  assert.match(res.stderr, /big\.txt:60001/, 'expected the leak reported at the last line');
});

test('AC-21 the scan skips exactly package-lock.json, scripts/hooks/test/, and binary', () => {
  assert.strictEqual(scan.shouldSkipPath('package-lock.json'), true);
  assert.strictEqual(scan.shouldSkipPath('app/package-lock.json'), true);
  assert.strictEqual(scan.shouldSkipPath('scripts/hooks/test/pii-hook.test.js'), true);
  assert.strictEqual(scan.shouldSkipPath('scripts/hooks/test/nested/deep.js'), true);

  for (const p of [
    'scripts/hooks/pre-commit',
    'scripts/hooks/pii-scan.js',
    'scripts/hooks/testing/x.js',
    'scripts/hooks/test-helper.js',
    'package-lock.json.bak',
    'docs/package-lock.md',
    'workflow/056-pii-precommit-hook.md',
    'app/lib/categories.ts',
  ]) {
    assert.strictEqual(scan.shouldSkipPath(p), false, `${p} must NOT be skipped`);
  }

  // ...and the skip is real end to end, not just a predicate.
  const dir = H.makeRepo();
  H.stage(dir, 'scripts/hooks/test/fixture.md', 'phone 0912345678\n');
  H.stage(dir, 'package-lock.json', '{"x":"0912345678"}\n');
  assert.strictEqual(H.runHook(dir).status, 0, 'skipped paths must not block');
});

// -------------------------------------------------------------- Self-reference

test('AC-22 a file under scripts/hooks/test/ with must-block literals commits cleanly', () => {
  const dir = H.makeRepo();
  const before = H.headCount(dir);
  H.stage(
    dir,
    'scripts/hooks/test/fixtures.md',
    [...BLOCK_PHONES, ...BLOCK_INTL, ...BLOCK_EMAILS].join('\n') + '\n'
  );
  const res = H.commit(dir, 'add hook fixtures');
  assert.strictEqual(res.status, 0, `the exempt path must commit with no override: ${res.stderr}`);
  assert.strictEqual(H.headCount(dir), before + 1);
});

test('AC-23 the same literals stay blocked in the hook itself and under workflow/', () => {
  for (const target of ['scripts/hooks/pre-commit', 'workflow/056-pii-precommit-hook.md']) {
    const dir = H.makeRepo();
    const existing = fs.existsSync(path.join(dir, target))
      ? fs.readFileSync(path.join(dir, target), 'utf8')
      : '';
    H.stage(dir, target, existing + '\n// contact 0912345678 real.person@gmail.com\n');
    const res = H.runHook(dir);
    assert.strictEqual(res.status, 1, `${target} must not be exempt`);
    assert.match(res.stderr, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('AC-24 the hook plus its full test suite commit together with no override', () => {
  // Built from an empty repo so the hook and its tests are genuinely in the
  // same single commit, with the hook already active when that commit runs.
  const dir = H.mkTemp('pii-selfcommit-');
  H.git(dir, 'init', '-q', '-b', 'main');
  H.git(dir, 'config', 'user.email', 'test@example.com');
  H.git(dir, 'config', 'user.name', 'Hook Test');
  H.git(dir, 'config', 'commit.gpgsign', 'false');
  H.copyHookFiles(dir);
  const testDir = path.join(dir, 'scripts/hooks/test');
  fs.mkdirSync(testDir, { recursive: true });
  for (const f of fs.readdirSync(__dirname)) {
    fs.copyFileSync(path.join(__dirname, f), path.join(testDir, f));
  }
  H.git(dir, 'config', 'core.hooksPath', 'scripts/hooks');
  H.git(dir, 'add', '-A');

  const staged = H.git(dir, 'diff', '--cached', '--name-only').stdout;
  assert.match(staged, /scripts\/hooks\/pre-commit/);
  assert.match(staged, /scripts\/hooks\/test\/pii-hook\.test\.js/);

  const res = H.commit(dir, 'add pii hook and tests');
  assert.strictEqual(res.status, 0, `build must not need --no-verify: ${res.stderr}`);
});
