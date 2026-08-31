/**
 * Node preload that populates the env vars the admin scripts expect from the
 * repo's existing env files, so a migration can be run locally without
 * exporting anything by hand:
 *
 *   node -r ./scripts/load-local-env.js scripts/apply-insurance-tax-categories.js --dry-run
 *
 * Reads (never writes) `.env.local` at the repo root for the service-account
 * email/private key and `functions/.env` for SPREADSHEET_ID, then assembles the
 * GOOGLE_SERVICE_ACCOUNT_KEY JSON that apply-insurance-tax-categories.js and
 * migrate-2025.js both accept. Values already present in the environment win,
 * so CI or a shell export can still override.
 *
 * Entity 061 adds a SECOND credential pair rather than a switch between pairs.
 * The historical import has to hold two at once: the captain's archive workbook
 * and the normalization sheet are readable only by the STAGING service account
 * (production gets `403 The caller does not have permission` on the archive), while
 * the rows are written to whichever target was named. So this preload publishes
 * both pairs side by side —
 *
 *   SPREADSHEET_ID_STAGING    / GOOGLE_SERVICE_ACCOUNT_KEY_STAGING     (functions/.env.staging)
 *   SPREADSHEET_ID_PRODUCTION / GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION  (functions/.env + .env.local)
 *
 * — and records `MIGRATION_TARGET` from a `--target staging|production` argument.
 * A script picks the pair per call site. Implementing `--target` as one swappable
 * pair is the wrong shape: `--target production` would then read the archive
 * workbook with the production account and fail on its own source (AC-17).
 *
 * The legacy single-pair vars (`SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_KEY`) keep
 * resolving exactly as before, because four other admin scripts read them.
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

// `.env.local` and `functions/.env` are gitignored, so a git worktree never has
// them — resolve the main checkout too and fall back to it.
function mainCheckoutRoot(fromDir) {
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: fromDir,
      encoding: "utf8",
    }).trim();
    return path.dirname(commonDir);
  } catch {
    return null;
  }
}

const functionsDir = path.resolve(__dirname, "..");
const candidateRoots = [path.resolve(functionsDir, "..")];
const mainRoot = mainCheckoutRoot(functionsDir);
if (mainRoot && !candidateRoots.includes(mainRoot)) candidateRoots.push(mainRoot);

let rootEnv = {};
let functionsEnv = {};
let stagingEnv = {};
for (const root of candidateRoots) {
  rootEnv = { ...parseEnvFile(path.join(root, ".env.local")), ...rootEnv };
  functionsEnv = { ...parseEnvFile(path.join(root, "functions", ".env")), ...functionsEnv };
  stagingEnv = { ...parseEnvFile(path.join(root, "functions", ".env.staging")), ...stagingEnv };
}

if (!process.env.SPREADSHEET_ID) {
  const id = functionsEnv.SPREADSHEET_ID || rootEnv.GOOGLE_SPREADSHEET_ID;
  if (id) process.env.SPREADSHEET_ID = id;
}

if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const clientEmail = rootEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = rootEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      type: "service_account",
      client_email: clientEmail,
      // .env files carry the PEM with escaped newlines; the JWT signer needs real ones.
      private_key: privateKey.replace(/\\n/g, "\n"),
    });
  }
}

// ---------------------------------------------------------------------------
// Entity 061 — the two named pairs, published side by side (AC-17)
// ---------------------------------------------------------------------------

function serviceAccountKeyJson(env) {
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  return JSON.stringify({
    type: "service_account",
    client_email: clientEmail,
    // .env files carry the PEM with escaped newlines; the JWT signer needs real ones.
    private_key: privateKey.replace(/\\n/g, "\n"),
  });
}

function publish(name, value) {
  if (value && !process.env[name]) process.env[name] = value;
}

publish("SPREADSHEET_ID_STAGING", stagingEnv.SPREADSHEET_ID);
publish("GOOGLE_SERVICE_ACCOUNT_KEY_STAGING", serviceAccountKeyJson(stagingEnv));

publish("SPREADSHEET_ID_PRODUCTION", functionsEnv.SPREADSHEET_ID || rootEnv.GOOGLE_SPREADSHEET_ID);
publish("GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION", serviceAccountKeyJson(rootEnv));

// `--target` is read off the command line rather than the environment because the
// scripts that need it are invoked through `node -r ./scripts/load-local-env.js`,
// where argv is the only channel the caller has. An unrecognised value fails here,
// before any script has a chance to guess a default (AC-12's spirit, one layer up).
const targetIndex = process.argv.indexOf("--target");
if (targetIndex !== -1) {
  const target = process.argv[targetIndex + 1];
  if (target !== "staging" && target !== "production") {
    console.error(`[env] --target must be "staging" or "production", got ${JSON.stringify(target ?? "(nothing)")}`);
    process.exit(1);
  }
  process.env.MIGRATION_TARGET = target;
}

const haveCreds = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS
);
const pair = (label) =>
  `${label}=${process.env[`SPREADSHEET_ID_${label.toUpperCase()}`] ? "id" : "no-id"}/${
    process.env[`GOOGLE_SERVICE_ACCOUNT_KEY_${label.toUpperCase()}`] ? "creds" : "no-creds"
  }`;
console.log(
  `[env] SPREADSHEET_ID=${process.env.SPREADSHEET_ID ? "set" : "MISSING"} credentials=${haveCreds ? "set" : "MISSING"} ` +
  `${pair("staging")} ${pair("production")} target=${process.env.MIGRATION_TARGET ?? "(none)"}`
);
