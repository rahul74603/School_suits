import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertSchoolSchema,
  insertStudentSchema,
  insertFeeStructureSchema,
  insertFeePaymentSchema,
  insertStaffSchema,
  userRoleSchema,
  type User,
  type UserRole,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  requireAuth,
  requireRole,
} from "./auth";

// ---------------------------------------------------------------------------
// Phase 2 batch 2 — auth routes (§5.1), provisioning (§5.2/§5.3, rollout
// steps 4 + 6) aur purane 12 routes ki hifazat (rollout step 5).
//
// Sabse important niyam (§3.1): schoolId hamesha login token se aayega.
// Client jo schoolId bheje wo IGNORE hoga — sirf Super Admin (jiska khud
// ka koi school nahi hota) ke liye query/body wala schoolId mana jayega.
// Password hash kisi bhi response me kabhi nahi jayega (serializeUser).
// ---------------------------------------------------------------------------

// User serializer — users table ki row se sirf safe fields.
// `password` (scrypt hash) is list me jaan-bujh kar NAHI hai (§6).
function serializeUser(user: User) {
  return {
    id: user.id,
    schoolId: user.schoolId,
    username: user.username,
    role: user.role,
    name: user.name,
    phone: user.phone,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// §5.2: school ke saath uska pehla Principal bhi banta hai.
const createSchoolWithPrincipalSchema = insertSchoolSchema.extend({
  principal: z.object({
    username: z.string().min(3),
    name: z.string().min(1),
    phone: z.string().min(5).optional(),
    temporaryPassword: z.string().min(8),
  }),
});

const updateSchoolSchema = insertSchoolSchema.partial();

// §5.3: naya account. `temporaryPassword` plain aata hai, server use
// scrypt hash karke store karta hai; schoolId principal ke liye token se
// zabardasti lagega, sirf super_admin body wala schoolId de sakta hai.
const createUserSchema = z.object({
  username: z.string().min(3),
  name: z.string().min(1),
  role: userRoleSchema,
  phone: z.string().min(5).optional(),
  temporaryPassword: z.string().min(8),
  schoolId: z.number().int().positive().optional(),
  studentIds: z.array(z.number().int().positive()).optional(),
  relation: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).nullable().optional(),
  studentIds: z.array(z.number().int().positive()).optional(),
  relation: z.string().optional(),
});

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const parseOptionalId = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const parsePathId = (req: Request): number | null => {
    const id = parseInt(req.params.id);
    return Number.isNaN(id) ? null : id;
  };

  // Token wala school scope (§3.1.3 + §3.1.5). Aam user ke liye hamesha
  // req.user.schoolId; super_admin ke liye query, phir body ka schoolId.
  const scopedSchoolId = (req: Request): number | null => {
    if (!req.user) return null;
    if (req.user.role !== "super_admin") return req.user.schoolId;
    const fromQuery = parseOptionalId(req.query.schoolId);
    if (fromQuery) return fromQuery;
    const bodySchoolId = (req.body as { schoolId?: unknown } | undefined)
      ?.schoolId;
    return typeof bodySchoolId === "number" &&
      Number.isInteger(bodySchoolId) &&
      bodySchoolId > 0
      ? bodySchoolId
      : null;
  };

  // Data routes ke liye school lazmi hai — na mile to handler yahin rukta.
  const requireSchoolId = (req: Request, res: Response): number | null => {
    const schoolId = scopedSchoolId(req);
    if (schoolId == null) {
      res.status(400).json({
        message:
          "School context missing. Super Admin must pass schoolId explicitly.",
      });
      return null;
    }
    return schoolId;
  };

  // --- Login rate limit (§2.4) -------------------------------------------
  // In-memory, per username+IP: 10 galat koshish / 10 minute par block.
  // Koi nayi dependency nahi; server restart par counters saaf ho jate
  // hain (v1 ke liye theek hai — asal raksha password hashing + lockout
  // ka yahi halka layer hai).
  const LOGIN_MAX_FAILURES = 10;
  const LOGIN_WINDOW_MS = 10 * 60 * 1000;
  const loginFailures = new Map<
    string,
    { count: number; windowStart: number }
  >();

  const loginKey = (req: Request, username: string) =>
    `${req.ip ?? "unknown"}:${username.toLowerCase()}`;

  const loginBlocked = (key: string): boolean => {
    const entry = loginFailures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
      return false;
    }
    return entry.count >= LOGIN_MAX_FAILURES;
  };

  const recordLoginFailure = (key: string) => {
    const now = Date.now();
    const entry = loginFailures.get(key);
    if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
      loginFailures.set(key, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  };

  const issueTokens = async (user: User) => {
    const accessToken = signAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as UserRole,
    });
    const refresh = await issueRefreshToken(user.id);
    return { accessToken, refreshToken: refresh.token };
  };

  // =======================================================================
  // Auth (§5.1)
  // =======================================================================

  app.post("/api/auth/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const { username, password } = result.data;

    const key = loginKey(req, username);
    if (loginBlocked(key)) {
      return res.status(429).json({
        message: "Too many failed login attempts. Try again after some time.",
      });
    }

    const user = await storage.getUserByUsername(username);
    // Ek hi generic jawab (§2.4): username galat, password galat ya
    // account band — teeno me yahi message, kuch leak nahi hota.
    const passwordOk =
      user && user.isActive === 1
        ? await verifyPassword(password, user.password)
        : false;
    if (!user || !passwordOk) {
      recordLoginFailure(key);
      return res
        .status(401)
        .json({ message: "Username ya password galat hai" });
    }

    loginFailures.delete(key);
    await storage.updateLastLogin(user.id);
    const tokens = await issueTokens(user);
    res.json({
      ...tokens,
      user: serializeUser({ ...user, lastLoginAt: new Date() }),
    });
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const result = refreshSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const rotated = await rotateRefreshToken(result.data.refreshToken);
    if (!rotated) {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    const user = await storage.getUser(rotated.userId);
    if (!user) {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    const accessToken = signAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as UserRole,
    });
    res.json({
      accessToken,
      refreshToken: rotated.refreshToken.token,
      user: serializeUser(user),
    });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const result = logoutSchema.safeParse(req.body ?? {});
    if (result.success && result.data.refreshToken) {
      // Sirf bheja gaya token revoke karo (§5.1 #3).
      await revokeRefreshToken(result.data.refreshToken);
    } else {
      // Token nahi bheja — is user ke saare sessions band (logout everywhere).
      await revokeAllRefreshTokensForUser(req.user!.id);
    }
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(401).json({ message: "Login required" });
    const school = user.schoolId
      ? await storage.getSchool(user.schoolId)
      : undefined;
    res.json({
      user: serializeUser(user),
      // Branding (§4): app login ke turant baad school ka naam/logo/colors
      // yahin se cache kar legi. Super Admin kisi school se linked nahi.
      school: school ?? null,
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(401).json({ message: "Login required" });

    const currentOk = await verifyPassword(
      result.data.currentPassword,
      user.password,
    );
    if (!currentOk) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect" });
    }

    await storage.updateUserPassword(
      user.id,
      await hashPassword(result.data.newPassword),
    );
    await storage.setMustChangePassword(user.id, 0);
    // Purane saare sessions band (§2.2) — phir is device ke liye naye token.
    await revokeAllRefreshTokensForUser(user.id);
    const tokens = await issueTokens(user);
    const updated = await storage.getUser(user.id);
    res.json({
      ...tokens,
      user: serializeUser(updated ?? user),
    });
  });

  // =======================================================================
  // Schools & branding (§5.2)
  // =======================================================================

  app.get(
    "/api/schools",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const schools = await storage.getSchools();
      res.json(schools);
    },
  );

  // Super Admin: naya school + uska pehla Principal (§2.3.2).
  // Principal ko temporary password milega, mustChangePassword = 1 ke
  // saath — pehle login par password badalna hi padega.
  app.post(
    "/api/schools",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const result = createSchoolWithPrincipalSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { principal, ...schoolData } = result.data;

      const existing = await storage.getUserByUsername(principal.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const school = await storage.createSchool(schoolData);
      const principalUser = await storage.createUser({
        schoolId: school.id,
        username: principal.username,
        password: await hashPassword(principal.temporaryPassword),
        role: "principal",
        name: principal.name,
        phone: principal.phone ?? null,
        mustChangePassword: 1,
        isActive: 1,
      });
      res.status(201).json({
        school,
        principal: serializeUser(principalUser),
      });
    },
  );

  app.get(
    "/api/schools/:id",
    requireAuth,
    requireRole("super_admin", "principal"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      // Principal sirf apna school — dusre ka maange to 404 (§3.1.4).
      if (req.user!.role === "principal" && req.user!.schoolId !== id) {
        return res.status(404).json({ message: "School not found" });
      }
      const school = await storage.getSchool(id);
      if (!school) return res.status(404).json({ message: "School not found" });
      res.json(school);
    },
  );

  // Branding/settings update (§4): Principal (apna) ya Super Admin.
  app.put(
    "/api/schools/:id",
    requireAuth,
    requireRole("super_admin", "principal"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      if (req.user!.role === "principal" && req.user!.schoolId !== id) {
        return res.status(404).json({ message: "School not found" });
      }
      const result = updateSchoolSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const existing = await storage.getSchool(id);
      if (!existing) {
        return res.status(404).json({ message: "School not found" });
      }
      const updates: Record<string, unknown> = { ...result.data };
      // School band/chaalu karna sirf Super Admin ka kaam hai (#10).
      if (req.user!.role !== "super_admin") delete updates.isActive;
      const school = await storage.updateSchool(id, {
        ...(updates as typeof result.data),
        updatedAt: new Date(),
      });
      res.json(school);
    },
  );

  // License band karna = school deactivate (§5.2 #10).
  app.post(
    "/api/schools/:id/deactivate",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const existing = await storage.getSchool(id);
      if (!existing) {
        return res.status(404).json({ message: "School not found" });
      }
      const school = await storage.updateSchool(id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(school);
    },
  );

  // Apne school ki branding — login kiya hua koi bhi user (§5.2 #11).
  app.get("/api/branding", requireAuth, async (req, res) => {
    if (!req.user!.schoolId) {
      return res
        .status(404)
        .json({ message: "This account is not linked to a school" });
    }
    const school = await storage.getSchool(req.user!.schoolId);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  // =======================================================================
  // Users (§5.3)
  // =======================================================================

  // Object-level scope (§3.1.4): super_admin sab, principal apne school
  // ke, user khud — iske bahar wala user "hai hi nahi" (404).
  const loadUserInScope = async (req: Request): Promise<User | null> => {
    const id = parsePathId(req);
    if (id == null) return null;
    const user = await storage.getUser(id);
    if (!user) return null;
    if (req.user!.role === "super_admin") return user;
    if (req.user!.id === user.id) return user;
    if (
      req.user!.role === "principal" &&
      user.schoolId === req.user!.schoolId
    ) {
      return user;
    }
    return null;
  };

  const withStudentIds = async (user: User) => {
    const serialized = serializeUser(user);
    if (user.role !== "parent") return serialized;
    const links = await storage.getParentStudentLinks(user.id);
    return { ...serialized, studentIds: links.map((link) => link.studentId) };
  };

  app.get(
    "/api/users",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      let users: User[];
      if (req.user!.role === "principal") {
        // Principal ko sirf apne school ke accounts (§5.3).
        users = await storage.getUsersBySchool(req.user!.schoolId ?? -1);
      } else {
        const schoolId = parseOptionalId(req.query.schoolId);
        users = schoolId
          ? await storage.getUsersBySchool(schoolId)
          : await storage.getUsers();
      }
      res.json(await Promise.all(users.map(withStudentIds)));
    },
  );

  app.post(
    "/api/users",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const data = result.data;
      const caller = req.user!;

      // Principal sirf staff roles + parent bana sakta hai — principal ya
      // super_admin banana uske adhikar me nahi (§2.3.3).
      if (
        caller.role === "principal" &&
        data.role !== "accountant" &&
        data.role !== "teacher" &&
        data.role !== "staff" &&
        data.role !== "parent"
      ) {
        return res.status(403).json({
          message:
            "Principal can create only accountant, teacher, staff or parent accounts",
        });
      }

      // Naya user hamesha banane wale ke school ka — client ke bheje
      // schoolId par bharosa nahi (§2.3.3, §3.1.6). Sirf super_admin
      // (jiska apna school nahi) body wala schoolId de sakta hai.
      const targetSchoolId =
        caller.role === "super_admin" ? data.schoolId : caller.schoolId;
      if (!targetSchoolId) {
        return res.status(400).json({ message: "schoolId is required" });
      }
      const targetSchool = await storage.getSchool(targetSchoolId);
      if (!targetSchool) {
        return res.status(404).json({ message: "School not found" });
      }

      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Parent: kam se kam ek baccha link hona lazmi, aur har baccha
      // usi school ka hona chahiye (§2.3.4).
      const studentIds =
        data.role === "parent" ? (data.studentIds ?? []) : [];
      if (data.role === "parent") {
        if (studentIds.length === 0) {
          return res.status(400).json({
            message: "A parent account must be linked to at least one student",
          });
        }
        for (const studentId of studentIds) {
          const student = await storage.getStudent(studentId);
          if (!student || student.schoolId !== targetSchoolId) {
            return res.status(400).json({
              message: "One or more students do not belong to this school",
            });
          }
        }
      }

      const created = await storage.createUser({
        schoolId: targetSchoolId,
        username: data.username,
        password: await hashPassword(data.temporaryPassword),
        role: data.role,
        name: data.name,
        // Parent ka username hi mobile number hai (§2.3.4) — phone khaali
        // ho to wahi phone ban jayega.
        phone: data.phone ?? (data.role === "parent" ? data.username : null),
        mustChangePassword: 1,
        isActive: 1,
      });

      for (const studentId of studentIds) {
        await storage.linkParentStudent({
          parentUserId: created.id,
          studentId,
          relation: data.relation ?? null,
        });
      }

      res.status(201).json(await withStudentIds(created));
    },
  );

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await loadUserInScope(req);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(await withStudentIds(user));
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const target = await loadUserInScope(req);
    if (!target) return res.status(404).json({ message: "User not found" });

    const data = result.data;
    const isSelfEdit =
      req.user!.id === target.id &&
      req.user!.role !== "principal" &&
      req.user!.role !== "super_admin";

    // Khud ka edit sirf name/phone tak (§5.3 #15); baccho ke links sirf
    // principal/super_admin badal sakte hain.
    if (isSelfEdit && data.studentIds !== undefined) {
      return res.status(403).json({
        message: "You cannot change linked students on your own account",
      });
    }

    const updates: { name?: string; phone?: string | null } = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    let updated = target;
    if (Object.keys(updates).length > 0) {
      updated = await storage.updateUser(target.id, updates);
    }

    if (data.studentIds !== undefined && target.role === "parent") {
      for (const studentId of data.studentIds) {
        const student = await storage.getStudent(studentId);
        if (!student || student.schoolId !== target.schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      await storage.replaceParentStudentLinks(
        target.id,
        data.studentIds,
        data.relation ?? null,
      );
    }

    res.json(await withStudentIds(updated));
  });

  app.post(
    "/api/users/:id/deactivate",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      if (id === req.user!.id) {
        return res
          .status(400)
          .json({ message: "You cannot deactivate your own account" });
      }
      const target = await storage.getUser(id);
      if (
        !target ||
        (req.user!.role === "principal" &&
          target.schoolId !== req.user!.schoolId)
      ) {
        return res.status(404).json({ message: "User not found" });
      }
      const updated = await storage.updateUser(id, { isActive: 0 });
      // Band account ke purane sessions bhi turant band (§2.4).
      await revokeAllRefreshTokensForUser(id);
      res.json(serializeUser(updated));
    },
  );

  app.post(
    "/api/users/:id/reset-password",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = resetPasswordSchema.safeParse(req.body ?? {});
      if (!result.success) return res.status(400).json(result.error);
      const target = await storage.getUser(id);
      if (
        !target ||
        (req.user!.role === "principal" &&
          target.schoolId !== req.user!.schoolId)
      ) {
        return res.status(404).json({ message: "User not found" });
      }
      // Temporary password na diya ho to server bana dega — wo sirf is
      // ek response me dikhega (office wahi parent/staff ko dega, §2.3.4).
      const generated = result.data.temporaryPassword
        ? null
        : randomBytes(6).toString("hex");
      const temporaryPassword = result.data.temporaryPassword ?? generated!;
      await storage.updateUserPassword(
        id,
        await hashPassword(temporaryPassword),
      );
      await storage.setMustChangePassword(id, 1);
      await revokeAllRefreshTokensForUser(id);
      const updated = await storage.getUser(id);
      res.json({
        user: serializeUser(updated ?? target),
        ...(generated ? { temporaryPassword: generated } : {}),
      });
    },
  );

  // =======================================================================
  // Students — purane routes, ab login + role + token-school ke saath
  // (rollout step 5). Behaviour pehle jaisa hi hai.
  // =======================================================================

  app.get(
    "/api/students",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;

      const filters = {
        class:
          typeof req.query.class === "string" ? req.query.class : undefined,
        section:
          typeof req.query.section === "string"
            ? req.query.section
            : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      };

      const students = await storage.getStudents(schoolId, filters);
      res.json(students);
    },
  );

  app.post(
    "/api/students",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertStudentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      // schoolId body se nahi, token se (§3.1.6).
      const student = await storage.createStudent({
        ...result.data,
        schoolId,
      });
      res.json(student);
    },
  );

  // =======================================================================
  // Fees
  // =======================================================================

  app.get(
    "/api/fee-structures",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const structures = await storage.getFeeStructures(schoolId);
      res.json(structures);
    },
  );

  app.post(
    "/api/fee-structures",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertFeeStructureSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const structure = await storage.createFeeStructure({
        ...result.data,
        schoolId,
      });
      res.json(structure);
    },
  );

  app.get(
    "/api/payments",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const studentId = parseOptionalId(req.query.studentId);
      const payments = await storage.getFeePayments(schoolId, studentId);
      res.json(payments);
    },
  );

  app.post(
    "/api/payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertFeePaymentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const payment = await storage.createFeePayment({
        ...result.data,
        schoolId,
      });
      res.status(201).json(payment);
    },
  );

  app.get(
    "/api/fees/defaulters",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const classStr =
        typeof req.query.class === "string" ? req.query.class : undefined;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const defaulters = await storage.getDefaulters(schoolId, classStr, month);
      res.json(defaulters);
    },
  );

  // =======================================================================
  // Staff
  // =======================================================================

  app.get(
    "/api/staff",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const staffList = await storage.getStaff(schoolId);
      res.json(staffList);
    },
  );

  app.post(
    "/api/staff",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertStaffSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const newStaff = await storage.createStaff({
        ...result.data,
        schoolId,
      });
      res.json(newStaff);
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
