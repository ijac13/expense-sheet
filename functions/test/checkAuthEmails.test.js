// Run with: npm run build && node --test test/
// Exercises scripts/check-auth-emails.js as a real subprocess against throwaway
// env files, so the assertions land on its exit code and stdout — the two things
// the deploy runbook actually depends on (AC-11).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "../scripts/check-auth-emails.js");
const USER1 = "preflight-user1@example.test";
const USER2 = "preflight-user2@example.test";

// A standalone tree, deliberately NOT a git repo: the script's main-checkout
// fallback then finds nothing and reads only the files this test wrote, so a
// developer's real functions/.env can never influence the result.
function runWith({ server, client }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-auth-emails-"));
  fs.mkdirSync(path.join(root, "functions", "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(root, "functions", "scripts", "check-auth-emails.js"));

  if (server !== null) {
    fs.writeFileSync(path.join(root, "functions", ".env"), `SPREADSHEET_ID=x\n${server}\n`);
  }
  if (client !== null) {
    fs.writeFileSync(path.join(root, "app", ".env.local"), client + "\n");
  }

  const result = spawnSync(process.execPath, [path.join(root, "functions", "scripts", "check-auth-emails.js")], {
    encoding: "utf8",
  });
  fs.rmSync(root, { recursive: true, force: true });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const clientPair = `NEXT_PUBLIC_USER1_EMAIL=${USER1}\nNEXT_PUBLIC_USER2_EMAIL=${USER2}`;

test("AC-11: matching sets exit 0 and report a MATCH", () => {
  const { code, out } = runWith({
    server: `AUTHORIZED_EMAILS=${USER1},${USER2}`,
    client: clientPair,
  });
  assert.equal(code, 0, out);
  assert.match(out, /MATCH: both sides list the same 2 address\(es\)/);
});

test("AC-11: the comparison ignores case, padding and a trailing comma", () => {
  const { code, out } = runWith({
    server: `AUTHORIZED_EMAILS=  ${USER2.toUpperCase()} , ${USER1},  `,
    client: `NEXT_PUBLIC_USER1_EMAIL=  ${USER1.toUpperCase()}  \nNEXT_PUBLIC_USER2_EMAIL=${USER2}`,
  });
  assert.equal(code, 0, out);
  assert.match(out, /MATCH/);
});

test("AC-11: a server list missing one client address exits non-zero", () => {
  const { code, out } = runWith({ server: `AUTHORIZED_EMAILS=${USER1}`, client: clientPair });
  assert.notEqual(code, 0);
  assert.match(out, /MISMATCH/);
  assert.match(out, /1 only on the client/);
});

test("AC-11: a server list carrying an extra address exits non-zero", () => {
  const { code, out } = runWith({
    server: `AUTHORIZED_EMAILS=${USER1},${USER2},extra@example.test`,
    client: clientPair,
  });
  assert.notEqual(code, 0);
  assert.match(out, /1 address\(es\) only on the server/);
});

test("AC-11: an unset or empty AUTHORIZED_EMAILS exits non-zero and names the fail-closed 500", () => {
  for (const server of ["", "AUTHORIZED_EMAILS=", "AUTHORIZED_EMAILS=  , ,"]) {
    const { code, out } = runWith({ server, client: clientPair });
    assert.notEqual(code, 0, `server ${JSON.stringify(server)} exits non-zero`);
    assert.match(out, /fail closed/);
  }
});

test("AC-11: a missing env file exits non-zero rather than reporting a false MATCH", () => {
  const noServer = runWith({ server: null, client: clientPair });
  assert.notEqual(noServer.code, 0);
  assert.match(noServer.out, /missing functions\/\.env/);

  const noClient = runWith({ server: `AUTHORIZED_EMAILS=${USER1},${USER2}`, client: null });
  assert.notEqual(noClient.code, 0);
  assert.match(noClient.out, /missing app\/\.env\.local/);
});

test("AC-11: no output path ever prints an address", () => {
  const cases = [
    { server: `AUTHORIZED_EMAILS=${USER1},${USER2}`, client: clientPair },
    { server: `AUTHORIZED_EMAILS=${USER1}`, client: clientPair },
    { server: `AUTHORIZED_EMAILS=${USER1},${USER2},extra@example.test`, client: clientPair },
    { server: "AUTHORIZED_EMAILS=", client: clientPair },
    { server: null, client: clientPair },
  ];
  for (const scenario of cases) {
    const { out } = runWith(scenario);
    assert.doesNotMatch(out, /@/, `output carries no @ at all: ${JSON.stringify(out)}`);
  }
});
