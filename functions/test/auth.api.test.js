// Run with: npm run build && node --test test/
// Drives the REAL exported `api` handler with the real auth gate in front of it.
// The sheet fixture is the instrument: a rejected request must leave the grid
// byte-identical AND issue no request to the Sheets client, which is what proves
// the gate runs before any data access rather than merely shaping the response.
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  makeSheets,
  loadApi,
  call,
  makeAuthStub,
  fakeToken,
  AUTHORIZED_EMAIL,
  OTHER_AUTHORIZED_EMAIL,
  AUTHORIZED_EMAILS,
} = require("./sheetsStub");

// The 14 method+path combinations the `api` function serves. POST /api/insights
// carries a body because the handler parses one before it would reach Anthropic;
// it never gets that far in any test here.
const ENDPOINTS = [
  ["GET", "/api"],
  ["POST", "/api"],
  ["PATCH", "/api"],
  ["DELETE", "/api"],
  ["GET", "/api/users"],
  ["GET", "/api/scheduler-status"],
  ["GET", "/api/categories"],
  ["POST", "/api/categories"],
  ["PATCH", "/api/categories/cat_001"],
  ["GET", "/api/subscriptions"],
  ["POST", "/api/subscriptions"],
  ["PATCH", "/api/subscriptions"],
  ["POST", "/api/insights"],
  ["POST", "/api/migrate-users"],
];

const BODY = {
  "POST /api": { date: "2026-08-01", amount: 100, category_id: "cat_001", paid_by: "Karen" },
  "PATCH /api": { id: "e1", amount: 200 },
  "DELETE /api": { id: "e1" },
  "POST /api/categories": { name_en: "New", name_zh: "新", icon: "🆕" },
  "PATCH /api/categories/cat_001": { name_en: "Renamed" },
  "POST /api/subscriptions": { name: "Netflix", amount: 390, category_id: "cat_001", due_day: 1 },
  "PATCH /api/subscriptions": { id: "sub_001", amount: 400 },
  "POST /api/insights": { period: "monthly", year: 2026, month: 8 },
};

const bodyFor = (method, path) => BODY[`${method} ${path}`];

function fixture() {
  return makeSheets({
    Expenses: {
      header: ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at", "subscription_id"],
      rows: [["e1", "2026-08-01", "100", "cat_001", "Karen", "Karen", "n", "2026-08-01T00:00:00Z", ""]],
    },
    Users: { header: ["id", "name", "email"], rows: [["user1", "Karen", "k@example.test"]] },
    Categories: {
      header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"],
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", ""]],
    },
    Subscriptions: {
      header: ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active", "start_date", "end_date"],
      rows: [["sub_001", "Netflix", "390", "cat_001", "monthly", "1", "", "Karen", "true", "2026-01-01", ""]],
    },
    SchedulerLog: { header: ["run_at", "due_count", "created_count", "skipped_count", "error"], rows: [] },
  });
}

const snapshot = (grids) => JSON.stringify(grids);

// ---------------------------------------------------------------------------
// AC-1 — no Authorization header
// ---------------------------------------------------------------------------

test("AC-1: every endpoint 401s with no Authorization header, touching neither sheet nor Sheets client", async () => {
  for (const [method, path] of ENDPOINTS) {
    const { grids, requests, sheets } = fixture();
    const api = loadApi(sheets);
    const before = snapshot(grids);

    const { status, body } = await call(api, method, path, bodyFor(method, path), {});

    assert.equal(status, 401, `${method} ${path} returns 401`);
    assert.deepEqual(body, { error: "unauthorized" }, `${method} ${path} body`);
    assert.equal(snapshot(grids), before, `${method} ${path} left the sheet byte-identical`);
    assert.deepEqual(requests, [], `${method} ${path} issued no Sheets request`);
  }
});

// ---------------------------------------------------------------------------
// AC-2 — malformed headers
// ---------------------------------------------------------------------------

test("AC-2: a present-but-malformed Authorization header 401s", async () => {
  for (const header of ["", "abc", "Bearer", "Bearer ", "Basic eHl6"]) {
    const { requests, sheets } = fixture();
    const api = loadApi(sheets);

    const { status, body } = await call(api, "GET", "/api", undefined, { authorization: header });

    assert.equal(status, 401, `header ${JSON.stringify(header)} returns 401`);
    assert.deepEqual(body, { error: "unauthorized" });
    assert.deepEqual(requests, [], `header ${JSON.stringify(header)} issued no Sheets request`);
  }
});

// ---------------------------------------------------------------------------
// AC-3 — token that verifyIdToken rejects
// ---------------------------------------------------------------------------

