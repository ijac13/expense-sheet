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
  const [rawTab, a1] = range.split("!");
  // A tab name containing a space or a digit must be quoted in a real A1 range
  // (`'Migration 2023-2024'!A:P`), so strip the quotes the caller correctly added.
  const tab = /^'.*'$/.test(rawTab) ? rawTab.slice(1, -1) : rawTab;
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
  // Every values write with the option it carried, so a test can assert the
  // sheet was told to store text literally. A silent switch to USER_ENTERED
  // turns a note beginning "=" into a formula, which no in-memory grid
  // comparison can see.
  const valueWrites = [];

  const gridFor = (tab) => {
    if (!grids[tab]) throw new Error(`Unit tests: no such tab "${tab}"`);
    return grids[tab];
  };

  const writeRange = (range, values) => {
    const { tab, from, to } = parseRange(range);
    const grid = gridFor(tab);
    // Sheets 400s on "tried writing to column X" rather than silently
    // widening the range. Without this, a write range one column short of
    // the payload would look like it worked.
    const width = to.col - from.col + 1;
    const widest = Math.max(...values.map((v) => v.length));
    if (widest > width) {
      throw new Error(`Requested writing within range ${range}, but tried writing ${widest} columns`);
    }
    const firstRow = (from.row ?? 1) - 1;
    values.forEach((cells, r) => {
      const rowIdx = firstRow + r;
      while (grid.length <= rowIdx) grid.push([]);
      cells.forEach((v, i) => {
        grid[rowIdx][from.col + i] = v;
      });
    });
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
          if (req.addSheet) {
            const title = req.addSheet.properties.title;
            requests.push(`ADDSHEET ${title}`);
            grids[title] = [];
            sheetIds[title] = nextSheetId++;
            continue;
          }
          if (req.updateCells) {
            const { start, rows } = req.updateCells;
            const title = Object.keys(sheetIds).find((t) => sheetIds[t] === start.sheetId);
            const grid = gridFor(title);
            requests.push(`UPDATECELLS ${title} @${start.rowIndex} x${rows.length}`);
            rows.forEach(({ values }, r) => {
              const rowIdx = start.rowIndex + r;
              while (grid.length <= rowIdx) grid.push([]);
              values.forEach((v, c) => {
                grid[rowIdx][start.columnIndex + c] = v.userEnteredValue.stringValue;
              });
            });
            continue;
          }
          const spec = req.insertDimension ?? req.deleteDimension;
          const title = Object.keys(sheetIds).find((t) => sheetIds[t] === spec.range.sheetId);
          const grid = gridFor(title);
          const count = spec.range.endIndex - spec.range.startIndex;
          if (req.insertDimension) {
            requests.push(`INSERT ${title} @${spec.range.startIndex} x${count}`);
            grid.splice(spec.range.startIndex, 0, ...Array.from({ length: count }, () => []));
          } else {
            requests.push(`DELETE ${title} @${spec.range.startIndex}`);
            grid.splice(spec.range.startIndex, count);
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
        update: async ({ range, requestBody, valueInputOption }) => {
          requests.push(`UPDATE ${range}`);
          valueWrites.push({ range, valueInputOption, values: requestBody.values });
          writeRange(range, requestBody.values);
          return {};
        },
        // values.batchUpdate is one HTTP call carrying many ranges; each lands
        // exactly as the single-range update would, including the over-wide 400.
        batchUpdate: async ({ requestBody }) => {
          for (const entry of requestBody.data) {
            requests.push(`BATCHUPDATE ${entry.range}`);
            writeRange(entry.range, entry.values);
          }
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

  // Removing a tab takes it out of the metadata too, so code that checks for a
  // tab before reading it sees what the real API would report.
  const deleteTab = (name) => {
    delete grids[name];
    delete sheetIds[name];
  };

  return { grids, requests, valueWrites, sheets, deleteTab };
}

// ---------------------------------------------------------------------------
// Firebase Auth stub
// ---------------------------------------------------------------------------
// A fake ID token is base64 of its own claims, so a test states the identity it
// wants inline instead of registering tokens up front. Anything that does not
// decode to claims throws, which is exactly how a real expired/tampered/wrong-
// audience token surfaces to us: verifyIdToken rejects and we never see why.
const AUTHORIZED_EMAIL = "authorized-user1@example.test";
const OTHER_AUTHORIZED_EMAIL = "authorized-user2@example.test";
const AUTHORIZED_EMAILS = `${AUTHORIZED_EMAIL}, ${OTHER_AUTHORIZED_EMAIL}`;

function fakeToken(claims) {
  return Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
}

const VALID_TOKEN = fakeToken({ email: AUTHORIZED_EMAIL, email_verified: true });

/** Records every verifyIdToken call, so a test can assert it was never reached. */
function makeAuthStub() {
  const verifyCalls = [];
  const auth = {
    verifyIdToken: async (token) => {
      verifyCalls.push(token);
      let claims;
      try {
        claims = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
      } catch {
        throw new Error("Firebase ID token has invalid signature");
      }
      if (!claims || typeof claims !== "object") throw new Error("Firebase ID token is malformed");
      return claims;
    },
  };
  return { auth, verifyCalls };
}

function installAuthStub(authStub) {
  const appId = require.resolve("firebase-admin/app");
  require.cache[appId] = {
    id: appId,
    filename: appId,
    loaded: true,
    // getApps() reports an initialized app so the handler never calls
    // initializeApp(), which would look for real credentials.
    exports: { initializeApp: () => ({}), getApps: () => [{}] },
  };
  const authId = require.resolve("firebase-admin/auth");
  require.cache[authId] = {
    id: authId,
    filename: authId,
    loaded: true,
    exports: { getAuth: () => authStub.auth },
  };
}

/** Install the stub, then load the compiled handler on top of it. */
function loadApi(sheets, authStub = makeAuthStub()) {
  const id = require.resolve("googleapis");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { google: { auth: { getClient: async () => ({}) }, sheets: () => sheets } },
  };
  installAuthStub(authStub);
  process.env.SPREADSHEET_ID = "sheet-under-test";
  process.env.AUTHORIZED_EMAILS = AUTHORIZED_EMAILS;
  delete require.cache[require.resolve("../lib/index.js")];
  delete require.cache[require.resolve("../lib/auth.js")];
  return require("../lib/index.js").api;
}

// `headers` left undefined means "an ordinary authorized caller" — that default
// is what keeps the pre-auth call sites asserting behaviour rather than auth.
// Passing an explicit object (including {}) uses it verbatim.
function call(api, method, path, body, headers) {
  return new Promise((resolve) => {
    const sent = {};
    const res = {
      set(key, value) {
        sent[key] = value;
        return this;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.code, body: payload, headers: sent });
        return this;
      },
      send(payload) {
        resolve({ status: this.code, body: payload, headers: sent });
        return this;
      },
    };
    const reqHeaders = headers ?? { authorization: `Bearer ${VALID_TOKEN}` };
    api({ method, path, body, headers: reqHeaders }, res);
  });
}

module.exports = {
  COL,
  parseRange,
  makeSheets,
  loadApi,
  call,
  makeAuthStub,
  fakeToken,
  AUTHORIZED_EMAIL,
  OTHER_AUTHORIZED_EMAIL,
  AUTHORIZED_EMAILS,
  VALID_TOKEN,
};
