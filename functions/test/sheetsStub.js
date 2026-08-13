// An in-memory Google Sheets that emulates the behaviours the column resolver
// depends on, so tests land on the bytes written to the sheet and the JSON
// returned — not on the source:
//   - A1 range addressing, including open ranges (`A:Z`) and single columns (`E:E`)
//   - trailing-blank trimming: a row whose last cells are empty comes back SHORT
//   - a 400 when a write payload is wider than its range, rather than silently widening
//   - insertDimension / deleteDimension row shifting
const COL = (letters) => {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function parseRange(range) {
  const [tab, a1] = range.split("!");
  const [from, to] = a1.split(":");
  const m = (s) => {
    const g = /^([A-Z]+)(\d+)?$/.exec(s);
    return { col: COL(g[1]), row: g[2] ? Number(g[2]) : null };
  };
  return { tab, from: m(from), to: m(to) };
}

/**
 * `tabs` maps a tab name to { header, rows }. The header is written as-is, so a
 * 7-cell header on an 8-column tab leaves H1 genuinely blank.
 */
function makeSheets(tabs) {
  const grids = {};
  const sheetIds = {};
  let nextSheetId = 100;
  for (const [name, { header, rows }] of Object.entries(tabs)) {
    grids[name] = [header.slice(), ...rows.map((r) => r.slice())];
    sheetIds[name] = nextSheetId++;
  }
  const requests = [];

  const gridFor = (tab) => {
    if (!grids[tab]) throw new Error(`Unit tests: no such tab "${tab}"`);
    return grids[tab];
  };

  const sheets = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: Object.entries(sheetIds).map(([title, sheetId]) => ({ properties: { title, sheetId } })),
        },
      }),
      batchUpdate: async ({ requestBody }) => {
        for (const req of requestBody.requests) {
          const spec = req.insertDimension ?? req.deleteDimension;
          const title = Object.keys(sheetIds).find((t) => sheetIds[t] === spec.range.sheetId);
          const grid = gridFor(title);
          if (req.insertDimension) {
            requests.push(`INSERT ${title} @${spec.range.startIndex}`);
            grid.splice(spec.range.startIndex, 0, []);
          } else {
            requests.push(`DELETE ${title} @${spec.range.startIndex}`);
            grid.splice(spec.range.startIndex, spec.range.endIndex - spec.range.startIndex);
          }
        }
        return {};
      },
      values: {
        get: async ({ range }) => {
          requests.push(`GET ${range}`);
          const { tab, from, to } = parseRange(range);
          const grid = gridFor(tab);
          const first = (from.row ?? 1) - 1;
          const last = to.row ? to.row - 1 : grid.length - 1;
          const values = grid.slice(first, last + 1).map((row) => {
            const cells = [];
            for (let c = from.col; c <= to.col; c++) cells.push(row[c] ?? "");
            // Sheets omits trailing empty cells rather than padding them.
            while (cells.length && cells[cells.length - 1] === "") cells.pop();
            return cells;
          });
          return { data: { values } };
        },
        update: async ({ range, requestBody }) => {
          requests.push(`UPDATE ${range}`);
          const { tab, from, to } = parseRange(range);
          const grid = gridFor(tab);
          // Sheets 400s on "tried writing to column X" rather than silently
          // widening the range. Without this, a write range one column short of
          // the payload would look like it worked.
          const width = to.col - from.col + 1;
          if (requestBody.values[0].length > width) {
            throw new Error(`Requested writing within range ${range}, but tried writing ${requestBody.values[0].length} columns`);
          }
          const rowIdx = (from.row ?? 1) - 1;
          while (grid.length <= rowIdx) grid.push([]);
          requestBody.values[0].forEach((v, i) => {
            grid[rowIdx][from.col + i] = v;
          });
          return {};
        },
        append: async ({ range, requestBody }) => {
          requests.push(`APPEND ${range}`);
          gridFor(parseRange(range).tab).push(requestBody.values[0].slice());
          return {};
        },
      },
    },
  };

  return { grids, requests, sheets };
}

/** Install the stub, then load the compiled handler on top of it. */
function loadApi(sheets) {
  const id = require.resolve("googleapis");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { google: { auth: { getClient: async () => ({}) }, sheets: () => sheets } },
  };
  process.env.SPREADSHEET_ID = "sheet-under-test";
  delete require.cache[require.resolve("../lib/index.js")];
  return require("../lib/index.js").api;
}

function call(api, method, path, body) {
  return new Promise((resolve) => {
    const res = {
      set() {},
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.code, body: payload });
        return this;
      },
      send(payload) {
        resolve({ status: this.code, body: payload });
        return this;
      },
    };
    api({ method, path, body }, res);
  });
}

module.exports = { COL, parseRange, makeSheets, loadApi, call };