test("AC-3: a well-formed Bearer token that verifyIdToken rejects 401s", async () => {
  const { requests, sheets } = fixture();
  const authStub = makeAuthStub();
  const api = loadApi(sheets, authStub);

  const { status, body } = await call(api, "GET", "/api", undefined, {
    authorization: "Bearer expired-or-tampered-or-wrong-audience",
  });

  assert.equal(status, 401);
  assert.deepEqual(body, { error: "unauthorized" });
  // The rejection came from the verifier, not from header parsing bailing early.
  assert.deepEqual(authStub.verifyCalls, ["expired-or-tampered-or-wrong-audience"]);
  assert.deepEqual(requests, []);
});

// ---------------------------------------------------------------------------
// AC-4 — verified token, unauthorized email
// ---------------------------------------------------------------------------

test("AC-4: every endpoint 403s for a verified token whose email is not authorized", async () => {
  const stranger = `Bearer ${fakeToken({ email: "stranger@example.test", email_verified: true })}`;

  for (const [method, path] of ENDPOINTS) {
    const { grids, requests, sheets } = fixture();
    const api = loadApi(sheets);
    const before = snapshot(grids);

    const { status, body } = await call(api, method, path, bodyFor(method, path), {
      authorization: stranger,
    });

    assert.equal(status, 403, `${method} ${path} returns 403`);
    assert.deepEqual(body, { error: "forbidden" }, `${method} ${path} body`);
    assert.equal(snapshot(grids), before, `${method} ${path} left the sheet byte-identical`);
    assert.deepEqual(requests, [], `${method} ${path} issued no Sheets request`);
  }
});

// ---------------------------------------------------------------------------
// AC-5 — authorized email, email_verified !== true
// ---------------------------------------------------------------------------

test("AC-5: an authorized email with email_verified !== true 403s", async () => {
  for (const emailVerified of [false, undefined, "true"]) {
    const { requests, sheets } = fixture();
    const api = loadApi(sheets);

    const { status, body } = await call(api, "GET", "/api", undefined, {
      authorization: `Bearer ${fakeToken({ email: AUTHORIZED_EMAIL, email_verified: emailVerified })}`,
    });

    assert.equal(status, 403, `email_verified ${JSON.stringify(emailVerified)} returns 403`);
    assert.deepEqual(body, { error: "forbidden" });
    assert.deepEqual(requests, []);
  }
});

test("a verified token carrying no email claim 403s rather than crashing", async () => {
  const { sheets } = fixture();
  const api = loadApi(sheets);

  const { status, body } = await call(api, "GET", "/api", undefined, {
    authorization: `Bearer ${fakeToken({ email_verified: true })}`,
  });

  assert.equal(status, 403);
  assert.deepEqual(body, { error: "forbidden" });
});

// ---------------------------------------------------------------------------
// AC-6 — the authorized path is unchanged
// ---------------------------------------------------------------------------

