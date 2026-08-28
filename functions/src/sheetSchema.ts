// Resolves spreadsheet columns by the header row's own names instead of by a
// fixed letter or index. A column can be added, moved or renamed in the Sheet
// without silently landing data in the wrong field.
//
// The map is built per request from the rows already fetched — never cached.
// A Function instance stays warm for minutes, so a cached map would keep
// writing to pre-reorder positions: exactly the corruption this module exists
// to prevent, but intermittent and therefore harder to spot.

export type Cell = string | null | undefined;
export type Row = Cell[];

export interface TabSpec {
  tab: string;
  required: string[];
  optional: string[];
}

export const EXPENSES_SPEC: TabSpec = {
  tab: "Expenses",
  required: ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"],
  optional: [],
};

export const CATEGORIES_SPEC: TabSpec = {
  tab: "Categories",
  // gov_category and note are optional: staging's Categories tab has neither,
  // and production has `note` data under a blank H1. Requiring them would 500
  // every categories request on both sheets.
  required: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active"],
  optional: ["gov_category", "note"],
};

export const SUBSCRIPTIONS_SPEC: TabSpec = {
  tab: "Subscriptions",
  // start_date, end_date and notes are optional for the same reason gov_category
  // is on Categories: none of these headers exists on the live tabs yet, and a
  // required one absent from row 1 throws below — 500ing every subscriptions
  // request, every insights request and the daily scheduler the instant this
  // deploys. The write paths create the headers on demand instead.
  required: ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"],
  optional: ["start_date", "end_date", "notes"],
};

// A type alias rather than an interface so it keeps an implicit index signature
// and stays assignable to the `Record<string, unknown>` rows insights.ts takes.
export type Subscription = {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  frequency: string;
  due_day: number;
  due_month: number | undefined;
  paid_by: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  notes: string;
};

export class SheetSchemaError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "SheetSchemaError";
    this.status = status;
  }
}

export interface ColumnMap {
  tab: string;
  index: Record<string, number>;
  width: number;
}

function normalizeHeader(cell: Cell): string {
  return String(cell ?? "").trim().toLowerCase();
}

// 0 -> "A", 25 -> "Z", 26 -> "AA". Replaces String.fromCharCode(64 + n), which
// produced "[" and beyond once a tab passed 26 columns.
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// Builds the field-name -> column-index map from row 1 of `rows`.
export function buildColumnMap(rows: Row[] | undefined, spec: TabSpec): ColumnMap {
  const header = rows?.[0];
  if (!header || header.every((c) => normalizeHeader(c) === "")) {
    throw new SheetSchemaError(`${spec.tab} tab: no header row found in row 1.`);
  }

  const known = new Set([...spec.required, ...spec.optional]);
  const index: Record<string, number> = {};
  header.forEach((cell, i) => {
    const name = normalizeHeader(cell);
    // A blank header, or one naming no expected field (a typo such as `udpate`),
    // is an unknown column: never matched, never fuzzy-matched, always preserved.
    if (!known.has(name)) return;
    if (index[name] !== undefined) {
      throw new SheetSchemaError(
        `${spec.tab} tab: duplicate column header "${name}" in columns ` +
        `${columnLetter(index[name])} and ${columnLetter(i)}. Column names must be unique.`
      );
    }
    index[name] = i;
  });

  const missing = spec.required.filter((f) => index[f] === undefined);
  if (missing.length > 0) {
    throw new SheetSchemaError(
      `${spec.tab} tab: missing required column header${missing.length > 1 ? "s" : ""} ` +
      `${missing.map((f) => `"${f}"`).join(", ")}. Found: ` +
      `${header.map((c) => `"${String(c ?? "")}"`).join(", ")}.`
    );
  }

  return { tab: spec.tab, index, width: header.length };
}

export function hasColumn(map: ColumnMap, field: string): boolean {
  return map.index[field] !== undefined;
}

// The raw cell for a field, or undefined when the column is absent or the row
// is shorter than it (Sheets trims trailing blanks). Callers apply the field's
// own default, so `?? null` and `?? ""` stay distinguishable.
export function cell(row: Row, map: ColumnMap, field: string): Cell {
  const i = map.index[field];
  if (i === undefined) return undefined;
  return row[i];
}

// Both the HTTP API and the daily scheduler read subscriptions through this one
// function, so "active" cannot mean two different things. The Apps Script it
// replaced had its own check against the boolean `true`, but every `is_active`
// cell holds the string "true" — so it skipped all 31 rows, silently, for months.
export function rowToSubscription(row: Row, map: ColumnMap): Subscription {
  const dueMonth = cell(row, map, "due_month");
  return {
    id: String(cell(row, map, "id") ?? ""),
    name: String(cell(row, map, "name") ?? ""),
    amount: Number(cell(row, map, "amount") ?? 0),
    category_id: String(cell(row, map, "category_id") ?? ""),
    frequency: String(cell(row, map, "frequency") ?? "monthly"),
    due_day: Number(cell(row, map, "due_day") ?? 1),
    due_month: dueMonth ? Number(dueMonth) : undefined,
    paid_by: String(cell(row, map, "paid_by") ?? ""),
    is_active: cell(row, map, "is_active") !== "false",
    // "" for all three unset shapes — column absent, cell blank, row truncated
    // by Sheets' trailing-blank trimming — so "has this ended?" never has to
    // distinguish null from undefined from empty.
    start_date: String(cell(row, map, "start_date") ?? ""),
    end_date: String(cell(row, map, "end_date") ?? ""),
    notes: String(cell(row, map, "notes") ?? ""),
  };
}

// The row to write back: every existing cell carried forward by position, with
// only the named fields overwritten. Unknown columns survive by construction
// rather than by remembering to copy them.
export function buildWriteRow(
  existing: Row,
  map: ColumnMap,
  updates: Record<string, string>
): string[] {
  const fields = Object.keys(updates);
  const missing = fields.filter((f) => !hasColumn(map, f));
  if (missing.length > 0) {
    throw new SheetSchemaError(
      `${map.tab} tab: cannot write ${missing.map((f) => `"${f}"`).join(", ")} — ` +
      `no column with that header exists. Add the header to row 1 of the ${map.tab} tab first.`,
      400
    );
  }

  const width = Math.max(
    existing.length,
    map.width,
    ...fields.map((f) => map.index[f] + 1)
  );
  const out: string[] = [];
  for (let i = 0; i < width; i++) out.push(String(existing[i] ?? ""));
  for (const field of fields) out[map.index[field]] = updates[field];
  return out;
}
