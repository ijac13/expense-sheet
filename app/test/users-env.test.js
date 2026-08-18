// Run with: npm test  (compiles app/lib/users.ts to .test-build first)
// Guards the move of the two sign-in emails out of source and into
// NEXT_PUBLIC_USER1_EMAIL / NEXT_PUBLIC_USER2_EMAIL (workflow/052).
const test = require("node:test");
const assert = require("node:assert/strict");

// USERS reads process.env at module load, so each case re-requires after
// setting the env it wants.
function loadUsers(env) {
  for (const key of ["NEXT_PUBLIC_USER1_EMAIL", "NEXT_PUBLIC_USER2_EMAIL"]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  delete require.cache[require.resolve("../.test-build/users.js")];
  return require("../.test-build/users.js");
}

const CONFIGURED = {
  NEXT_PUBLIC_USER1_EMAIL: "user-one@example.com",
  NEXT_PUBLIC_USER2_EMAIL: "user-two@example.com",
};

test("each configured email resolves to the same id/name the hardcoded table used", () => {
  const { getUserByEmail } = loadUsers(CONFIGURED);

  assert.deepEqual({ ...getUserByEmail("user-one@example.com") }, {
    id: "user1", name: "ijac", email: "user-one@example.com",
  });
  assert.deepEqual({ ...getUserByEmail("user-two@example.com") }, {
    id: "user2", name: "wei", email: "user-two@example.com",
  });
});

test("ids, names and the default user are untouched by the env move", () => {
  const { USERS, DEFAULT_USER } = loadUsers(CONFIGURED);

  assert.deepEqual(USERS.map(u => u.id), ["user1", "user2"]);
  assert.deepEqual(USERS.map(u => u.name), ["ijac", "wei"]);
  assert.equal(DEFAULT_USER, "user1");
});

test("an email that is not configured is rejected", () => {
  const { getUserByEmail } = loadUsers(CONFIGURED);

  assert.equal(getUserByEmail("stranger@example.com"), null);
  assert.equal(getUserByEmail(""), null);
  assert.equal(getUserByEmail(null), null);
  assert.equal(getUserByEmail(undefined), null);
});

// The dangerous failure mode: unset vars default to "", so a blank email must
// not match a user and hand out an authorized session.
test("unset env vars fail closed instead of authorizing a blank email", () => {
  const { getUserByEmail } = loadUsers({});

  assert.equal(getUserByEmail(""), null);
  assert.equal(getUserByEmail("user-one@example.com"), null);
});
