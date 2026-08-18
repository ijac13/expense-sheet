// Generates an expense row for every active subscription on its due date.
//
// Replaces apps-script/subscription-scheduler.gs, which never produced a single
// row in months of live data: it compared `is_active` against the boolean `true`
// while every cell in the sheet holds the string "true", and it wrote `status`
// and `subscription_id`, neither of which is a column. Both classes of bug are
// structurally excluded here — the active check is the API's own
// `rowToSubscription`, and every write goes through `buildWriteRow`, which
// throws rather than dropping a field with no column.

import { google } from "googleapis";
import {
  Row,
  ColumnMap,
  TabSpec,
  EXPENSES_SPEC,
  SUBSCRIPTIONS_SPEC,
  buildColumnMap,
  buildWriteRow,
  columnLetter,
  rowToSubscription,
  Subscription,
} from "./sheetSchema";

type Sheets = ReturnType<typeof google.sheets>;

// The spreadsheet is Asia/Taipei (UTC+8, no DST). A Function runs in UTC, so an
// unqualified "today" would file 8 hours of every day under the wrong date.
export const TIME_ZONE = "Asia/Taipei";

export const SCHEDULER_LOG_SPEC: TabSpec = {
  tab: "SchedulerLog",
  required: ["run_at", "due_count", "created_count", "skipped_count", "error"],
  optional: [],
};

const READ_RANGE = "A:Z";
const HEADER_RANGE = "A1:Z1";

// A run older than this means the daily schedule stopped firing. 36h rather than
// 24h so a late run or a one-off retry does not read as a failure.
export const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export interface TaipeiDate {
  year: number;
  month: number; // 1-12
  day: number;
  iso: string; // YYYY-MM-DD
}

export function taipeiDate(nowMs: number): TaipeiDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return {
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// A due_day past the end of the current month lands on its last day, so a
// day-31 subscription fires once in February and once in April — never skipped,
// never doubled.
export function isDueOn(sub: Subscription, today: TaipeiDate): boolean {
  const dueDay = Math.min(sub.due_day, daysInMonth(today.year, today.month));
  if (sub.frequency === "annual") {
    return today.month === Number(sub.due_month) && today.day === dueDay;
  }
  return today.day === dueDay;
}

// Derived from the subscription and the date rather than from a clock or a UUID,
// so a retry recomputes the same id and the already-written row is recognised.
export function autoExpenseId(subscriptionId: string, isoDate: string): string {
  return `exp-auto-${subscriptionId}-${isoDate}`;
}

export interface SchedulerRunResult {
  run_at: string;
  due_count: number;
  created_count: number;
  skipped_count: number;
}

export interface SchedulerStatus {
  last_run_at: string | null;
  due_count: number;
  created_count: number;
  skipped_count: number;
  error: string;
  stale: boolean;
}

async function readTab(sheets: Sheets, spreadsheetId: string, spec: TabSpec): Promise<{ rows: Row[]; map: ColumnMap }> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${spec.tab}!${READ_RANGE}`,
  });
  const rows = (response.data.values ?? []) as Row[];
  return { rows, map: buildColumnMap(rows, spec) };
}

async function readColumnMap(sheets: Sheets, spreadsheetId: string, spec: TabSpec): Promise<ColumnMap> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${spec.tab}!${HEADER_RANGE}`,
  });
  return buildColumnMap((response.data.values ?? []) as Row[], spec);
}

async function tabTitles(sheets: Sheets, spreadsheetId: string): Promise<Set<string>> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  return new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
}

