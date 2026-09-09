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

/**
 * Entity 062 — the captain's mortgage schedule, `Coast FIRE_ijac.wei`.
 *
 * Unlike the archive workbook, both the staging AND production service accounts
 * read this one (confirmed live). `HOUSE_RANGE` is bounded to D5:K255 deliberately
 * (AC-6): columns A-C of this tab hold a bank name, branch, account number and an
 * account-holder personal name in one cell, and no script may request them. Entity
 * `064` widened this from D5:J255 to include column K (`先還本金`, the principal
 * prepayment) — still never touching A-C.
 */
const HOUSE_SPREADSHEET_ID = "1oUCppCwkfw2BMG8gZwxb13Vq8KVXBQFrVoS57ZH9h6E";
const HOUSE_TAB = "House";
const HOUSE_RANGE = "D5:K255";

/**
 * Entity 066 — ijac's own `smoney` ledger export, the source for the Jan-Apr 2026
 * backfill. Read-only, staging-credentialed only (same asymmetry as the archive
 * workbook: never assume the production account can see it). Both the tab TITLE
 * and its GID are pinned, not just the title, because AC-9's falsifier is a
 * position/index read surviving a spreadsheet reorder — `verifyTabIdentity` in
 * the extractor checks both against the same spreadsheet metadata call.
 *
 * CORRECTED during build, Dispatch Retry 1 (see the entity's own "Dispatch
 * Retries" log): the build dispatch's original instruction — a tab literally
 * named `migrate`, gid `2065989204` — was wrong. That tab holds the spec's own
 * documented OUT-OF-SCOPE `2025-01~04` reference block (151 rows, all dated
 * 2025), not the migration source. The spreadsheet's only OTHER tab, titled
 * after the export itself, reproduces the spec's own recorded Jan-Apr 2026
 * figures exactly (203 `支出` / 1 `收入`, live-confirmed) and is the real source.
 * Spec had correctly flagged this gid as unconfirmed; the FO's build dispatch
 * incorrectly presented it as already-confirmed.
 */
const MIGRATION066_SPREADSHEET_ID = "1F2gv7ZytfwIVHuaAkZGMTEnB8jG9GoeKx-CyyjTCKto";
const MIGRATION066_TAB = "smoney-2026年9月8日_上午81314_ijac";
const MIGRATION066_GID = 792951830;

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
/** Both named credential pairs, regardless of which one a run targets — what
 * AC-13's House-tab access check needs, since it must authenticate as BOTH. */
function resolveCredentialPairs(env = process.env) {
  return {
    staging: {
      name: "staging",
      spreadsheetId: env.SPREADSHEET_ID_STAGING,
      credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_KEY_STAGING,
    },
    production: {
      name: "production",
      spreadsheetId: env.SPREADSHEET_ID_PRODUCTION,
      credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION,
    },
  };
}

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

  const { staging, production } = resolveCredentialPairs(env);

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

/**
 * AC-13 — confirms BOTH the staging and production service accounts can read the
 * House tab, at runtime, before a run relies on that assumption.
 *
 * The archive workbook is staging-only (production 403s on it), but the mortgage
 * sheet's access is broader — both accounts read it today. That is a fact about
 * what the captain shared, not about this code, so it is asserted live rather than
 * carried as a constant: if her sharing settings on this sheet ever change, this
 * throws naming exactly which credential lost access, instead of the run silently
 * assuming staging-only reachability and failing somewhere downstream with no
 * clear cause.
 */
async function verifyHouseTabAccess({ staging, production }, { sheetsFor = sheetsClientFor } = {}) {
  const results = {};
  for (const [label, pair] of [["staging", staging], ["production", production]]) {
    try {
      const sheets = await sheetsFor(pair, READONLY_SCOPE);
      await sheets.spreadsheets.values.get({
        spreadsheetId: HOUSE_SPREADSHEET_ID,
        range: `'${HOUSE_TAB}'!D5:D5`,
      });
      results[label] = { ok: true };
    } catch (err) {
      results[label] = { ok: false, error: err.message ?? String(err) };
    }
  }
  const failed = Object.entries(results).filter(([, r]) => !r.ok);
  if (failed.length > 0) {
    throw new TargetError(
      `House tab read-access check failed for: ` +
      failed.map(([label, r]) => `${label} (${r.error})`).join(", ") +
      `. Both the staging and production service accounts are expected to read the House ` +
      `tab (spreadsheet ${HOUSE_SPREADSHEET_ID}); refusing to proceed on a stale assumption.`
    );
  }
  return results;
}

module.exports = {
  READONLY_SCOPE,
  WRITE_SCOPE,
  ARCHIVE_SPREADSHEET_ID,
  ARCHIVE_TAB,
  HOUSE_SPREADSHEET_ID,
  HOUSE_TAB,
  HOUSE_RANGE,
  MIGRATION066_SPREADSHEET_ID,
  MIGRATION066_TAB,
  MIGRATION066_GID,
  VALID_TARGETS,
  TargetError,
  resolveCredentialPairs,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
  verifyHouseTabAccess,
};
