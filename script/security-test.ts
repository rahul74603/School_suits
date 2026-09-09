import assert from "node:assert/strict";
import {
  hashPassword,
  requireAuth,
  requireRole,
  toAuthenticatedUser,
  verifyPassword,
} from "../server/auth";

async function run() {
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password, "password must not be stored as plaintext");
  assert.match(hash, /^\$2[aby]\$/i, "password must use bcrypt format");
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);

  const publicUser = toAuthenticatedUser({
    id: 1,
    username: "admin",
    passwordHash: hash,
    role: "admin",
    name: "Administrator",
    schoolId: 10,
  });
  assert.deepEqual(publicUser, {
    id: 1,
    username: "admin",
    role: "admin",
    name: "Administrator",
    schoolId: 10,
  });
  assert.equal("passwordHash" in publicUser, false);

  const responses: Array<{ status: number; body: unknown }> = [];
  const response = {
    status(code: number) {
      return {
        json(body: unknown) {
          responses.push({ status: code, body });
        },
      };
    },
  } as any;
  let nextCalled = false;
  requireAuth({ session: {} } as any, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(responses.at(-1)?.status, 401);

  nextCalled = false;
  requireRole("admin")(
    { session: { user: { ...publicUser, role: "staff" } } } as any,
    response,
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, false);
  assert.equal(responses.at(-1)?.status, 403);

  nextCalled = false;
  requireRole("admin")(
    { session: { user: publicUser } } as any,
    response,
    () => { nextCalled = true; },
  );
  assert.equal(nextCalled, true);

  console.log("Security primitive tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