// The tab and its header are created on demand, so the captain never has to
// touch the sheet by hand — a manual Google-side setup step is the exact failure
// this feature exists to remove.
async function ensureSchedulerLog(sheets: Sheets, spreadsheetId: string): Promise<ColumnMap> {
  const titles = await tabTitles(sheets, spreadsheetId);
  if (!titles.has(SCHEDULER_LOG_SPEC.tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SCHEDULER_LOG_SPEC.tab } } }] },
    });
  }

  const header = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SCHEDULER_LOG_SPEC.tab}!${HEADER_RANGE}`,
  });
  const rows = (header.data.values ?? []) as Row[];
  const blank = !rows[0] || rows[0].every((c) => String(c ?? "").trim() === "");
  if (!blank) return buildColumnMap(rows, SCHEDULER_LOG_SPEC);

  const fields = SCHEDULER_LOG_SPEC.required;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SCHEDULER_LOG_SPEC.tab}!A1:${columnLetter(fields.length - 1)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [fields] },
  });
  return buildColumnMap([fields], SCHEDULER_LOG_SPEC);
}

async function appendSchedulerLog(
  sheets: Sheets,
  spreadsheetId: string,
  entry: SchedulerRunResult & { error: string }
): Promise<void> {
  const map = await ensureSchedulerLog(sheets, spreadsheetId);
  const row = buildWriteRow([], map, {
    run_at: entry.run_at,
    due_count: String(entry.due_count),
    created_count: String(entry.created_count),
    skipped_count: String(entry.skipped_count),
    error: entry.error,
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SCHEDULER_LOG_SPEC.tab}!${READ_RANGE}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

// Rows go in at the top because the Expenses tab reads newest-first, the same as
// POST /api. Both steps ride in ONE batchUpdate, which Sheets applies all or
// nothing: an insert that succeeded followed by a write that failed would leave a
// blank row behind, and an unattended daily job has nobody watching to clean it up.
async function insertRowsAtTop(
  sheets: Sheets,
  spreadsheetId: string,
  tabName: string,
  rows: string[][]
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { insertDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 1 + rows.length },
          inheritFromBefore: false,
        }},
        { updateCells: {
          start: { sheetId, rowIndex: 1, columnIndex: 0 },
          // stringValue, not a parsed value: every amount and date already in the
          // tab is text, and RAW-mode writes elsewhere keep it that way.
          rows: rows.map((r) => ({ values: r.map((v) => ({ userEnteredValue: { stringValue: v } })) })),
          fields: "userEnteredValue",
        }},
      ],
    },
  });
}

export async function runSubscriptionScheduler(
  sheets: Sheets,
  spreadsheetId: string,
  nowMs: number
): Promise<SchedulerRunResult> {
  const today = taipeiDate(nowMs);
  const run_at = new Date(nowMs).toISOString();
  const counts = { due_count: 0, created_count: 0, skipped_count: 0 };

  try {
    const subsTab = await readTab(sheets, spreadsheetId, SUBSCRIPTIONS_SPEC);
    const due = subsTab.rows
      .slice(1)
      .map((r) => rowToSubscription(r, subsTab.map))
      .filter((s) => s.is_active && isDueOn(s, today));
    counts.due_count = due.length;

    if (due.length > 0) {
      // Header first, then the id column alone: the Expenses tab is ~2,000 rows
      // and growing, and the only thing this needs from them is which ids exist.
      const expensesMap = await readColumnMap(sheets, spreadsheetId, EXPENSES_SPEC);
      const idColumn = columnLetter(expensesMap.index.id);
      const idResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_SPEC.tab}!${idColumn}:${idColumn}`,
      });
      const existingIds = new Set(
        ((idResponse.data.values ?? []) as Row[]).slice(1).map((r) => String(r[0] ?? ""))
      );

      const rows: string[][] = [];
      for (const sub of due) {
        const id = autoExpenseId(sub.id, today.iso);
        if (existingIds.has(id)) {
          counts.skipped_count++;
          continue;
        }
        rows.push(buildWriteRow([], expensesMap, {
          id,
          date: today.iso,
          amount: String(sub.amount),
          category_id: sub.category_id,
          paid_by: sub.paid_by,
          created_by: sub.paid_by,
          notes: sub.name,
          created_at: run_at,
        }));
      }

      if (rows.length > 0) {
        await insertRowsAtTop(sheets, spreadsheetId, EXPENSES_SPEC.tab, rows);
        counts.created_count = rows.length;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await appendSchedulerLog(sheets, spreadsheetId, { run_at, ...counts, error: message });
    } catch (logErr) {
      console.error("SchedulerLog write failed while recording a run failure:", logErr);
    }
    throw err;
  }

  await appendSchedulerLog(sheets, spreadsheetId, { run_at, ...counts, error: "" });
  return { run_at, ...counts };
}

export async function readSchedulerStatus(
  sheets: Sheets,
  spreadsheetId: string,
  nowMs: number
): Promise<SchedulerStatus> {
  const neverRan: SchedulerStatus = {
    last_run_at: null,
    due_count: 0,
    created_count: 0,
    skipped_count: 0,
    error: "",
    stale: true,
  };

  let rows: Row[];
  let map: ColumnMap;
  try {
    // A status read must not create the tab: a GET that mutates the sheet would
    // report "healthy" on a spreadsheet the scheduler has never touched.
    ({ rows, map } = await readTab(sheets, spreadsheetId, SCHEDULER_LOG_SPEC));
  } catch (err) {
    console.error("SchedulerLog unreadable:", err);
    return neverRan;
  }

  const last = rows.slice(1).filter((r) => String(r[map.index.run_at] ?? "").trim() !== "").pop();
  if (!last) return neverRan;

  const last_run_at = String(last[map.index.run_at]);
  const parsed = Date.parse(last_run_at);
  return {
    last_run_at,
    due_count: Number(last[map.index.due_count] ?? 0),
    created_count: Number(last[map.index.created_count] ?? 0),
    skipped_count: Number(last[map.index.skipped_count] ?? 0),
    error: String(last[map.index.error] ?? ""),
    stale: Number.isNaN(parsed) || nowMs - parsed > STALE_AFTER_MS,
  };
}
