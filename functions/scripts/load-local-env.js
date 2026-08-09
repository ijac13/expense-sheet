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
for (const root of candidateRoots) {
  rootEnv = { ...parseEnvFile(path.join(root, ".env.local")), ...rootEnv };
  functionsEnv = { ...parseEnvFile(path.join(root, "functions", ".env")), ...functionsEnv };
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

const haveCreds = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS
);
console.log(
  `[env] SPREADSHEET_ID=${process.env.SPREADSHEET_ID ? "set" : "MISSING"} credentials=${haveCreds ? "set" : "MISSING"}`
);
