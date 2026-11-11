import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";
import { hashPassword } from "./auth";

// ---------------------------------------------------------------------------
// Super Admin seed (Phase 2 design §2.3.1).
//
// Run once, on the server, with credentials supplied ONLY through the
// environment — nothing is hardcoded here or anywhere else:
//
//   SUPER_ADMIN_USERNAME=<username> SUPER_ADMIN_PASSWORD=<password> \
//     npx tsx server/seed.ts
//
// (A "create-super-admin" npm script wrapping this command is a
// next-batch wiring item for package.json.)
//
// The script REFUSES to run when:
// - SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD are unset, or the
//   password is shorter than 10 characters,
// - a super_admin account already exists (seed is one-time), or
// - the username is already taken.
// DATABASE_URL must also be set — server/db.ts throws otherwise.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const username = process.env.SUPER_ADMIN_USERNAME?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!username || !password) {
    console.error(
      "Refusing to run: SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD " +
        "must both be set in the environment.",
    );
    process.exit(1);
  }
  if (password.length < 10) {
    console.error(
      "Refusing to run: SUPER_ADMIN_PASSWORD must be at least 10 characters.",
    );
    process.exit(1);
  }

  const [existingSuperAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(1);
  if (existingSuperAdmin) {
    console.error(
      "Refusing to run: a super_admin account already exists. " +
        "This seed is one-time only.",
    );
    process.exit(1);
  }

  const [existingUsername] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existingUsername) {
    console.error(
      `Refusing to run: username "${username}" is already taken.`,
    );
    process.exit(1);
  }

  const [created] = await db
    .insert(users)
    .values({
      schoolId: null, // Super Admin kisi ek school ka nahi hota (§2.3.1)
      username,
      password: await hashPassword(password),
      role: "super_admin",
      name,
      mustChangePassword: 0,
      isActive: 1,
    })
    .returning();

  console.log(
    `Super Admin created: id=${created.id} username="${created.username}". ` +
      "You can now remove SUPER_ADMIN_PASSWORD from the environment.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Super Admin seed failed:", err);
  process.exit(1);
});
