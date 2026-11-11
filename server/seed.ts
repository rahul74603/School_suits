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
// (package.json me "create-super-admin": "tsx server/seed.ts" script
// isi command ko wrap karta hai.)
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

// ---------------------------------------------------------------------------
// ensureSuperAdmin() — boot-time seed (FREE RENDER DEPLOY ke liye).
//
// Render ke free plan par shell/console nahi milta, isliye upar wala
// CLI seed wahan chal hi nahi sakta. Isi liye server/index.ts server
// listen ke baad is function ko ek baar bulata hai:
//
// - SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD env me ho, password
//   >= 10 characters ho, AUR koi super_admin pehle se exist na karta
//   ho -> account bana deta hai (password sirf hash store hota hai).
// - Kuch bhi pehle se set/maujud ho -> chup-chaap kuch nahi karta.
// - Idempotent hai: har boot par chalega, dusri baar no-op rahega.
// - Kabhi throw nahi karta — andar hi try/catch hai, taaki seed ki
//   gadbad par API server crash na ho (caller bhi try/catch rakhta
//   hai, double suraksha).
//
// Return: true = is call me account bana, false = nahi bana.
// ---------------------------------------------------------------------------
export async function ensureSuperAdmin(): Promise<boolean> {
  try {
    const username = process.env.SUPER_ADMIN_USERNAME?.trim();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

    if (!username || !password) {
      // Env hi nahi diya gaya — normal baat hai (jaise local dev),
      // koi error nahi, bas skip.
      return false;
    }
    if (password.length < 10) {
      console.warn(
        "ensureSuperAdmin: SUPER_ADMIN_PASSWORD 10 characters se " +
          "chhota hai — Super Admin nahi banaya gaya.",
      );
      return false;
    }

    const [existingSuperAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.role, "super_admin"))
      .limit(1);
    if (existingSuperAdmin) {
      return false; // Pehle se hai — idempotent no-op.
    }

    const [existingUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (existingUsername) {
      console.warn(
        `ensureSuperAdmin: username "${username}" pehle se kisi aur ` +
          "account par hai — Super Admin nahi banaya gaya.",
      );
      return false;
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
      `ensureSuperAdmin: Super Admin created: id=${created.id} ` +
        `username="${created.username}".`,
    );
    return true;
  } catch (err) {
    console.error("ensureSuperAdmin failed (server chalta rahega):", err);
    return false;
  }
}

// CLI ke roop me tabhi chalao jab ye file seedhi chalayi jaye
// (tsx server/seed.ts / npm run create-super-admin). server/index.ts
// is file ko import karta hai (ensureSuperAdmin ke liye) — wahan
// main() NAHI chalna chahiye, warna import par hi process.exit ho
// jayega. Bundled server me argv[1] dist/index.cjs hota hai, seed.ts
// kabhi nahi, isliye ye check dono jagah surakshit hai.
const invokedDirectly = /seed\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Super Admin seed failed:", err);
    process.exit(1);
  });
}
