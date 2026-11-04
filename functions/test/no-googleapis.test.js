// Run with: npm run build && node --test test/
// Entity 081, AC-5. The full `googleapis` bundle took 450-915 ms to load on
// every cold start; the backend only needs Sheets. Loads the BUILT backend in a
// fresh Node process (nothing else pre-loaded) and lists every module file that
// actually got required, so the assertion lands on what a cold start loads.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const FUNCTIONS_DIR = path.join(__dirname, "..");

test("AC-5: loading the built backend never requires the googleapis bundle", () => {
  const script = `
    process.env.SPREADSHEET_ID = "x";
    require("./lib/index.js");
    process.stdout.write(JSON.stringify(Object.keys(require.cache)));
  `;
  const loaded = JSON.parse(execFileSync(process.execPath, ["-e", script], { cwd: FUNCTIONS_DIR, encoding: "utf8" }));
  const sep = path.sep;
  assert.ok(loaded.some((f) => f.includes(`${sep}node_modules${sep}@googleapis${sep}sheets${sep}`)), "the slim Sheets library is what got loaded");
  const bundle = loaded.filter((f) => f.includes(`${sep}node_modules${sep}googleapis${sep}`));
  assert.deepEqual(bundle, [], "no file from node_modules/googleapis/ was loaded");
});

test("AC-5: googleapis is a devDependency only, so the deployed backend does not install it", () => {
  const pkg = require("../package.json");
  assert.ok(pkg.dependencies["@googleapis/sheets"], "@googleapis/sheets is a runtime dependency");
  assert.equal(pkg.dependencies.googleapis, undefined, "googleapis is not a runtime dependency");
  assert.ok(pkg.devDependencies.googleapis, "googleapis stays available to the one-off scripts");
});
