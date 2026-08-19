import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { parseInsightsPeriod, buildInsightsPrompt } from "./insights";
import {
  Row,
  ColumnMap,
  TabSpec,
  SheetSchemaError,
  EXPENSES_SPEC,
  CATEGORIES_SPEC,
  SUBSCRIPTIONS_SPEC,
  buildColumnMap,
  buildWriteRow,
  cell,
  columnLetter,
  rowToSubscription,
} from "./sheetSchema";
import { TIME_ZONE, runSubscriptionScheduler, readSchedulerStatus } from "./scheduler";

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const EXPENSES_TAB = EXPENSES_SPEC.tab;
const USERS_TAB = "Users";
const SUBSCRIPTIONS_TAB = SUBSCRIPTIONS_SPEC.tab;
const CATEGORIES_TAB = CATEGORIES_SPEC.tab;

// Read wide enough that a column dragged to the right is still in view. A range
// that stops at the last known field reintroduces the bug where `gov_category`
// silently read as blank because it sat one column past the range.
const READ_RANGE = "A:Z";
const HEADER_RANGE = "A1:Z1";

function setCors(res: { set: (key: string, value: string) => void }) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

async function getSheetsClient() {
  const auth = await google.auth.getClient({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Fetch a whole tab plus the column map built from its own header row. The map
// costs no extra API call: every read already returns row 1 and threw it away.
async function readTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  spec: TabSpec
): Promise<{ rows: Row[]; map: ColumnMap }> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${spec.tab}!${READ_RANGE}`,
  });
  const rows = (response.data.values ?? []) as Row[];
  return { rows, map: buildColumnMap(rows, spec) };
}

// Just the header row, for paths that do not need the data (row insertion, and
// DELETE, which then reads only the resolved id column).
async function readColumnMap(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  spec: TabSpec
): Promise<ColumnMap> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${spec.tab}!${HEADER_RANGE}`,
  });
  return buildColumnMap((response.data.values ?? []) as Row[], spec);
}

// A cell the captain typed as a real Sheets date comes back FORMATTED_VALUE —
// `2026/8/19`, not ISO — so only two genuine ISO dates are ever compared. Any
// other shape skips the guard rather than 400ing on a value the sheet owns.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function endsBeforeStart(start: string, end: string): boolean {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return false;
  return end < start;
}

// Creates a missing `start_date` / `end_date` header on demand, following
// ensureSchedulerLog: the captain never has to touch the sheet by hand, and a
// production-sheet precondition is exactly the thing that blocks a deploy.
// New headers land in the first free columns to the right of row 1's last
// header, so an unknown column the resolver ignores is never written over.
async function ensureSubscriptionColumns(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  map: ColumnMap,
  fields: string[]
): Promise<ColumnMap> {
  const missing = fields.filter((f) => map.index[f] === undefined);
  if (missing.length === 0) return map;

  const first = map.width;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SUBSCRIPTIONS_TAB}!${columnLetter(first)}1:${columnLetter(first + missing.length - 1)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [missing] },
  });

  const index = { ...map.index };
  missing.forEach((f, i) => { index[f] = first + i; });
  return { tab: map.tab, index, width: first + missing.length };
}

function rowToExpense(row: Row, map: ColumnMap): Record<string, unknown> {
  return {
    id: cell(row, map, "id") ?? "",
    date: cell(row, map, "date") ?? "",
    amount: Number(cell(row, map, "amount") ?? 0),
    category_id: cell(row, map, "category_id") ?? "",
    paid_by: cell(row, map, "paid_by") ?? "",
    created_by: cell(row, map, "created_by") ?? "",
    notes: cell(row, map, "notes") ?? "",
    created_at: cell(row, map, "created_at") ?? "",
  };
}

