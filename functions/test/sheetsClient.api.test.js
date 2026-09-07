// Run with: npm run build && node --test test/
// Entity 063, AC-7. Drives the REAL exported `api` handler twice against a
// googleapis stub that counts calls to google.auth.getClient(), so the
// assertion lands on whether the backend actually re-minted an OAuth token on
// a second request — not on reading the source. See test/sheetsStub.js for
// the shared stub pieces reused here.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, call, makeAuthStub, installAuthStub, AUTHORIZED_EMAILS } = require("./sheetsStub");

const HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category"];

/** Same shape as sheetsStub's loadApi, but with a googleapis stub that counts
 * google.auth.getClient() calls instead of one that resolves silently. */
function loadApiCountingAuth(sheets) {
  let getClientCalls = 0;
  const id = require.resolve("googleapis");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: {
      google: {
        auth: { getClient: async () => { getClientCalls++; return {}; } },
        sheets: () => sheets,
      },
    },
  };
  installAuthStub(makeAuthStub());
  process.env.SPREADSHEET_ID = "sheet-under-test";
  process.env.AUTHORIZED_EMAILS = AUTHORIZED_EMAILS;
  delete require.cache[require.resolve("../lib/index.js")];
  delete require.cache[require.resolve("../lib/auth.js")];
  const api = require("../lib/index.js").api;
  return { api, getClientCalls: () => getClientCalls };
}

test("AC-7: a warm instance reuses one authenticated Sheets client across requests", async () => {
  const { sheets } = makeSheets({ Categories: { header: HEADER, rows: [] } });
  const { api, getClientCalls } = loadApiCountingAuth(sheets);

  const first = await call(api, "GET", "/api/categories");
  assert.equal(first.status, 200);
  assert.equal(getClientCalls(), 1, "the first request on a cold module mints the client");

  const second = await call(api, "GET", "/api/categories");
  assert.equal(second.status, 200);
  assert.equal(getClientCalls(), 1, "a second request on the same warm instance did not call google.auth.getClient() again");
});

test("AC-7: different endpoints on the same warm instance still share the one client", async () => {
  const { sheets } = makeSheets({
    Categories: { header: HEADER, rows: [] },
    Users: { header: ["id", "name", "email"], rows: [] },
  });
  const { api, getClientCalls } = loadApiCountingAuth(sheets);

  await call(api, "GET", "/api/categories");
  await call(api, "GET", "/api/users");
  assert.equal(getClientCalls(), 1, "two different routes on one warm instance still mint the client only once");
});
