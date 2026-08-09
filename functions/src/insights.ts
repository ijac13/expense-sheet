// Period maths and prompt assembly for /api/insights.
// Kept out of index.ts so the analysis window can be exercised without Sheets
// or an Anthropic key.

export type InsightsPeriod =
  | { type: "monthly"; year: number; month: number }
  | { type: "annual"; year: number };

// Rows as they come back from the Sheets mapper: every field is read
// defensively, so the row shape is not constrained here.
type SheetRow = Record<string, unknown>;

export type InsightsPromptResult =
  | { kind: "insufficient"; days: number }
  | { kind: "prompt"; prompt: string; tier: "week" | "month" | "full"; periodLabel: string };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_MS = 86400000;

export function parseInsightsPeriod(body: unknown): InsightsPeriod | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  const year = raw.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 1900 || year > 9999) return null;

  if (raw.period === "annual") return { type: "annual", year };

  if (raw.period === "monthly") {
    const month = raw.month;
    if (typeof month !== "number" || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return { type: "monthly", year, month };
  }

  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Month key `YYYY-MM` for the requested month shifted back by `n` months.
// Integer arithmetic rather than `new Date(y, m - n)` so two-digit years are
// never remapped into the 1900s.
function monthKeyOffset(year: number, month: number, n: number): string {
  const index = year * 12 + (month - 1) - n;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

function periodPrefix(period: InsightsPeriod): string {
  return period.type === "monthly" ? `${period.year}-${pad2(period.month)}` : String(period.year);
}

// First month of the requested period, used as the cutoff for "history before
// this period".
function periodStartMonthKey(period: InsightsPeriod): string {
  return period.type === "monthly" ? `${period.year}-${pad2(period.month)}` : `${period.year}-01`;
}

// Last instant of the requested period, capped at `nowMs` so a partial current
// period is not credited with days that have not happened yet.
function periodEndMs(period: InsightsPeriod, nowMs: number): number {
  const end = period.type === "monthly"
    ? Date.UTC(period.year, period.month, 1) - DAY_MS
    : Date.UTC(period.year + 1, 0, 1) - DAY_MS;
  return Math.min(end, nowMs);
}

export function insightsPeriodLabel(period: InsightsPeriod): string {
  return period.type === "monthly"
    ? `${MONTH_NAMES[period.month - 1]} ${period.year}`
    : String(period.year);
}

function sumByCategory(expenses: SheetRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    const cat = String(e.category_id);
    map[cat] = (map[cat] ?? 0) + Number(e.amount);
  }
  return map;
}

function formatCats(obj: Record<string, number>): string {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  ${k}: NT$${Math.round(v).toLocaleString()}`)
    .join("\n") || "  (no data)";
}

export function buildInsightsPrompt(input: {
  expenses: SheetRow[];
  subscriptions: SheetRow[];
  period: InsightsPeriod;
  nowMs: number;
}): InsightsPromptResult {
  const { expenses, subscriptions, period, nowMs } = input;

  const inPeriod = expenses.filter((e) => String(e.date).startsWith(periodPrefix(period)));
  if (inPeriod.length === 0) return { kind: "insufficient", days: 0 };

  // Sheet rows can carry a blank or truncated date; those must not become the
  // start of history.
  const dates = expenses.map((e) => String(e.date)).filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d));
  if (dates.length === 0) return { kind: "insufficient", days: 0 };
  const oldest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);

  const days = Math.floor(
    (periodEndMs(period, nowMs) - Date.parse(oldest.slice(0, 10) + "T00:00:00Z")) / DAY_MS
  );
  if (days < 7) return { kind: "insufficient", days: Math.max(days, 0) };

  const startKey = periodStartMonthKey(period);
  const priorMonths = new Set(
    expenses.map((e) => String(e.date).slice(0, 7)).filter((k) => k < startKey)
  );
  const tier = days < 30 ? "week" : priorMonths.size < 3 ? "month" : "full";

  const byCat = sumByCategory(inPeriod);
  const hasData = (prefix: string) => expenses.some((e) => String(e.date).startsWith(prefix));

  // Comparison windows, all derived from the requested period. A window with no
  // stored data is left out of the prompt rather than sent as zeroes.
  let comparisonBlocks = "";
  if (tier === "full" && period.type === "monthly") {
    const prev3Keys = [1, 2, 3].map((n) => monthKeyOffset(period.year, period.month, n));
    if (prev3Keys.some(hasData)) {
      const prev3ByMonth = prev3Keys.map((k) =>
        sumByCategory(expenses.filter((e) => String(e.date).startsWith(k)))
      );
      const prev3Avg: Record<string, number> = {};
      for (const cat of Object.keys(byCat)) {
        const months = prev3ByMonth.filter((m) => m[cat] !== undefined);
        if (months.length > 0) {
          prev3Avg[cat] = months.reduce((s, m) => s + (m[cat] ?? 0), 0) / months.length;
        }
      }
      comparisonBlocks += `## Previous 3-month average by category\n${formatCats(prev3Avg)}\n\n`;
    }

    const lastYearKey = monthKeyOffset(period.year, period.month, 12);
    if (hasData(lastYearKey)) {
      const lastYearByCat = sumByCategory(expenses.filter((e) => String(e.date).startsWith(lastYearKey)));
      comparisonBlocks += `## Same month last year by category\n${formatCats(lastYearByCat)}\n\n`;
    }
  }
  if (tier === "full" && period.type === "annual") {
    const priorYearKey = String(period.year - 1);
    if (hasData(priorYearKey)) {
      const priorYearByCat = sumByCategory(expenses.filter((e) => String(e.date).startsWith(priorYearKey)));
      comparisonBlocks += `## Previous year (${priorYearKey}) by category\n${formatCats(priorYearByCat)}\n\n`;
    }
  }

  const subSummary = subscriptions.map((s) =>
    `  ${s.name}: NT$${Number(s.amount).toLocaleString()}/${s.frequency} (${s.category_id})`
  );

  const periodLabel = insightsPeriodLabel(period);

  const tierNote = tier === "week"
    ? `Note: only ${days} days of data available. Skip any comparisons — just observe what's been spent so far and give early encouragement or a gentle heads-up if anything looks high.`
    : tier === "month"
    ? "Note: about 1 month of data. No multi-month comparison available — focus on this month's patterns and subscriptions."
    : "Full history available. Include month-over-month and year-over-year comparisons where relevant.";

  const prompt = `You are a warm, knowledgeable financial advisor for a household of two in Taiwan. Analyse their spending and give concise, practical, kind advice — like a trusted friend who knows about money. Not clinical. Not cheerleader-y.

Household context (do NOT flag these as concerns — they are intentional):
- 4 mobile phone plans (one per family member across the extended family)
- A gym subscription for the captain's parents (intentional support expense)
- Multiple digital subscriptions are normal for this household size

${tierNote}

## Spending so far (${periodLabel}) by category
${formatCats(byCat)}

${comparisonBlocks}## Active subscriptions
${subSummary.length > 0 ? subSummary.join("\n") : "  (none)"}

Write a short insights report with exactly these sections:
1. **Spending overview** — one sentence summary appropriate to the data available
2. **Watch out** — top 2–3 categories that look high or worth watching, with a specific warm suggestion. Include subscriptions if relevant.
3. **Doing well** — 1–2 positive observations or encouragements
Keep the total response under 250 words. Use NT$ for amounts. Be specific to their actual categories.`;

  return { kind: "prompt", prompt, tier, periodLabel };
}