// The Users tab is deliberately excluded from header-name resolution: its live
// header row is `email | Users`, which does not name the fields this needs
// (id/name/email). Matching by name cannot work until the sheet's own header is
// renamed, which is a schema change and a separate decision.
function rowToUser(row: (string | null | undefined)[]): Record<string, unknown> {
  // Sheet columns: id | email | name  (captain swapped name/email in sheet)
  const id = row[0] ?? "";
  const col1 = row[1] ?? "";
  const col2 = row[2] ?? "";
  // Detect which column is email by checking for "@"
  const email = col1.includes("@") ? col1 : col2;
  const name = col1.includes("@") ? (col2 || col1) : (col1 || col2);
  return { id, name, email };
}

function rowToCategory(row: Row, map: ColumnMap): Record<string, unknown> {
  return {
    id: cell(row, map, "id") ?? "",
    name_en: cell(row, map, "name_en") ?? "",
    name_zh: cell(row, map, "name_zh") ?? "",
    icon: cell(row, map, "icon") ?? "",
    sort_order: Number(cell(row, map, "sort_order") ?? 0),
    is_active: cell(row, map, "is_active") !== "false",
    gov_category: cell(row, map, "gov_category") ?? null,
    note: cell(row, map, "note") ?? "",
  };
}

// Insert a data row at position 2 (right after the header) so the sheet stays DESC.
// `dataRow` is already laid out against the tab's own header via buildWriteRow,
// so unnamed columns arrive blank rather than shifting a value into them.
async function insertRowAtTop(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabName: string,
  dataRow: string[]
): Promise<void> {
  const colLetter = columnLetter(dataRow.length - 1);

  // Get sheetId for this tab
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId ?? 0;

  // Insert an empty row at index 1 (after header)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ insertDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
        inheritFromBefore: false,
      }}],
    },
  });

  // Write data into the new row 2
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A2:${colLetter}2`,
    valueInputOption: "RAW",
    requestBody: { values: [dataRow] },
  });
}

// Static fallback for legacy client-side user IDs (user1/user2 → display name).
// The Google Sheet's Users tab uses email as the id column, so these can't be
// resolved dynamically. This map ensures new writes always use display names.
const LEGACY_USER_MAP: Record<string, string> = {
  "user1": "ijac",
  "user2": "wei",
};

// Resolve a user ID to their display name using the Users tab.
// Falls back to LEGACY_USER_MAP, then to the raw value.
async function resolveUserDisplayNames(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>(ids.map((id) => [id, LEGACY_USER_MAP[id] ?? id]));
  try {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${USERS_TAB}!A:C`,
    });
    const userRows = (resp.data.values ?? []).slice(1).map(rowToUser);
    for (const id of ids) {
      const user = userRows.find((u) => u.id === id);
      if (user) result.set(id, String(user.name));
    }
  } catch {
    // ignore — fall back to LEGACY_USER_MAP or raw IDs
  }
  return result;
}

