import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { User } from "@shared/schema";

export const roles = ["admin", "principal", "staff", "teacher", "accountant", "student"] as const;
export type Role = (typeof roles)[number];

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: Role;
  name: string;
  schoolId: number;
  authVersion?: number;
}

export type PublicUser = Omit<AuthenticatedUser, "id"> & { id: number };

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

export function toAuthenticatedUser(user: Pick<User, "id" | "username" | "role" | "name" | "schoolId">): AuthenticatedUser {
  if (!user.schoolId || !isRole(user.role)) {
    throw new Error("User has an invalid authentication profile");
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    schoolId: user.schoolId,
  };
}

export function toPublicUser(user: AuthenticatedUser): PublicUser {
  return { ...user };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (req.session.user && !req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString("hex");
  if (req.session.user && req.session.csrfToken) res.cookie("school_suite.csrf", req.session.csrfToken, { httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 });
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path === "/api/auth/login" || !req.session.user) return next();
  const supplied = req.get("X-CSRF-Token");
  const origin = req.get("Origin");
  const expectedOrigin = `${req.protocol}://${req.get("host")}`;
  const referer = req.get("Referer");
  const sameOrigin = (origin && origin === expectedOrigin) || (referer && referer.startsWith(`${expectedOrigin}/`));
  // Browser requests are required to prove same-origin with a token or Origin/Referer.
  // Non-browser clients without Origin remain compatible with the existing API contract.
  if (supplied === req.session.csrfToken || sameOrigin || (!origin && !referer)) return next();
  res.status(403).json({ message: "CSRF validation failed" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  next();
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }

    next();
  };
}

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.session.user) {
    throw new Error("Authenticated user is not available");
  }
  return req.session.user;
}
