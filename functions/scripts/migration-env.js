/**
 * Entity 061 — the two-credential contract the historical migration runs under,
 * in one place so the extractor, the importer and the category sync cannot drift
 * apart on it.
 *
 * The asymmetry this exists for: the captain's archive workbook and the
 * normalization sheet are readable **only** by the staging service account (the
 * production account gets `403 The caller does not have permission` on the
 * archive), while rows are written to whichever target was named. So a run holds
 * two credential sets at once — never one that swaps.
 *
 *   source      read  archive workbook          staging creds, always
 *   normalize   write normalization tab         staging creds, always
 *   import      read  normalization tab         staging creds, always
 *   import      write target Expenses tab       the TARGET's creds
 *
 * `resolveTargets` is pure: it takes an env bag and returns the resolved pair, so
 * AC-17's test can assert the shape without a live credential anywhere.
 */

const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** The captain's archive workbook. Read-only on every phase and every target. */
const ARCHIVE_SPREADSHEET_ID = "1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I";
const ARCHIVE_TAB = "Daily";

const VALID_TARGETS = ["staging", "production"];

class TargetError extends Error {}

/**
 * Resolves the staging (read) pair and the target (write) pair from an env bag.
 *
 * Both are returned every time, as separate objects. A caller that wants to write
 * to production still gets `staging` back for its reads — which is the whole point:
 * a single swappable pair would make `--target production` read the archive
 * workbook with an account that cannot see it.
 */
function resolveTargets({ target, env = process.env }) {
  if (!target) {
    throw new TargetError(
      "No --target given. Pass --target staging or --target production explicitly; " +
      "this script never infers a target, because the inferred one is production."
    );
  }
  if (!VALID_TARGETS.includes(target)) {
    throw new TargetError(`--target must be one of ${VALID_TARGETS.join(", ")}, got "${target}".`);
  }

  const staging = {
    name: "staging",
    spreadsheetId: env.SPREADSHEET_ID_STAGING,
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_KEY_STAGING,
  };
  const production = {
    name: "production",
    spreadsheetId: env.SPREADSHEET_ID_PRODUCTION,
    credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION,
  };

  // The staging pair is required whatever the target, because the source read
  // needs it. Checking it here rather than at the read means a production run
  // fails before it has written anything.
  if (!staging.spreadsheetId || !staging.credentialsJson) {
    throw new TargetError(
      "The staging credentials are required for every target — the archive workbook and the " +
      "normalization sheet are readable only by the staging service account. Expected " +
      "SPREADSHEET_ID_STAGING and GOOGLE_SERVICE_ACCOUNT_KEY_STAGING (functions/.env.staging, " +
      "via `node -r ./scripts/load-local-env.js`)."
    );
  }

  const write = target === "staging" ? staging : production;
  if (!write.spreadsheetId || !write.credentialsJson) {
    throw new TargetError(
      `The ${target} write credentials are missing: expected SPREADSHEET_ID_${target.toUpperCase()} ` +
      `and GOOGLE_SERVICE_ACCOUNT_KEY_${target.toUpperCase()}.`
    );
  }

  return {
    target,
    // Reads of the archive workbook and the normalization sheet.
    read: { ...staging },
    // Writes of expense rows.
    write: { ...write },
  };
}

/** A Sheets client for one resolved pair. One client per pair, never shared. */
async function sheetsClientFor(pair, scope) {
  const { google } = require("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(pair.credentialsJson),
    scopes: [scope],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

/** The service-account email a pair authenticates as, for logging and for AC-17. */
function accountEmail(pair) {
  try {
    return JSON.parse(pair.credentialsJson).client_email ?? "(none)";
  } catch {
    return "(unparseable)";
  }
}

module.exports = {
  READONLY_SCOPE,
  WRITE_SCOPE,
  ARCHIVE_SPREADSHEET_ID,
  ARCHIVE_TAB,
  VALID_TARGETS,
  TargetError,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
};
