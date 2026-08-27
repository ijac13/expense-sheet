// Run with: npm test  (compiles app/ to .test-build-ui first)
// Exercises the REAL apiClient — the one helpers/dom.js deliberately stubs out —
// against a fake firebase module, so the assertions land on the headers actually
// handed to fetch rather than on the source.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP_DIR = path.join(__dirname, "..", "app");

// Install the firebase stub before apiClient is first required, so its
// `require("./firebase")` resolves to this instead of the real SDK.
const firebaseId = require.resolve("../.test-build-ui/lib/firebase.js");
let currentUser = null;
require.cache[firebaseId] = {
  id: firebaseId,
  filename: firebaseId,
  loaded: true,
  exports: { getFirebaseAuth: () => ({ currentUser }), default: () => ({}) },
};

const { apiFetch, NotSignedInError } = require("../.test-build-ui/lib/apiClient.js");

// jsdom is not needed here, but Headers/fetch are: Node has both natively.
function captureFetch() {
  const calls = [];
  global.fetch = async (input, init) => {
    calls.push({ input, init });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return calls;
}

const signedIn = (token = "id-token-abc") => {
  currentUser = { getIdToken: async () => token };
};

test("AC-15: apiFetch attaches the signed-in user's ID token as a Bearer header", async () => {
  signedIn("id-token-abc");
  const calls = captureFetch();

  await apiFetch("/api/categories");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/categories");
  assert.equal(new Headers(calls[0].init.headers).get("Authorization"), "Bearer id-token-abc");
});

test("AC-15: apiFetch preserves the caller's method, body and Content-Type", async () => {
  signedIn();
  const calls = captureFetch();

  await apiFetch("/api/subscriptions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "sub_001" }),
  });

  const { init } = calls[0];
  const headers = new Headers(init.headers);
  assert.equal(init.method, "PATCH");
  assert.equal(init.body, JSON.stringify({ id: "sub_001" }));
  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get("Authorization"), "Bearer id-token-abc");
});

test("AC-15: a fresh token is minted per call, so an expiry refresh is picked up", async () => {
  let n = 0;
  currentUser = { getIdToken: async () => `token-${++n}` };
  const calls = captureFetch();

  await apiFetch("/api");
  await apiFetch("/api");

  assert.equal(new Headers(calls[0].init.headers).get("Authorization"), "Bearer token-1");
  assert.equal(new Headers(calls[1].init.headers).get("Authorization"), "Bearer token-2");
});

test("AC-16: with no signed-in user apiFetch throws NotSignedInError and issues no request", async () => {
  currentUser = null;
  const calls = captureFetch();

  await assert.rejects(() => apiFetch("/api/categories"), NotSignedInError);
  // The point of the AC: no tokenless request went out.
  assert.deepEqual(calls, []);
});

test("AC-16: the error is distinguishable from an ordinary API failure", async () => {
  currentUser = null;
  captureFetch();

  const err = await apiFetch("/api").catch((e) => e);
  assert.ok(err instanceof NotSignedInError);
  assert.equal(err.name, "NotSignedInError");
  assert.ok(!(new Error("boom") instanceof NotSignedInError), "not every Error matches");
});

test("AC-17: getSchedulerStatus returns the stale fallback on an auth failure, never throws", async () => {
  currentUser = null;
  captureFetch();
  const { getSchedulerStatus } = require("../.test-build-ui/lib/subscriptionService.js");

  const status = await getSchedulerStatus();

  assert.equal(status.stale, true);
  assert.equal(status.last_run_at, null);
  assert.equal(status.due_count, 0);
});

test("AC-17: a signed-in getSchedulerStatus still returns the real payload", async () => {
  signedIn();
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ last_run_at: "2026-08-26T00:00:00Z", due_count: 2, created_count: 2, skipped_count: 0, error: "", stale: false }),
  });
  const { getSchedulerStatus } = require("../.test-build-ui/lib/subscriptionService.js");

  const status = await getSchedulerStatus();

  assert.equal(status.stale, false);
  assert.equal(status.due_count, 2);
});

// ---------------------------------------------------------------------------
// AC-15 — the helper is the only door
// ---------------------------------------------------------------------------

test("AC-15: no bare fetch( call site remains in app/app outside apiClient.ts", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (full === path.join(APP_DIR, "lib", "apiClient.ts")) continue;
      const source = fs.readFileSync(full, "utf8");
      source.split("\n").forEach((line, i) => {
        // `apiFetch(` and `.fetch(` must not count; a bare `fetch(` must.
        if (/(^|[^.\w])fetch\s*\(/.test(line)) {
          offenders.push(`${path.relative(APP_DIR, full)}:${i + 1}`);
        }
      });
    }
  };
  walk(APP_DIR);

  assert.deepEqual(offenders, [], `bare fetch( outside apiClient.ts: ${offenders.join(", ")}`);
});

test("AC-19: the dead lib/auth.ts is gone and nothing imports it", () => {
  assert.equal(fs.existsSync(path.join(APP_DIR, "lib", "auth.ts")), false, "app/app/lib/auth.ts is deleted");

  const importers = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (/from\s+["'][^"']*lib\/auth["']|from\s+["']\.\/auth["']/.test(fs.readFileSync(full, "utf8"))) {
        importers.push(path.relative(APP_DIR, full));
      }
    }
  };
  walk(APP_DIR);

  assert.deepEqual(importers, [], `importers of the deleted module: ${importers.join(", ")}`);
});
