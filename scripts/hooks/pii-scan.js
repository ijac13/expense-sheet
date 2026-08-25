'use strict';

// Shape-based PII detection for the pre-commit hook. No dependencies: the hook
// must run in a worktree that has never had `npm install` run in it.

const { spawnSync } = require('node:child_process');

// The digit lookarounds are load-bearing. Without them these match inside
// longer digit runs such as `sub-1700000000021` row IDs and package-lock
// integrity hashes.
const PATTERNS = [
  { kind: 'phone-local', re: /(?<![0-9])09\d{2}[-\s]?\d{3}[-\s]?\d{3}(?![0-9])/g },
  { kind: 'phone-intl', re: /(?<![0-9])\+?886[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}(?![0-9])/g },
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
];

const SKIP_PATH_PREFIX = 'scripts/hooks/test/';
const SKIP_BASENAME = 'package-lock.json';

const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'localhost']);

function isAllowedPhone(value) {
  let digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('886')) digits = '0' + digits.slice(3);
  // Reserved test block 0900000000-0900009999, used by this repo's synthetic fixtures.
  return /^090000\d{4}$/.test(digits);
}

function isAllowedEmail(value) {
  const at = value.lastIndexOf('@');
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const lowerDomain = domain.toLowerCase();

  if (RESERVED_DOMAINS.has(lowerDomain)) return true;
  if (/\.(example|test|invalid|localhost)$/.test(lowerDomain)) return true;
  if (lowerDomain.endsWith('.gserviceaccount.com')) return true;
  if (local.startsWith('TODO_') || domain.startsWith('TODO_')) return true;
  if (/your[-_]/i.test(local) || /your[-_]/i.test(domain)) return true;
  return false;
}

function isAllowed(kind, value) {
  return kind === 'email' ? isAllowedEmail(value) : isAllowedPhone(value);
}

function shouldSkipPath(filePath) {
  if (!filePath) return true;
  if (filePath === SKIP_BASENAME || filePath.endsWith('/' + SKIP_BASENAME)) return true;
  if (filePath.startsWith(SKIP_PATH_PREFIX)) return true;
  return false;
}

function scanLine(text) {
  const hits = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!isAllowed(kind, m[0])) hits.push({ kind, value: m[0] });
    }
  }
  return hits;
}

function scanText(filePath, text) {
  const findings = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const hit of scanLine(lines[i])) {
      findings.push({ file: filePath, line: i + 1, kind: hit.kind, value: hit.value });
    }
  }
  return findings;
}

function git(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
}

function parseDiffGitPath(line) {
  const m = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
  return m ? m[2] : null;
}

// Scans only added (`+`) lines of the staged diff, so deleting or redacting PII
// is never blocked and pre-existing PII does not block unrelated edits.
function scanStagedDiff(cwd) {
  const res = git(
    ['-c', 'core.quotePath=false', 'diff', '--cached', '-U0', '--no-color', '--no-ext-diff'],
    cwd
  );
  if (res.status !== 0) {
    return { findings: [], binarySkipped: 0, error: (res.stderr || '').trim() };
  }

  const findings = [];
  let binarySkipped = 0;
  let pendingPath = null;
  let file = null;
  let skip = true;
  let lineNo = 0;

  for (const raw of res.stdout.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      pendingPath = parseDiffGitPath(raw);
      file = null;
      skip = true;
      continue;
    }
    if (raw.startsWith('Binary files ') || raw.startsWith('GIT binary patch')) {
      const isDeletion = raw.endsWith('/dev/null differ');
      if (!isDeletion && !shouldSkipPath(pendingPath)) binarySkipped++;
      continue;
    }
    if (raw.startsWith('--- ')) continue;
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4);
      if (p === '/dev/null') {
        file = null;
        skip = true;
      } else {
        file = p.startsWith('b/') ? p.slice(2) : p;
        skip = shouldSkipPath(file);
      }
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /^@@ -\S+ \+(\d+)/.exec(raw);
      if (m) lineNo = parseInt(m[1], 10);
      continue;
    }
    if (!file || skip) continue;

    if (raw.startsWith('+')) {
      for (const hit of scanLine(raw.slice(1))) {
        findings.push({ file, line: lineNo, kind: hit.kind, value: hit.value });
      }
      lineNo++;
    } else if (raw.startsWith(' ')) {
      lineNo++;
    }
  }

  return { findings, binarySkipped, error: null };
}

module.exports = {
  PATTERNS,
  SKIP_PATH_PREFIX,
  SKIP_BASENAME,
  isAllowedPhone,
  isAllowedEmail,
  shouldSkipPath,
  scanLine,
  scanText,
  scanStagedDiff,
};
