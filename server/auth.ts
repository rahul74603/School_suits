import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  refreshTokens,
  users,
  USER_ROLES,
  type UserRole,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Phase 2 auth core (design doc §2 + §3.1).
//
// - Passwords: Node built-in scrypt, stored as "scrypt:<salt>:<hash>".
// - Access tokens: JWT (HS256), 12 hours, signed/verified with Node's
//   built-in crypto HMAC — package.json has NO JWT library, and none is
//   added on purpose (zero new native/runtime dependencies, §2.1 ka
//   "no build jhanjhat" principle JWT par bhi lagu).
// - Refresh tokens: 30-day opaque random tokens; only their SHA-256 hash
//   is stored, in the refresh_tokens table, so they can be revoked.
// - schoolId/role ALWAYS come from the verified token + DB user row.
//   Client-sent schoolId is never trusted (§3.1 ka sabse important niyam).
// ---------------------------------------------------------------------------

// --- Request user ----------------------------------------------------------

export interface AuthUser {
  id: number;
  schoolId: number | null;
  role: UserRole;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

// --- Password hashing (scrypt) ----------------------------------------------

const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** Hash a plain-text password for storage in users.password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a plain-text password against a stored "scrypt:<salt>:<hash>"
 * value. Anything that is not in that format (e.g. a legacy plain-text
 * password from the old system) simply fails — it is never compared
 * as plain text.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scryptAsync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// --- JWT (HS256, built-in crypto) -------------------------------------------

const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours (§2.2)

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is not set (or is shorter than 32 characters). " +
        "Configure a long random JWT_SECRET in the server environment before starting.",
    );
  }
  return secret;
}

function base64UrlEncode(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

function signHs256(signingInput: string): string {
  return createHmac("sha256", getJwtSecret())
    .update(signingInput)
    .digest("base64url");
}

export interface AccessTokenPayload {
  userId: number;
  schoolId: number | null;
  role: UserRole;
}

/** Issue a 12-hour access token for a logged-in user. */
export function signAccessToken(payload: AccessTokenPayload): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    sub: String(payload.userId),
    schoolId: payload.schoolId,
    role: payload.role,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  const signingInput =
    `${base64UrlEncode(JSON.stringify(header))}.` +
    base64UrlEncode(JSON.stringify(body));
  return `${signingInput}.${signHs256(signingInput)}`;
}

/**
 * Verify an access token. Returns the payload, or null for ANY problem
 * (bad format, bad signature, expired, unknown role) — callers should
 * treat every failure the same way (401).
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, bodyPart, signature] = parts;

  const expectedSignature = signHs256(`${headerPart}.${bodyPart}`);
  const given = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  let header: unknown;
  let body: unknown;
  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    body = JSON.parse(Buffer.from(bodyPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof header !== "object" || header === null ||
    (header as { alg?: unknown }).alg !== "HS256" ||
    typeof body !== "object" || body === null
  ) {
    return null;
  }

  const claims = body as {
    sub?: unknown;
    schoolId?: unknown;
    role?: unknown;
    exp?: unknown;
  };
  const userId = Number(claims.sub);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!isUserRole(claims.role)) return null;
  if (
    claims.schoolId !== null &&
    (typeof claims.schoolId !== "number" || !Number.isInteger(claims.schoolId))
  ) {
    return null;
  }
  if (typeof claims.exp !== "number") return null;
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null; // expired

  return {
    userId,
    schoolId: claims.schoolId as number | null,
    role: claims.role,
  };
}

// --- Refresh tokens (DB-backed, revocable) -----------------------------------

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (§2.2)

function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface IssuedRefreshToken {
  /** Raw token — give this to the client, never store it. */
  token: string;
  expiresAt: Date;
}

/** Create a new refresh token for a user; only its hash is stored. */
export async function issueRefreshToken(
  userId: number,
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Rotate a refresh token: the presented token is revoked and a fresh
 * one is issued. Returns null if the token is unknown, revoked, expired,
 * or belongs to a deactivated user (in which case it is revoked too).
 */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ userId: number; refreshToken: IssuedRefreshToken } | null> {
  const tokenHash = hashRefreshToken(rawToken);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row || row.revoked === 1) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await revokeRefreshToken(rawToken);
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!user || user.isActive !== 1) {
    await revokeAllRefreshTokensForUser(row.userId);
    return null;
  }

  await revokeRefreshToken(rawToken);
  const refreshToken = await issueRefreshToken(row.userId);
  return { userId: row.userId, refreshToken };
}

/** Revoke one refresh token (logout). Unknown tokens are ignored. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: 1, updatedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)));
}

/**
 * Revoke every refresh token of a user — used on logout-everywhere,
 * password change, and account deactivation (§2.2).
 */
export async function revokeAllRefreshTokensForUser(
  userId: number,
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revoked: 1, updatedAt: new Date() })
    .where(eq(refreshTokens.userId, userId));
}

// --- Middleware ---------------------------------------------------------------

// While must_change_password = 1, sirf ye endpoints allow hain (§2.3.5);
// baaki sab par 403 milega.
const MUST_CHANGE_PASSWORD_ALLOWED_PATHS = new Set([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
]);

/**
 * requireAuth (§3.1): verifies the Bearer access token, loads the user
 * from the DB (so a deactivated user is rejected even with a valid
 * token), and attaches req.user = { id, schoolId, role,
 * mustChangePassword } — all from the token + DB, never from anything
 * the client sent.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ message: "Login required" });
      return;
    }
    const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
    if (!payload) {
      res.status(401).json({ message: "Login required" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (!user || user.isActive !== 1 || !isUserRole(user.role)) {
      res.status(401).json({ message: "Login required" });
      return;
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
      mustChangePassword: user.mustChangePassword === 1,
    };

    if (
      req.user.mustChangePassword &&
      !MUST_CHANGE_PASSWORD_ALLOWED_PATHS.has(req.path)
    ) {
      res.status(403).json({
        message: "Password change required before using the app",
      });
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireRole (§3.1): role-guard factory.
 *   app.get("/api/users", requireAuth, requireRole("principal"), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Login required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res
        .status(403)
        .json({ message: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
