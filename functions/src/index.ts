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
const SHEET_NAME = "Expenses";
const HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];

function setCors(res: { set: (key: string, value: string) => void }) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

// ---------------------------------------------------------------------------
// HTTP API function
// ---------------------------------------------------------------------------
export const api = onRequest(async (req, res) => {
  setCors(res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    res.status(500).json({ error: "SPREADSHEET_ID not configured" });
    return;
  }

  // Route: only /api/expenses is handled
  const path = (req.path ?? "").replace(/\/$/, "");
  if (path !== "/expenses" && path !== "") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  try {
    const sheets = await getSheetsClient();

    // -----------------------------------------------------------------------
    // GET — return all expense rows
    // -----------------------------------------------------------------------
    if (req.method === "GET") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A:H`,
      });
      const rows = response.data.values ?? [];

      // Skip header row
      const expenses = rows.slice(1).map(rowToExpense);
      res.status(200).json(expenses);
      return;
    }

    // -----------------------------------------------------------------------
    // POST — append one row
    // -----------------------------------------------------------------------
    if (req.method === "POST") {
      const body = req.body as {
        date?: string;
        amount?: number;
        category_id?: string;
        paid_by?: string;
        created_by?: string;
        notes?: string;
      };

      const id = `exp-${Date.now()}`;
      const created_at = new Date().toISOString();
      const row = [
        id,
        body.date ?? new Date().toISOString().split("T")[0],
        String(body.amount ?? 0),
        body.category_id ?? "",
        body.paid_by ?? "",
        body.created_by ?? "",
        body.notes ?? "",
        created_at,
      ];

      // Ensure header row exists — check if sheet has any data
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:H1`,
      });
      const firstRow = existing.data.values?.[0];
      if (!firstRow || firstRow[0] !== "id") {
        // Write header first
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${SHEET_NAME}!A1:H1`,
          valueInputOption: "RAW",
          requestBody: { values: [HEADER] },
        });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_NAME}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });

      const expense = rowToExpense(row);
      res.status(201).json(expense);
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("API error:", err);
    res.status(503).json({ error: "Service error", detail: String(err) });
  }
});
