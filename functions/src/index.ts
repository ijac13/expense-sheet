import * as functionsV1 from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { google } from "googleapis";

// ---------------------------------------------------------------------------
// Legacy health check — kept for backwards compatibility
// ---------------------------------------------------------------------------
export const helloWorld = functionsV1.https.onRequest((request, response) => {
  response.json({ status: "ok", app: "expense-tracker" });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const EXPENSES_TAB = "Expenses";
const USERS_TAB = "Users";
const SUBSCRIPTIONS_TAB = "Subscriptions";

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const SUBSCRIPTIONS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];

function setCors(res: { set: (key: string, value: string) => void }) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

async function getSheetsClient() {
  const auth = await google.auth.getClient({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function rowToExpense(row: (string | null | undefined)[]): Record<string, unknown> {
  return {
    id: row[0] ?? "",
    date: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    category_id: row[3] ?? "",
    paid_by: row[4] ?? "",
    created_by: row[5] ?? "",
    notes: row[6] ?? "",
    created_at: row[7] ?? "",
  };
}

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

function rowToSubscription(row: (string | null | undefined)[]): Record<string, unknown> {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    category_id: row[3] ?? "",
    frequency: row[4] ?? "monthly",
    due_day: Number(row[5] ?? 1),
    due_month: row[6] ? Number(row[6]) : undefined,
    paid_by: row[7] ?? "",
    is_active: row[8] !== "false",
  };
}

// ---------------------------------------------------------------------------
// HTTP API function
// ---------------------------------------------------------------------------
export const api = onRequest(async (req, res) => {
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
    // /api/users — GET
    // -----------------------------------------------------------------------
    if (path.includes("users")) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${USERS_TAB}!A:C`,
      });
      const rows = response.data.values ?? [];
      res.status(200).json(rows.slice(1).map(rowToUser));
      return;
    }

    // -----------------------------------------------------------------------
    // /api/subscriptions — GET / POST / PATCH
    // -----------------------------------------------------------------------
    if (path.includes("subscriptions")) {
      // GET — return all subscriptions
      if (req.method === "GET") {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A:I`,
        });
        const rows = response.data.values ?? [];
        res.status(200).json(rows.slice(1).map(rowToSubscription));
        return;
      }

      // POST — add a new subscription
      if (req.method === "POST") {
        const body = req.body as Record<string, unknown>;
        const id = `sub-${Date.now()}`;
        const row = [
          id,
          String(body.name ?? ""),
          String(body.amount ?? 0),
          String(body.category_id ?? ""),
          String(body.frequency ?? "monthly"),
          String(body.due_day ?? 1),
          String(body.due_month ?? ""),
          String(body.paid_by ?? ""),
          "true",
        ];

        // Ensure header row
        const existing = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A1:I1`,
        });
        const firstRow = existing.data.values?.[0];
        if (!firstRow || firstRow[0] !== "id") {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SUBSCRIPTIONS_TAB}!A1:I1`,
            valueInputOption: "RAW",
            requestBody: { values: [SUBSCRIPTIONS_HEADER] },
          });
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A:I`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [row] },
        });

        res.status(201).json(rowToSubscription(row));
        return;
      }

      // PATCH — update or cancel a subscription by id
      if (req.method === "PATCH") {
        const body = req.body as Record<string, unknown>;
        const targetId = String(body.id ?? "");

        // Find the row
        const allRows = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A:I`,
        });
        const rows = allRows.data.values ?? [];
        const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === targetId);
        if (rowIndex === -1) {
          res.status(404).json({ error: "Subscription not found" });
          return;
        }

        const existing = rows[rowIndex];
        const updated = [
          existing[0],
          body.name !== undefined ? String(body.name) : existing[1],
          existing[2],
          body.category_id !== undefined ? String(body.category_id) : existing[3],
          existing[4],
          body.due_day !== undefined ? String(body.due_day) : existing[5],
          body.due_month !== undefined ? String(body.due_month) : existing[6],
          existing[7],
          body.is_active !== undefined ? String(body.is_active) : existing[8],
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${SUBSCRIPTIONS_TAB}!A${rowIndex + 1}:I${rowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: { values: [updated] },
        });

        res.status(200).json(rowToSubscription(updated));
        return;
      }

      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // -----------------------------------------------------------------------
    // /api (expenses) — GET / POST
    // -----------------------------------------------------------------------
    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A:H`,
      });
      const rows = response.data.values ?? [];
      res.status(200).json(rows.slice(1).map(rowToExpense));
      return;
    }

    if (req.method === "POST") {
      const body = req.body as Record<string, unknown>;
      const id = `exp-${Date.now()}`;
      const created_at = new Date().toISOString();
      const row = [
        id,
        String(body.date ?? new Date().toISOString().split("T")[0]),
        String(body.amount ?? 0),
        String(body.category_id ?? ""),
        String(body.paid_by ?? ""),
        String(body.created_by ?? ""),
        String(body.notes ?? ""),
        created_at,
      ];

      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A1:H1`,
      });
      const firstRow = existing.data.values?.[0];
      if (!firstRow || firstRow[0] !== "id") {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${EXPENSES_TAB}!A1:H1`,
          valueInputOption: "RAW",
          requestBody: { values: [EXPENSES_HEADER] },
        });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

      res.status(201).json(rowToExpense(row));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("API error:", err);
    res.status(503).json({ error: "Service error", detail: String(err) });
  }
});
