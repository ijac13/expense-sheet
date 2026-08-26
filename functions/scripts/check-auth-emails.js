/**
 * Preflight for the API auth deploy:
 *
 *   npm --prefix functions run check:auth-emails
 *
 * Compares the server-side `AUTHORIZED_EMAILS` set in `functions/.env` against
 * the client-side `{NEXT_PUBLIC_USER1_EMAIL, NEXT_PUBLIC_USER2_EMAIL}` set in
 * `app/.env.local`, case-insensitively. Exits 0 only when the two sets are
 * equal.
 *
 * A mismatch here is the one failure that locks both household members out of
 * the live app, so this runs before any deploy. It reports counts and a verdict
 * and never prints an address — the output is safe to paste into a log or a
 * session transcript.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    const quoted =
      (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
    if (quoted && val.length > 1) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

// Both files are gitignored, so a git worktree never has them — resolve the main
// checkout too and fall back to it, matching scripts/load-local-env.js.
function mainCheckoutRoot(fromDir) {
  try {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: fromDir, encoding: "utf8" }
    ).trim();
    return path.dirname(commonDir);
  } catch {
    return null;
  }
}

const functionsDir = path.resolve(__dirname, "..");
const candidateRoots = [path.resolve(functionsDir, "..")];
const mainRoot = mainCheckoutRoot(functionsDir);
if (mainRoot && !candidateRoots.includes(mainRoot)) candidateRoots.push(mainRoot);

function firstExisting(relativePath) {
  for (const root of candidateRoots) {
    const candidate = path.join(root, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const functionsEnvPath = firstExisting(path.join("functions", ".env"));
const appEnvPath = firstExisting(path.join("app", ".env.local"));

const missing = [];
if (!functionsEnvPath) missing.push("functions/.env");
if (!appEnvPath) missing.push("app/.env.local");
if (missing.length > 0) {
  console.error(`MISMATCH: cannot compare — missing ${missing.join(" and ")}`);
  process.exit(1);
}

const functionsEnv = parseEnvFile(functionsEnvPath);
const appEnv = parseEnvFile(appEnvPath);

const serverSet = new Set(
  normalize(functionsEnv.AUTHORIZED_EMAILS).split(",").map(normalize).filter(Boolean)
);
const clientSet = new Set(
  [appEnv.NEXT_PUBLIC_USER1_EMAIL, appEnv.NEXT_PUBLIC_USER2_EMAIL].map(normalize).filter(Boolean)
);

console.log(`server AUTHORIZED_EMAILS (functions/.env): ${serverSet.size} address(es)`);
console.log(`client NEXT_PUBLIC_USER{1,2}_EMAIL (app/.env.local): ${clientSet.size} address(es)`);

if (serverSet.size === 0) {
  console.error("MISMATCH: AUTHORIZED_EMAILS is unset or empty — the API would fail closed (500).");
  process.exit(1);
}

const onlyServer = [...serverSet].filter((e) => !clientSet.has(e)).length;
const onlyClient = [...clientSet].filter((e) => !serverSet.has(e)).length;

if (onlyServer > 0 || onlyClient > 0) {
  console.error(
    `MISMATCH: ${onlyServer} address(es) only on the server, ${onlyClient} only on the client. Do not deploy.`
  );
  process.exit(1);
}

console.log(`MATCH: both sides list the same ${serverSet.size} address(es). Safe to deploy.`);
