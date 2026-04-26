import * as functionsV1 from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

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
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
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

// Insert a data row at position 2 (right after the header) so the sheet stays DESC.
// Ensures the header row exists first.
async function insertRowAtTop(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabName: string,
  header: string[],
  dataRow: string[]
): Promise<void> {
  const colLetter = String.fromCharCode(64 + header.length);

  // Ensure header row
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:${colLetter}1`,
  });
  if (!existing.data.values?.[0]?.[0] || existing.data.values[0][0] !== "id") {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1:${colLetter}1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }

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

// Resolve a user ID to their display name using the Users tab.
// Falls back to the raw value if no match found.
async function resolveUserDisplayNames(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  ids: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>(ids.map((id) => [id, id]));
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
    // ignore — fall back to raw IDs
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

        const paidById = String(body.paid_by ?? "");
        const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [paidById]);

        const row = [
          id,
          String(body.name ?? ""),
          String(body.amount ?? 0),
          String(body.category_id ?? ""),
          String(body.frequency ?? "monthly"),
          String(body.due_day ?? 1),
          String(body.due_month ?? ""),
          nameMap.get(paidById) ?? paidById,
          "true",
        ];

        await insertRowAtTop(sheets, spreadsheetId, SUBSCRIPTIONS_TAB, SUBSCRIPTIONS_HEADER, row);

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
    // /api/insights — POST (generates AI spending analysis)
    // -----------------------------------------------------------------------
    if (path.includes("insights")) {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Fetch all expenses and subscriptions
      const [expResponse, subResponse] = await Promise.all([
        sheets.spreadsheets.values.get({ spreadsheetId, range: `${EXPENSES_TAB}!A:H` }),
        sheets.spreadsheets.values.get({ spreadsheetId, range: `${SUBSCRIPTIONS_TAB}!A:I` }),
      ]);

      const allExpenses = (expResponse.data.values ?? []).slice(1).map(rowToExpense);
      const subscriptions = (subResponse.data.values ?? []).slice(1).map(rowToSubscription)
        .filter((s) => s.is_active);

      // Determine data tier based on how much history exists
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const lastYear = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const oldestDate = allExpenses.reduce((min, e) => {
        const d = String(e.date);
        return d < min ? d : min;
      }, String(now.toISOString().split("T")[0]));

      const daysSinceFirst = Math.floor(
        (now.getTime() - new Date(oldestDate + "T00:00:00").getTime()) / 86400000
      );

      // Require at least 3 days of data
      if (allExpenses.length === 0 || daysSinceFirst < 3) {
        res.status(200).json({ insufficient_data: true });
        return;
      }

      // Tier: "week" (<30 days), "month" (1–2 months), "full" (2+ months)
      const monthsWithData = new Set(allExpenses.map((e) => String(e.date).slice(0, 7)));
      const tier = daysSinceFirst < 30 ? "week" : monthsWithData.size < 2 ? "month" : "full";

      function monthOffset(n: number): string {
        const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      function sumByCategory(expenses: typeof allExpenses): Record<string, number> {
        const map: Record<string, number> = {};
        for (const e of expenses) {
          const cat = String(e.category_id);
          map[cat] = (map[cat] ?? 0) + Number(e.amount);
        }
        return map;
      }

      const recentExp = allExpenses.filter((e) => String(e.date).startsWith(thisMonth));
      const recentBycat = sumByCategory(recentExp.length > 0 ? recentExp : allExpenses);

      const prev3Avg: Record<string, number> = {};
      if (tier === "full") {
        const prev3ByMonth: Record<string, Record<string, number>> = {};
        for (let i = 1; i <= 3; i++) {
          const mk = monthOffset(i);
          prev3ByMonth[mk] = sumByCategory(allExpenses.filter((e) => String(e.date).startsWith(mk)));
        }
        const allCats = new Set(Object.keys(recentBycat));
        for (const cat of allCats) {
          const months = Object.values(prev3ByMonth).filter((m) => m[cat] !== undefined);
          if (months.length > 0) {
            prev3Avg[cat] = months.reduce((s, m) => s + (m[cat] ?? 0), 0) / months.length;
          }
        }
      }

      const lastYearBycat = tier === "full"
        ? sumByCategory(allExpenses.filter((e) => String(e.date).startsWith(lastYear)))
        : {};

      const subSummary = subscriptions.map((s) => ({
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
        category: s.category_id,
      }));

      const formatCats = (obj: Record<string, number>) =>
        Object.entries(obj)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  ${k}: NT$${Math.round(v).toLocaleString()}`)
          .join("\n") || "  (no data)";

      const periodLabel = tier === "week"
        ? `last ${daysSinceFirst} days`
        : now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const tierNote = tier === "week"
        ? `Note: only ${daysSinceFirst} days of data available. Skip any comparisons — just observe what's been spent so far and give early encouragement or a gentle heads-up if anything looks high.`
        : tier === "month"
        ? "Note: about 1 month of data. No multi-month comparison available — focus on this month's patterns and subscriptions."
        : "Full history available. Include month-over-month and year-over-year comparisons where relevant.";

      const prompt = `You are a warm, knowledgeable financial advisor for a household of two in Taiwan. Analyse their spending and give concise, practical, kind advice — like a trusted friend who knows about money. Not clinical. Not cheerleader-y.

${tierNote}

## Spending so far (${periodLabel}) by category
${formatCats(recentBycat)}

${tier === "full" ? `## Previous 3-month average by category\n${formatCats(prev3Avg)}\n\n## Same month last year by category\n${formatCats(lastYearBycat)}` : ""}