// ---------------------------------------------------------------------------
// HTTP API function
// ---------------------------------------------------------------------------
export const api = onRequest({ secrets: [anthropicKey] }, async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    res.status(500).json({ error: "SPREADSHEET_ID not configured" });
    return;
  }

  const path = req.path ?? "";

  try {
    const sheets = await getSheetsClient();

    // -----------------------------------------------------------------------
    // /api/users — GET  (check AFTER migrate-users to avoid substring collision)
    // -----------------------------------------------------------------------
    if (path.includes("users") && !path.includes("migrate-users")) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${USERS_TAB}!A:C`,
      });
      const rows = response.data.values ?? [];
      res.status(200).json(rows.slice(1).map(rowToUser));
      return;
    }

    // -----------------------------------------------------------------------
    // /api/scheduler-status — GET (is subscription auto-add still running?)
    // -----------------------------------------------------------------------
    if (path.includes("scheduler-status")) {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      res.status(200).json(await readSchedulerStatus(sheets, spreadsheetId, Date.now()));
      return;
    }

    // -----------------------------------------------------------------------
    // /api/categories — GET / POST / PATCH
    // -----------------------------------------------------------------------
    if (path.includes("categories")) {
      // GET — return all categories
      if (req.method === "GET") {
        const { rows, map } = await readTab(sheets, spreadsheetId, CATEGORIES_SPEC);
        res.status(200).json(rows.slice(1).map((r) => rowToCategory(r, map)));
        return;
      }

      // POST — add a new category
      if (req.method === "POST") {
        const body = req.body as Record<string, unknown>;

        // Read existing rows to determine next id and sort_order
        const { rows, map } = await readTab(sheets, spreadsheetId, CATEGORIES_SPEC);
        const existingRows = rows.slice(1).map((r) => rowToCategory(r, map));

        // Generate id: cat_NNN using max numeric suffix + 1
        const maxNum = existingRows.reduce((max, r) => {
          const match = String(r.id).match(/^cat_(\d+)$/);
          if (match) return Math.max(max, parseInt(match[1], 10));
          return max;
        }, 0);
        const newId = `cat_${String(maxNum + 1).padStart(3, "0")}`;

        // sort_order = max existing + 1
        const maxOrder = existingRows.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0);
        const sortOrder = maxOrder + 1;

        const updates: Record<string, string> = {
          id: newId,
          name_en: String(body.name_en ?? ""),
          name_zh: String(body.name_zh ?? ""),
          icon: String(body.icon ?? ""),
          sort_order: String(sortOrder),
          is_active: "true",
        };
        // Optional columns are only written when the sheet actually has them.
        // Submitting a value for an absent column is a 400 from buildWriteRow
        // rather than a silent discard.
        if (body.gov_category !== undefined) updates.gov_category = String(body.gov_category);
        if (body.note !== undefined) updates.note = String(body.note);

        const row = buildWriteRow([], map, updates);

        // Append row at the end (categories are ordered by sort_order, not insertion order)
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${CATEGORIES_TAB}!${READ_RANGE}`,
          valueInputOption: "RAW",
          requestBody: { values: [row] },
        });

        res.status(201).json(rowToCategory(row, map));
        return;
      }

      // PATCH /:id — update fields of a category by id
      if (req.method === "PATCH") {
        const pathParts = path.split("/").filter(Boolean);
        const targetId = pathParts[pathParts.length - 1];
        if (!targetId || targetId === "categories") {
          res.status(400).json({ error: "id is required in path: PATCH /api/categories/:id" });
          return;
        }

        const { rows, map } = await readTab(sheets, spreadsheetId, CATEGORIES_SPEC);
        const rowIndex = rows.findIndex((r, i) => i > 0 && cell(r, map, "id") === targetId);
        if (rowIndex === -1) {
          res.status(404).json({ error: "Category not found" });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const updates: Record<string, string> = {};
        for (const field of ["name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"]) {
          if (body[field] !== undefined) updates[field] = String(body[field]);
        }
        const updated = buildWriteRow(rows[rowIndex], map, updates);

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${CATEGORIES_TAB}!A${rowIndex + 1}:${columnLetter(updated.length - 1)}${rowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [updated] },
        });

        res.status(200).json(rowToCategory(updated, map));
        return;
      }

      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // -----------------------------------------------------------------------
    // /api/subscriptions — GET / POST / PATCH
    // -----------------------------------------------------------------------
    if (path.includes("subscriptions")) {
      // GET — return all subscriptions
      if (req.method === "GET") {
        const { rows, map } = await readTab(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC);
        res.status(200).json(rows.slice(1).map((r) => rowToSubscription(r, map)));
        return;
      }

      // POST — add a new subscription
      if (req.method === "POST") {
        const body = req.body as Record<string, unknown>;
        const id = `sub-${Date.now()}`;

        let map = await readColumnMap(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC);
        map = await ensureSubscriptionColumns(sheets, spreadsheetId, map, ["start_date", "end_date"]);

        const paidById = String(body.paid_by ?? "");
        const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [paidById]);

        const row = buildWriteRow([], map, {
          id,
          name: String(body.name ?? ""),
          amount: String(body.amount ?? 0),
          category_id: String(body.category_id ?? ""),
          frequency: String(body.frequency ?? "monthly"),
          due_day: String(body.due_day ?? 1),
          due_month: String(body.due_month ?? ""),
          paid_by: nameMap.get(paidById) ?? paidById,
          is_active: "true",
          // Whatever the form submitted, never a server-side "today": the browser
          // is the only side that knows the captain's local date. A new
          // subscription is active, so it has no end date.
          start_date: String(body.start_date ?? ""),
          end_date: "",
        });

        await insertRowAtTop(sheets, spreadsheetId, SUBSCRIPTIONS_TAB, row);

        res.status(201).json(rowToSubscription(row, map));
        return;
      }

      // PATCH — update or cancel a subscription by id
      if (req.method === "PATCH") {
        const body = req.body as Record<string, unknown>;
        const targetId = String(body.id ?? "");

        // Find the row
        const { rows, map } = await readTab(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC);
        const rowIndex = rows.findIndex((r, i) => i > 0 && cell(r, map, "id") === targetId);
        if (rowIndex === -1) {
          res.status(404).json({ error: "Subscription not found" });
          return;
        }

        // frequency and paid_by are not patchable; leaving them out of `updates`
        // carries their existing cells forward untouched. The same rule is what
        // keeps an unrelated edit from blanking a date.
        const updates: Record<string, string> = {};
        for (const field of ["name", "amount", "category_id", "due_day", "due_month", "is_active", "start_date", "end_date"]) {
          if (body[field] !== undefined) updates[field] = String(body[field]);
        }

        // Rejected independently of the modal, because the modal is not the only
        // caller. A start date arriving in the same PATCH wins over the stored one.
        if (updates.end_date !== undefined) {
          const start = updates.start_date !== undefined
            ? updates.start_date
            : String(cell(rows[rowIndex], map, "start_date") ?? "");
          if (endsBeforeStart(start, updates.end_date)) {
            res.status(400).json({
              error: `end_date "${updates.end_date}" is earlier than start_date "${start}".`,
            });
            return;
          }
        }

        const writeMap = await ensureSubscriptionColumns(
          sheets, spreadsheetId, map, Object.keys(updates)
        );
        const updated = buildWriteRow(rows[rowIndex], writeMap, updates);

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A${rowIndex + 1}:${columnLetter(updated.length - 1)}${rowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [updated] },
        });

        res.status(200).json(rowToSubscription(updated, writeMap));
        return;
      }

      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // -----------------------------------------------------------------------
    // /api/insights — POST (generates AI spending analysis)
    // -----------------------------------------------------------------------
    if (path.includes("insights")) {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // The analysed period comes from the request — never from the clock, or
      // the report on screen and the analysis disagree.
      const period = parseInsightsPeriod(req.body);
      if (!period) {
        res.status(400).json({ error_code: "bad_period" });
        return;
      }
      const periodEcho = period.type === "monthly"
        ? { type: "monthly", year: period.year, month: period.month }
        : { type: "annual", year: period.year };

      // Fetch all expenses and subscriptions
      let expTab, subTab;
      try {
        [expTab, subTab] = await Promise.all([
          readTab(sheets, spreadsheetId, EXPENSES_SPEC),
          readTab(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC),
        ]);
      } catch (fetchErr) {
        // A schema problem is a 500 naming the tab and field, not a generic
        // "data_error" the caller cannot act on.
        if (fetchErr instanceof SheetSchemaError) throw fetchErr;
        console.error("Sheets fetch error:", fetchErr);
        res.status(503).json({ error_code: "data_error" });
        return;
      }

      const allExpenses = expTab.rows.slice(1).map((r) => rowToExpense(r, expTab.map));
      const subscriptions = subTab.rows.slice(1).map((r) => rowToSubscription(r, subTab.map))
        .filter((s) => s.is_active);

      const built = buildInsightsPrompt({
        expenses: allExpenses,
        subscriptions,
        period,
        nowMs: Date.now(),
      });

      if (built.kind === "insufficient") {
        res.status(200).json({ insufficient_data: true, days: built.days, period: periodEcho });
        return;
      }
      let text: string;
      try {
        const client = new Anthropic({ apiKey: anthropicKey.value() });
        const message = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          messages: [{ role: "user", content: built.prompt }],
        });
        text = message.content[0].type === "text" ? message.content[0].text : "";
      } catch (aiErr) {
        console.error("Anthropic API error:", aiErr);
        res.status(503).json({ error_code: "ai_error" });
        return;
      }

      res.status(200).json({ insights: text, period: periodEcho });
      return;
    }

    // -----------------------------------------------------------------------
    // /api/migrate-users — POST (one-time: replace user IDs with display names)
    // -----------------------------------------------------------------------
    if (path.includes("migrate-users")) {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

      // Load user map once
      const usersResp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${USERS_TAB}!A:C` });
      const userRows = (usersResp.data.values ?? []).slice(1).map(rowToUser);
      const idToName = new Map(userRows.map((u) => [String(u.id), String(u.name)]));
      // Also cover legacy client-side IDs
      for (const [k, v] of Object.entries(LEGACY_USER_MAP)) idToName.set(k, v);

      function resolveStatic(val: string): string {
        return idToName.get(val) ?? val;
      }

      let expensesFixed = 0;
      let subscriptionsFixed = 0;

      // --- Expenses ---
      const expTab = await readTab(sheets, spreadsheetId, EXPENSES_SPEC);
      const expUpdates: { range: string; values: string[][] }[] = [];
      for (let i = 1; i < expTab.rows.length; i++) {
        const r = expTab.rows[i];
        const origPaid = String(cell(r, expTab.map, "paid_by") ?? "");
        const origCreated = String(cell(r, expTab.map, "created_by") ?? "");
        const newPaid = resolveStatic(origPaid);
        const newCreated = resolveStatic(origCreated);
        if (newPaid !== origPaid || newCreated !== origCreated) {
          const updated = buildWriteRow(r, expTab.map, { paid_by: newPaid, created_by: newCreated });
          expUpdates.push({
            range: `${EXPENSES_TAB}!A${i + 1}:${columnLetter(updated.length - 1)}${i + 1}`,
            values: [updated],
          });
          expensesFixed++;
        }
      }
      for (const upd of expUpdates) {
        await sheets.spreadsheets.values.update({ spreadsheetId, range: upd.range, valueInputOption: "RAW", requestBody: { values: upd.values } });
      }

      // --- Subscriptions ---
      const subTab = await readTab(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC);
      const subUpdates: { range: string; values: string[][] }[] = [];
      for (let i = 1; i < subTab.rows.length; i++) {
        const r = subTab.rows[i];
        const origPaid = String(cell(r, subTab.map, "paid_by") ?? "");
        const newPaid = resolveStatic(origPaid);
        if (newPaid !== origPaid) {
          const updated = buildWriteRow(r, subTab.map, { paid_by: newPaid });
          subUpdates.push({
            range: `${SUBSCRIPTIONS_TAB}!A${i + 1}:${columnLetter(updated.length - 1)}${i + 1}`,
            values: [updated],
          });
          subscriptionsFixed++;
        }
      }
      for (const upd of subUpdates) {
        await sheets.spreadsheets.values.update({ spreadsheetId, range: upd.range, valueInputOption: "RAW", requestBody: { values: upd.values } });
      }

      res.status(200).json({ expensesFixed, subscriptionsFixed });
      return;
    }

    // -----------------------------------------------------------------------
    // /api (expenses) — PATCH / DELETE / GET / POST
    // -----------------------------------------------------------------------

    // PATCH — update an expense by id
    if (req.method === "PATCH") {
      const body = req.body as Record<string, unknown>;
      const targetId = String(body.id ?? "");
      if (!targetId) { res.status(400).json({ error: "id is required" }); return; }

      const { rows, map } = await readTab(sheets, spreadsheetId, EXPENSES_SPEC);
      const rowIndex = rows.findIndex((r, i) => i > 0 && cell(r, map, "id") === targetId);
      if (rowIndex === -1) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }

      // created_by and created_at are not patchable; omitting them from
      // `updates` carries their existing cells forward untouched.
      const updates: Record<string, string> = {};
      for (const field of ["date", "amount", "category_id", "notes"]) {
        if (body[field] !== undefined) updates[field] = String(body[field]);
      }
      if (body.paid_by !== undefined) {
        const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [String(body.paid_by)]);
        updates.paid_by = nameMap.get(String(body.paid_by)) ?? String(body.paid_by);
      }

      const updated = buildWriteRow(rows[rowIndex], map, updates);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A${rowIndex + 1}:${columnLetter(updated.length - 1)}${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [updated] },
      });

      res.status(200).json(rowToExpense(updated, map));
      return;
    }

    // DELETE — remove an expense by id
    if (req.method === "DELETE") {
      const body = req.body as Record<string, unknown>;
      const targetId = String(body.id ?? "");
      if (!targetId) { res.status(400).json({ error: "id is required" }); return; }

      // Resolve which column holds `id` from the header, then read only that
      // column — the tab has ~1400 rows, so pulling A:Z just to locate one id
      // would be wasteful.
      const map = await readColumnMap(sheets, spreadsheetId, EXPENSES_SPEC);
      const idCol = columnLetter(map.index.id);
      const allRows = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!${idCol}:${idCol}`,
      });
      const rows = allRows.data.values ?? [];
      const rowIndex = rows.findIndex((r, i) => i > 0 && (r[0] ?? "") === targetId);
      if (rowIndex === -1) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }

      // Get the sheet ID for batchUpdate
      const meta = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
      });
      const sheetMeta = meta.data.sheets?.find(
        (s) => s.properties?.title === EXPENSES_TAB
      );
      const sheetId = sheetMeta?.properties?.sheetId ?? 0;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          }],
        },
      });

      res.status(200).json({ deleted: true });
      return;
    }

    // GET — return all expenses
    if (req.method === "GET") {
      const { rows, map } = await readTab(sheets, spreadsheetId, EXPENSES_SPEC);
      res.status(200).json(rows.slice(1).map((r) => rowToExpense(r, map)));
      return;
    }

    // POST — add a new expense
    if (req.method === "POST") {
      const body = req.body as Record<string, unknown>;
      const id = `exp-${Date.now()}`;
      const created_at = new Date().toISOString();

      const map = await readColumnMap(sheets, spreadsheetId, EXPENSES_SPEC);

      // Resolve user IDs to display names for the sheet
      const paidById = String(body.paid_by ?? "");
      const createdById = String(body.created_by ?? "");
      const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [paidById, createdById]);

      const row = buildWriteRow([], map, {
        id,
        date: String(body.date ?? new Date().toISOString().split("T")[0]),
        amount: String(body.amount ?? 0),
        category_id: String(body.category_id ?? ""),
        paid_by: nameMap.get(paidById) ?? paidById,
        created_by: nameMap.get(createdById) ?? createdById,
        notes: String(body.notes ?? ""),
        created_at,
      });

      await insertRowAtTop(sheets, spreadsheetId, EXPENSES_TAB, row);

      res.status(201).json(rowToExpense(row, map));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    // A column the code expects is missing, duplicated, or unwritable. Say which
    // tab and which field — a blank field that looks like real data is exactly
    // the failure mode this feature exists to remove.
    if (err instanceof SheetSchemaError) {
      console.error("Sheet schema error:", err.message);
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error("API error:", err);
    res.status(503).json({ error: "Service error", detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Daily subscription auto-add
// ---------------------------------------------------------------------------
// 01:00 Asia/Taipei, matching the spreadsheet's own timezone so a subscription
// due on the 15th is filed under the 15th the captain sees. Deployed by
// `firebase deploy --only functions` like every other function here — the Apps
// Script this replaced needed a manual trigger nobody ever installed.
export const subscriptionScheduler = onSchedule(
  { schedule: "0 1 * * *", timeZone: TIME_ZONE },
  async () => {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error("SPREADSHEET_ID not configured");
    const sheets = await getSheetsClient();
    const result = await runSubscriptionScheduler(sheets, spreadsheetId, Date.now());
    console.log("subscriptionScheduler:", JSON.stringify(result));
  }
);
