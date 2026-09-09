import bcrypt from "bcryptjs";
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