## Active subscriptions
${subSummary.length > 0
  ? subSummary.map((s) => `  ${s.name}: NT$${Number(s.amount).toLocaleString()}/${s.frequency} (${s.category})`).join("\n")
  : "  (none)"}

Write a short insights report with exactly these sections:
1. **Spending overview** — one sentence summary appropriate to the data available
2. **Watch out** — top 2–3 categories that look high or worth watching, with a specific warm suggestion. Include subscriptions if relevant.
3. **Doing well** — 1–2 positive observations or encouragements
Keep the total response under 250 words. Use NT$ for amounts. Be specific to their actual categories.`;

      const client = new Anthropic({ apiKey: anthropicKey.value() });
      const message = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      res.status(200).json({ insights: text });
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

      const allRows = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A:H`,
      });
      const rows = allRows.data.values ?? [];
      const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === targetId);
      if (rowIndex === -1) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }

      const existing = rows[rowIndex];
      let paidByDisplay = existing[4] ?? "";
      if (body.paid_by !== undefined) {
        const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [String(body.paid_by)]);
        paidByDisplay = nameMap.get(String(body.paid_by)) ?? String(body.paid_by);
      }

      const updated = [
        existing[0],
        body.date !== undefined ? String(body.date) : (existing[1] ?? ""),
        body.amount !== undefined ? String(body.amount) : (existing[2] ?? ""),
        body.category_id !== undefined ? String(body.category_id) : (existing[3] ?? ""),
        paidByDisplay,
        existing[5] ?? "",
        body.notes !== undefined ? String(body.notes) : (existing[6] ?? ""),
        existing[7] ?? "",
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A${rowIndex + 1}:H${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [updated] },
      });

      res.status(200).json(rowToExpense(updated));
      return;
    }

    // DELETE — remove an expense by id
    if (req.method === "DELETE") {
      const body = req.body as Record<string, unknown>;
      const targetId = String(body.id ?? "");
      if (!targetId) { res.status(400).json({ error: "id is required" }); return; }

      const allRows = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A:A`,
      });
      const rows = allRows.data.values ?? [];
      const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === targetId);
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
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${EXPENSES_TAB}!A:H`,
      });
      const rows = response.data.values ?? [];
      res.status(200).json(rows.slice(1).map(rowToExpense));
      return;
    }

    // POST — add a new expense
    if (req.method === "POST") {
      const body = req.body as Record<string, unknown>;
      const id = `exp-${Date.now()}`;
      const created_at = new Date().toISOString();

      // Resolve user IDs to display names for the sheet
      const paidById = String(body.paid_by ?? "");
      const createdById = String(body.created_by ?? "");
      const nameMap = await resolveUserDisplayNames(sheets, spreadsheetId, [paidById, createdById]);

      const row = [
        id,
        String(body.date ?? new Date().toISOString().split("T")[0]),
        String(body.amount ?? 0),
        String(body.category_id ?? ""),
        nameMap.get(paidById) ?? paidById,
        nameMap.get(createdById) ?? createdById,
        String(body.notes ?? ""),
        created_at,
      ];

      await insertRowAtTop(sheets, spreadsheetId, EXPENSES_TAB, EXPENSES_HEADER, row);

      res.status(201).json(rowToExpense(row));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("API error:", err);
    res.status(503).json({ error: "Service error", detail: String(err) });
  }
});