test("AC-6: both authorized emails reach the handler on every endpoint", async () => {
  // A rejected request returns one of the three gate bodies; anything else means
  // the request reached the real handler, which is what this AC is about. The
  // other 173 tests then pin the exact status/body of that handler behaviour.
  const GATE_BODIES = [
    JSON.stringify({ error: "unauthorized" }),
    JSON.stringify({ error: "forbidden" }),
    JSON.stringify({ error: "AUTHORIZED_EMAILS not configured" }),
  ];

  for (const email of [AUTHORIZED_EMAIL, OTHER_AUTHORIZED_EMAIL]) {
    for (const [method, path] of ENDPOINTS) {
      const { sheets } = fixture();
      const api = loadApi(sheets);

      const { status, body } = await call(api, method, path, bodyFor(method, path), {
        authorization: `Bearer ${fakeToken({ email, email_verified: true })}`,
      });

      assert.ok(![401, 403].includes(status), `${method} ${path} not rejected for ${email}`);
      assert.ok(
        !GATE_BODIES.includes(JSON.stringify(body)),
        `${method} ${path} body is not a gate rejection for ${email}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// AC-7 — case-insensitive, whitespace-tolerant comparison
// ---------------------------------------------------------------------------

test("AC-7: email comparison ignores case and surrounding whitespace on both sides", async () => {
  const claims = [AUTHORIZED_EMAIL.toUpperCase(), `  ${AUTHORIZED_EMAIL}  `, AUTHORIZED_EMAIL];

  for (const claimEmail of claims) {
    const { sheets } = fixture();
    const api = loadApi(sheets);
    // Configured side is messy too: mixed case, padding, and a trailing comma.
    process.env.AUTHORIZED_EMAILS = `  ${AUTHORIZED_EMAIL.toUpperCase()} , ${OTHER_AUTHORIZED_EMAIL},  `;

    const { status } = await call(api, "GET", "/api", undefined, {
      authorization: `Bearer ${fakeToken({ email: claimEmail, email_verified: true })}`,
    });

    assert.equal(status, 200, `claim ${JSON.stringify(claimEmail)} is accepted`);
  }
});

// ---------------------------------------------------------------------------
// AC-8 — fail closed on missing configuration
// ---------------------------------------------------------------------------

test("AC-8: an unusable AUTHORIZED_EMAILS 500s every endpoint and reaches the Sheets client for none", async () => {
  for (const value of [undefined, "", "   ", ",", " , , ", ",,,"]) {
    for (const [method, path] of ENDPOINTS) {
      const { grids, requests, sheets } = fixture();
      const authStub = makeAuthStub();
      const api = loadApi(sheets, authStub);
      const before = snapshot(grids);
      if (value === undefined) delete process.env.AUTHORIZED_EMAILS;
      else process.env.AUTHORIZED_EMAILS = value;

      const { status, body } = await call(api, method, path, bodyFor(method, path));

      assert.equal(status, 500, `${method} ${path} with ${JSON.stringify(value)} returns 500`);
      assert.deepEqual(body, { error: "AUTHORIZED_EMAILS not configured" });
      assert.equal(snapshot(grids), before, `${method} ${path} left the sheet byte-identical`);
      assert.deepEqual(requests, [], `${method} ${path} issued no Sheets request`);
      // Fail closed means it never even looked at the credential.
      assert.deepEqual(authStub.verifyCalls, [], `${method} ${path} did not verify a token`);
    }
  }
});

// ---------------------------------------------------------------------------
// AC-12 / AC-13 / AC-14 — CORS and preflight
// ---------------------------------------------------------------------------

test("AC-12: OPTIONS returns 204 on every path without a token and never calls verifyIdToken", async () => {
  for (const [, path] of ENDPOINTS) {
    const { requests, sheets } = fixture();
    const authStub = makeAuthStub();
    const api = loadApi(sheets, authStub);

    const { status } = await call(api, "OPTIONS", path, undefined, {});

    assert.equal(status, 204, `OPTIONS ${path} returns 204`);
    assert.deepEqual(authStub.verifyCalls, [], `OPTIONS ${path} did not call verifyIdToken`);
    assert.deepEqual(requests, [], `OPTIONS ${path} issued no Sheets request`);
  }
});

test("AC-12: OPTIONS still 204s while AUTHORIZED_EMAILS is unconfigured", async () => {
  const { sheets } = fixture();
  const authStub = makeAuthStub();
  const api = loadApi(sheets, authStub);
  delete process.env.AUTHORIZED_EMAILS;

  const { status } = await call(api, "OPTIONS", "/api", undefined, {});

  assert.equal(status, 204);
  assert.deepEqual(authStub.verifyCalls, []);
});

test("AC-13: Access-Control-Allow-Headers advertises Content-Type and Authorization", async () => {
  const { sheets } = fixture();
  const api = loadApi(sheets);

  const { headers } = await call(api, "GET", "/api");
  const allowed = headers["Access-Control-Allow-Headers"].split(",").map((h) => h.trim());

  assert.ok(allowed.includes("Authorization"), "Authorization is allowed");
  assert.ok(allowed.includes("Content-Type"), "Content-Type is still allowed");
});

test("AC-14: 401, 403 and 500 responses carry the same CORS headers as a success", async () => {
  const { sheets } = fixture();
  const api = loadApi(sheets);
  const ok = await call(api, "GET", "/api");
  assert.equal(ok.status, 200);

  const rejections = {
    401: await call(api, "GET", "/api", undefined, {}),
    403: await call(api, "GET", "/api", undefined, {
      authorization: `Bearer ${fakeToken({ email: "stranger@example.test", email_verified: true })}`,
    }),
  };
  process.env.AUTHORIZED_EMAILS = "";
  rejections[500] = await call(api, "GET", "/api");
  process.env.AUTHORIZED_EMAILS = AUTHORIZED_EMAILS;

  for (const [expected, res] of Object.entries(rejections)) {
    assert.equal(res.status, Number(expected));
    assert.deepEqual(
      res.headers,
      ok.headers,
      `${expected} carries the same CORS headers as a 200`
    );
  }
  // Guards the assertion above against passing because both sides were empty.
  assert.ok(Object.keys(ok.headers).length >= 3, "a success actually set CORS headers");
});
