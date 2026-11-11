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
  noticeAudienceSchema,
  attendanceStatusSchema,
  type User,
  type UserRole,
  type Student,
  type Staff,
  type StudentDues,
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

// Staff serializer (§3 footnote ‡): salary wali fields (basicSalary,
// advanceGiven) sirf principal/accountant ko dikhengi. Teacher/staff
// (aur koi bhi aur role) ko ye fields response me MILENGI HI NAHI —
// value chhupana kaafi nahi, field hi gayab rahegi.
function serializeStaffFor(member: Staff, role: string | undefined) {
  if (role === "principal" || role === "accountant") return member;
  const { basicSalary, advanceGiven, ...safe } = member;
  return safe;
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

// ---------------------------------------------------------------------------
// Phase 2 parity (batch 2c, rollout steps 7–8) ke request schemas.
// ---------------------------------------------------------------------------

// Student update: insert schema ka partial roop (shared/routes.ts ke
// contract jaisa). schoolId body se aaye to bhi route use ignore karega.
const updateStudentBodySchema = insertStudentSchema.partial();

const promoteStudentsSchema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1),
  targetClass: z.string().min(1),
});

const studentTransportSchema = z.object({
  // null bhejne par transport link hat jayega.
  transportId: z.number().int().positive().nullable(),
});

const createDocumentSchema = z.object({
  docType: z.string().min(1).optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1).optional(),
  // Phase 3 Batch C — asli file content (base64). Optional hai taaki
  // Phase 2 wale metadata-only clients bhi chalte rahen.
  base64Data: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
});

// Staff documents (Phase 3 Batch C) — Electron ka upload-staff-document
// hamesha file content bhejta tha, isliye yahan base64Data lazmi hai.
const createStaffDocumentSchema = z.object({
  docType: z.string().min(1).optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1).optional(),
  base64Data: z.string().min(1),
  mimeType: z.string().min(1).optional(),
});

// Document file ki size limit (v1): asal file ~2MB. Base64 usse ~4/3
// guna badi hoti hai, isliye ginna decoded size par hota hai.
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

function estimateBase64Bytes(base64Data: string): number {
  const clean = base64Data.replace(/\s+/g, "");
  if (clean.length === 0) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function documentTooLarge(base64Data: string): boolean {
  return estimateBase64Bytes(base64Data) > MAX_DOCUMENT_BYTES;
}

// List/create ke jawab me file ka content (base64) KABHI nahi bhejta —
// sirf metadata + hasFile. Content sirf /file wale endpoint se milta hai.
function documentMeta<T extends { fileData?: string | null }>(
  doc: T,
): Omit<T, "fileData"> & { hasFile: boolean } {
  const { fileData, ...rest } = doc;
  return { ...rest, hasFile: Boolean(fileData) };
}

const createDueSchema = z.object({
  feeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
  // "2026-09-30" jaisi date string; route Date me badal kar store karega
  // (student_dues.due_date timestamp column hai).
  dueDate: z.string().min(1),
  isPaid: z.number().int().min(0).max(1).optional(),
});

const updateFeeStructureBodySchema = insertFeeStructureSchema.partial();

const createAdditionalFeeBodySchema = z.object({
  class: z.string().min(1),
  feeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
  dueMonth: z.string().min(1).optional(),
});

const createTransportRouteBodySchema = z.object({
  routeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
});

const updateStaffBodySchema = insertStaffSchema.partial();

// Phase 3 Batch A fix — payment create ka body. Fees page `breakdown`
// ko OBJECT bhejta hai ({ extras: [{ name, amount, type, month }] }),
// jabki fee_payments.breakdown column text hai; isliye string / object /
// array teeno kubool hain aur route store karne se pehle JSON string me
// badalta hai (normalizePaymentBreakdown). Purane clients bina breakdown
// ke bhejte rahe to bhi chalega — field optional hai.
// `isAdmission` sirf payload flag hai, koi column nahi hai: route use
// breakdown JSON ke andar mehfooz kar deta hai taaki getStudentStatus
// admission balance ghatate waqt use padh sake.
const createFeePaymentBodySchema = insertFeePaymentSchema.extend({
  breakdown: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .nullable()
    .optional(),
  isAdmission: z.boolean().optional(),
  // Dues-fix batch — Fees page kisi pending custom due ke "Pay" se bill
  // banata hai to us due ki pehchan (dueId) aur is bill me uske liye di
  // gayi rakam (amount — bill me badli ja sakti hai, isliye due ki asal
  // rakam se alag bhejna zaroori hai) yahan aati hai. Payment bante hi
  // route in dues ko settle karta hai: poora paisa → is_paid = 1, kam
  // paisa → due ki rakam utni hi ghat jati hai (baaki pending rehta
  // hai). Field optional hai — purane clients bina iske bhejte rahe to
  // bhi chalega; unke dues pehle ki tarah pending hi rahenge. Column
  // koi nahi hai — ye bhi isAdmission ki tarah sirf payload hai.
  dueSettlements: z
    .array(
      z.object({
        dueId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

function normalizePaymentBreakdown(
  breakdown: string | unknown[] | Record<string, unknown> | null | undefined,
  isAdmission: boolean | undefined,
): string | undefined {
  if (breakdown == null) {
    // Breakdown nahi aaya lekin admission wali payment hai — flag ko
    // khali-extras wale JSON me mehfooz kar do, warna ye jaankari
    // hamesha ke liye kho jayegi.
    return isAdmission
      ? JSON.stringify({ extras: [], isAdmission: true })
      : undefined;
  }
  if (typeof breakdown === "string") {
    if (!isAdmission) return breakdown;
    try {
      const parsed = JSON.parse(breakdown);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return JSON.stringify({ ...parsed, isAdmission: true });
      }
    } catch {
      // String jaisi hai waisi rahegi; getStudentStatus ka parsing bhi
      // defensive hai.
    }
    return breakdown;
  }
  const obj: Record<string, unknown> = Array.isArray(breakdown)
    ? { extras: breakdown }
    : { ...breakdown };
  if (isAdmission) obj.isAdmission = true;
  return JSON.stringify(obj);
}

const createSalaryPaymentBodySchema = z.object({
  staffId: z.number().int().positive(),
  month: z.string().min(1),
  year: z.number().int(),
  amount: z.number().int().nonnegative(),
  // Phase 3 Batch C (GAP-B1) — breakup wale fields. Sab optional:
  // purane clients (aur Batch B ka remarks-wala tareeka) bina inke
  // bhejkar bhi chalte rahenge. `amount` hi net rakam hai — server
  // use in fields se dobara NAHI ginta.
  baseSalary: z.number().int().nonnegative().optional(),
  bonus: z.number().int().nonnegative().optional(),
  deduction: z.number().int().nonnegative().optional(),
  paymentMode: z.string().min(1).optional(),
  paymentDate: z.string().min(1).optional(),
  remarks: z.string().optional(),
});

const createExpenseBodySchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1).optional(),
  amount: z.number().int().nonnegative(),
  expenseDate: z.string().min(1).optional(),
  remarks: z.string().optional(),
});

const createExamBodySchema = z.object({
  examName: z.string().min(1),
  examType: z.string().min(1).optional(),
  class: z.string().min(1),
  section: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  maxMarks: z.number().int().positive().optional(),
  passingMarks: z.number().int().nonnegative().optional(),
  examDate: z.string().min(1).optional(),
  session: z.string().min(1).optional(),
});

const saveMarksBodySchema = z.object({
  marks: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        // null = is student ke marks abhi khaali karne hain / nahi bhare.
        marksObtained: z.number().nullable(),
        remarks: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

// Attendance bulk mark (v1.5) — saveMarksBodySchema wala hi pattern.
// date "YYYY-MM-DD" text hai (schema me examDate wali parampara).
const DATE_TEXT_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_TEXT_RE = /^\d{4}-\d{2}$/;

const markAttendanceBodySchema = z.object({
  date: z.string().regex(DATE_TEXT_RE),
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: attendanceStatusSchema,
        remarks: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

const createNoticeBodySchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  audience: noticeAudienceSchema.optional(),
});

const updateNoticeBodySchema = createNoticeBodySchema.partial();

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
    // Phase 3 Batch A fix: "teacher" Dashboard ki collection stats ke
    // liye (page saari payments padhta hai) aur "parent" apne linked
    // baccho ki payments ke liye jode gaye hain.
    requireRole("principal", "accountant", "staff", "teacher", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const studentId = parseOptionalId(req.query.studentId);

      // Parent († rule): sirf apne parent_students-linked baccho ki
      // payments. studentId diya ho aur wo linked na ho to khali list —
      // kisi dusre bacche ki ek bhi payment parent ko nahi jayegi.
      if (req.user!.role === "parent") {
        const links = await storage.getParentStudentLinks(req.user!.id);
        const linkedIds = new Set(links.map((link) => link.studentId));
        if (studentId != null) {
          if (!linkedIds.has(studentId)) return res.json([]);
          return res.json(await storage.getFeePayments(schoolId, studentId));
        }
        const allPayments = await storage.getFeePayments(schoolId);
        return res.json(
          allPayments.filter(
            (payment) =>
              payment.studentId != null && linkedIds.has(payment.studentId),
          ),
        );
      }

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
      const result = createFeePaymentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      // isAdmission column nahi hai — use breakdown JSON ke andar
      // mehfooz kiya jata hai (upar normalizePaymentBreakdown dekho).
      const { isAdmission, breakdown, dueSettlements, ...paymentData } =
        result.data;

      // Dues-fix — dueSettlements aaye hon to payment banane se PEHLE
      // har due ki jaanch: due maujood ho, ISI payment wale student ka
      // ho, aur wo student isi school ka ho. student_dues me school_id
      // column hai hi nahi, isliye school ki pehchan student ke zariye
      // hoti hai — DELETE /api/dues/:id (#41) wala hi tareeka. Ek bhi
      // due galat nikla to payment bane hi nahi (400) — paisa kisi aur
      // student/school ke due par kabhi settle nahi hoga. Ek hi due
      // do baar aaye to rakam jud jayegi; pehle se paid due chupchaap
      // skip hoga (network retry par dohra settle nahi hoga).
      const settlements: Array<{ due: StudentDues; amount: number }> = [];
      if (dueSettlements && dueSettlements.length > 0) {
        const merged: Array<{ dueId: number; amount: number }> = [];
        for (const settlement of dueSettlements) {
          if (settlement.amount <= 0) continue;
          const existing = merged.find((m) => m.dueId === settlement.dueId);
          if (existing) existing.amount += settlement.amount;
          else merged.push({ dueId: settlement.dueId, amount: settlement.amount });
        }
        for (const { dueId, amount } of merged) {
          const due = await storage.getStudentDue(dueId);
          if (
            !due ||
            due.studentId == null ||
            due.studentId !== paymentData.studentId
          ) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          const student = await storage.getStudent(due.studentId);
          if (!student || student.schoolId !== schoolId) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          if (due.isPaid === 1) continue;
          settlements.push({ due, amount });
        }
      }

      const breakdownText = normalizePaymentBreakdown(breakdown, isAdmission);
      const payment = await storage.createFeePayment({
        ...paymentData,
        ...(breakdownText !== undefined
          ? { breakdown: breakdownText }
          : {}),
        schoolId,
      });

      // Payment ban gaya — ab dues settle karo. Poora paisa aaya ho to
      // is_paid = 1 (due Pending Dues se gayab ho jayega); kam aaya ho
      // to due ki rakam utni hi ghatado aur baaki hissa pending rakho —
      // isse na kabhi dohra vasool hoga, na due jhootha "paid" hoga.
      for (const { due, amount } of settlements) {
        if (amount >= due.amount) {
          await storage.updateStudentDue(due.id, {
            isPaid: 1,
            updatedAt: new Date(),
          });
        } else {
          await storage.updateStudentDue(due.id, {
            amount: due.amount - amount,
            updatedAt: new Date(),
          });
        }
      }

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

  // Roles design §5.6 #49 + §3 matrix ke hisaab se batch 2c me badhaye:
  // teacher/staff bhi staff list padh sakte hain, lekin salary fields
  // unhe kabhi nahi dikhengi (serializeStaffFor, §3 ‡).
  app.get(
    "/api/staff",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      // Phase 3 Batch A fix: Staff page ke status filters (Inactive
      // wagera) kaam karne ke liye list me saare staff (active +
      // inactive) chahiye. Salary/pending aur dashboard stats apni
      // jagah par default active-only wala getStaff hi istemal karte
      // hain — unka behaviour nahi badla.
      const staffList = await storage.getStaff(schoolId, {
        includeInactive: true,
      });
      res.json(
        staffList.map((member) => serializeStaffFor(member, req.user!.role)),
      );
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
      // Phase 3 Batch A fix: employeeId client se na aaye (Staff page
      // me ID ka input hai hi nahi) to server khud banata hai. Insert
      // ke baad mile id se banta hai (EMP-<id>), isliye hamesha unique
      // hai — employee_id par unique bandhan bhi hai. Client ne ID
      // bheja ho to wahi rehta hai.
      if (!newStaff.employeeId) {
        const withEmployeeId = await storage.updateStaff(newStaff.id, {
          employeeId: `EMP-${newStaff.id}`,
          updatedAt: new Date(),
        });
        return res.json(withEmployeeId);
      }
      res.json(newStaff);
    },
  );

  // =======================================================================
  // Phase 2 parity — batch 2c (rollout steps 7–8, §5.4–§5.8)
  //
  // Niyam wahi purane (§3.1): schoolId sirf token se; dusri school ka
  // record = 404; parent (†) sirf apne parent_students-linked bacche
  // dekh sakta hai — dusra baccha uske liye "hai hi nahi" (404).
  // =======================================================================

  // :id wala student load karke school-scope (+ parent link) check.
  // Fail ho to response yahi se chala jata hai aur null milta hai.
  const loadStudentInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; student: Student } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const student = await storage.getStudent(id);
    if (!student || student.schoolId !== schoolId) {
      res.status(404).json({ message: "Student not found" });
      return null;
    }
    if (req.user!.role === "parent") {
      const links = await storage.getParentStudentLinks(req.user!.id);
      if (!links.some((link) => link.studentId === student.id)) {
        res.status(404).json({ message: "Student not found" });
        return null;
      }
    }
    return { schoolId, student };
  };

  const loadStaffInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; member: Staff } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const member = await storage.getStaffMember(id);
    if (!member || member.schoolId !== schoolId) {
      res.status(404).json({ message: "Staff not found" });
      return null;
    }
    return { schoolId, member };
  };

  // Parent ke linked baccho ke IDs — parent-scope wale har handler me
  // yahi set lagega († rule).
  const parentLinkedStudentIds = async (req: Request): Promise<number[]> => {
    const links = await storage.getParentStudentLinks(req.user!.id);
    return links.map((link) => link.studentId);
  };

  // ---------------------------------------------------------------------
  // Students parity (§5.4) — note: literal paths (/promote,
  // /next-admission-no, ...) hamesha /api/students/:id se PEHLE register
  // honge, warna Express ":id" unhe kha jayega.
  // ---------------------------------------------------------------------

  // #24 — agla admission number (school settings se banta hai, §6.7).
  app.get(
    "/api/students/next-admission-no",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const admissionNo = await storage.getNextAdmissionNo(schoolId);
      res.json({ admissionNo });
    },
  );

  // #25 — admission number pehle se hai kya?
  app.get(
    "/api/students/check-admission-no",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const no =
        typeof req.query.no === "string" ? req.query.no : undefined;
      if (!no) {
        return res
          .status(400)
          .json({ message: "Query parameter 'no' is required" });
      }
      const existing = await storage.getStudentByAdmissionNo(schoolId, no);
      res.json({
        admissionNo: no,
        exists: Boolean(existing),
        ...(existing ? { studentId: existing.id } : {}),
      });
    },
  );

  // #26 — admission number se student.
  app.get(
    "/api/students/by-admission-no/:no",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const student = await storage.getStudentByAdmissionNo(
        schoolId,
        req.params.no,
      );
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    },
  );

  // #23 — promote (contract shared/routes.ts me pehle se tha).
  // Sirf wahi students promote honge jo is school ke hain — dusri
  // school ke IDs chup-chaap ignore ho jayenge (leak bhi nahi, kaam
  // bhi nahi).
  app.post(
    "/api/students/promote",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = promoteStudentsSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const inSchool: number[] = [];
      for (const studentId of result.data.studentIds) {
        const student = await storage.getStudent(studentId);
        if (student && student.schoolId === schoolId) {
          inSchool.push(studentId);
        }
      }
      await storage.promoteStudents(inSchool, result.data.targetClass);
      res.json({
        message: `${inSchool.length} student(s) promoted to ${result.data.targetClass}`,
        promotedCount: inSchool.length,
      });
    },
  );

  // #20 — ek student (parent: sirf apna linked baccha).
  app.get(
    "/api/students/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      res.json(loaded.student);
    },
  );

  // #21 — student update. schoolId body se kabhi nahi badlega.
  app.put(
    "/api/students/:id",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = updateStudentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const student = await storage.updateStudent(loaded.student.id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // #22 — deactivate (hard delete NAHI; isActive = 0).
  app.post(
    "/api/students/:id/deactivate",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const student = await storage.updateStudent(loaded.student.id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // #27 — student ki poori fee status (getStudentStatus pehle se tha;
  // year query se, default current year; class student ki apni).
  app.get(
    "/api/students/:id/status",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const year =
        parseOptionalId(
          typeof req.query.year === "string" ? req.query.year : undefined,
        ) ?? new Date().getFullYear();
      const status = await storage.getStudentStatus(
        loaded.student.id,
        loaded.student.class,
        year,
      );
      res.json(status);
    },
  );

  // #28 — documents list (metadata hi; file Phase 3 me ayegi).
  app.get(
    "/api/students/:id/documents",
    requireAuth,
    requireRole("principal", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const documents = await storage.getStudentDocuments(loaded.student.id);
      res.json(documents.map(documentMeta));
    },
  );

  // #29a — document add. Phase 3 Batch C: body me base64Data aaye to
  // asli file content bhi save hota hai (limit ~2MB); bina uske ye
  // pehle jaisa metadata-only document banta hai.
  app.post(
    "/api/students/:id/documents",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = createDocumentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (
        result.data.base64Data &&
        documentTooLarge(result.data.base64Data)
      ) {
        return res.status(400).json({
          message: "Document bahut bada hai — zyada se zyada 2MB ki file chalegi",
        });
      }
      const doc = await storage.createStudentDocument({
        schoolId: loaded.schoolId,
        studentId: loaded.student.id,
        docType: result.data.docType ?? null,
        fileName: result.data.fileName,
        filePath: result.data.filePath ?? null,
        fileData: result.data.base64Data ?? null,
        mimeType: result.data.mimeType ?? null,
      });
      res.status(201).json(documentMeta(doc));
    },
  );

  // #29c — document ki asli file (download/view ke liye). Metadata-only
  // (Phase 2) wale documents ke paas content hai hi nahi — unpar 404.
  app.get(
    "/api/students/:id/documents/:docId/file",
    requireAuth,
    requireRole("principal", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStudentDocument(docId);
      if (!doc || doc.studentId !== loaded.student.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (!doc.fileData) {
        return res
          .status(404)
          .json({ message: "Is document ki file uplabdh nahi hai" });
      }
      res.json({
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        base64Data: doc.fileData,
      });
    },
  );

  // #29b — document metadata delete.
  app.delete(
    "/api/students/:id/documents/:docId",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStudentDocument(docId);
      if (!doc || doc.studentId !== loaded.student.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      await storage.deleteStudentDocument(docId);
      res.json({ message: "Document deleted" });
    },
  );

  // #39 — ek student ke dues (parent: sirf apne bacche ke).
  app.get(
    "/api/students/:id/dues",
    requireAuth,
    requireRole("principal", "accountant", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const dues = await storage.getStudentDues(loaded.student.id);
      res.json(dues);
    },
  );

  // #40 — student par due add (add-student-due).
  app.post(
    "/api/students/:id/dues",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = createDueSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const dueDate = new Date(result.data.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: "Invalid dueDate" });
      }
      const due = await storage.createStudentDue({
        studentId: loaded.student.id,
        feeName: result.data.feeName,
        amount: result.data.amount,
        dueDate,
        isPaid: result.data.isPaid ?? 0,
      });
      res.status(201).json(due);
    },
  );

  // #41 — due delete. Due ka school uske student se check hoga
  // (student_dues me school_id column hai hi nahi).
  app.delete(
    "/api/dues/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const due = await storage.getStudentDue(id);
      if (!due) return res.status(404).json({ message: "Due not found" });
      const student = await storage.getStudent(due.studentId);
      if (!student || student.schoolId !== schoolId) {
        return res.status(404).json({ message: "Due not found" });
      }
      await storage.deleteStudentDue(id);
      res.json({ message: "Due deleted" });
    },
  );

  // #48 — student ka transport route set/clear.
  app.put(
    "/api/students/:id/transport",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = studentTransportSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { transportId } = result.data;
      if (transportId != null) {
        const routes = await storage.getTransportRoutes(loaded.schoolId);
        if (!routes.some((route) => route.id === transportId)) {
          return res
            .status(400)
            .json({ message: "Transport route does not belong to this school" });
        }
      }
      const student = await storage.updateStudent(loaded.student.id, {
        transportId,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // ---------------------------------------------------------------------
  // Fees parity (§5.5) — structures/payments ke bache hue writes,
  // additional fees, transport routes.
  // ---------------------------------------------------------------------

  // #37 — agla receipt number.
  app.get(
    "/api/payments/next-receipt-no",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const receiptNo = await storage.getNextReceiptNo(schoolId);
      res.json({ receiptNo });
    },
  );

  // #36 — payment delete.
  app.delete(
    "/api/payments/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const payments = await storage.getFeePayments(schoolId);
      if (!payments.some((payment) => payment.id === id)) {
        return res.status(404).json({ message: "Payment not found" });
      }
      await storage.deleteFeePayment(id);
      res.json({ message: "Payment deleted" });
    },
  );

  // #32 — fee structure update.
  app.put(
    "/api/fee-structures/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = updateFeeStructureBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const structures = await storage.getFeeStructures(schoolId);
      if (!structures.some((structure) => structure.id === id)) {
        return res.status(404).json({ message: "Fee structure not found" });
      }
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const structure = await storage.updateFeeStructure(id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(structure);
    },
  );

  // #33 — fee structure delete (sirf principal).
  app.delete(
    "/api/fee-structures/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const structures = await storage.getFeeStructures(schoolId);
      if (!structures.some((structure) => structure.id === id)) {
        return res.status(404).json({ message: "Fee structure not found" });
      }
      await storage.deleteFeeStructure(id);
      res.json({ message: "Fee structure deleted" });
    },
  );

  // #42 — additional fees list.
  app.get(
    "/api/additional-fees",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const fees = await storage.getAdditionalFees(schoolId);
      res.json(fees);
    },
  );

  // #43 — additional fee add.
  app.post(
    "/api/additional-fees",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createAdditionalFeeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const fee = await storage.createAdditionalFee({
        ...result.data,
        dueMonth: result.data.dueMonth ?? null,
        schoolId,
      });
      res.status(201).json(fee);
    },
  );

  // #44 — additional fee delete.
  app.delete(
    "/api/additional-fees/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const fee = await storage.getAdditionalFee(id);
      if (!fee || fee.schoolId !== schoolId) {
        return res.status(404).json({ message: "Additional fee not found" });
      }
      await storage.deleteAdditionalFee(id);
      res.json({ message: "Additional fee deleted" });
    },
  );

  // #45 — transport routes list.
  app.get(
    "/api/transport-routes",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const routes = await storage.getTransportRoutes(schoolId);
      res.json(routes);
    },
  );

  // #46 — transport route add.
  app.post(
    "/api/transport-routes",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createTransportRouteBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const route = await storage.createTransportRoute({
        ...result.data,
        schoolId,
      });
      res.status(201).json(route);
    },
  );

  // #47 — transport route delete (sirf principal).
  app.delete(
    "/api/transport-routes/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const routes = await storage.getTransportRoutes(schoolId);
      if (!routes.some((route) => route.id === id)) {
        return res.status(404).json({ message: "Transport route not found" });
      }
      await storage.deleteTransportRoute(id);
      res.json({ message: "Transport route deleted" });
    },
  );

  // ---------------------------------------------------------------------
  // Staff & salary (§5.6)
  // ---------------------------------------------------------------------

  // #51 — ek staff member (salary fields role ke hisaab se, §3 ‡).
  app.get(
    "/api/staff/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      res.json(serializeStaffFor(loaded.member, req.user!.role));
    },
  );

  // #52 — staff update (sirf principal).
  app.put(
    "/api/staff/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const result = updateStaffBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const member = await storage.updateStaff(loaded.member.id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(member);
    },
  );

  // #53 — staff deactivate (soft delete; Electron ka delete-staff yahi
  // karta tha — record rehta hai, list se gayab).
  app.post(
    "/api/staff/:id/deactivate",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const member = await storage.updateStaff(loaded.member.id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(member);
    },
  );

  // #54 — ek staff ki salary history.
  app.get(
    "/api/staff/:id/salary-history",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const history = await storage.getStaffSalaryHistory(loaded.member.id);
      res.json(history);
    },
  );

  // Staff documents (Phase 3 Batch C) — Electron ke upload-staff-document
  // ka REST roop. Roles: dekhna principal/accountant/staff, upload aur
  // delete principal/staff (student documents wale usool par).
  // Jawab me file content kabhi nahi jata — sirf metadata + hasFile;
  // content ke liye /file wala endpoint hai.

  // #54b — ek staff ke documents ki list (metadata).
  app.get(
    "/api/staff/:id/documents",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const documents = await storage.getStaffDocuments(loaded.member.id);
      res.json(documents.map(documentMeta));
    },
  );

  // #54c — staff document upload (base64 content ke saath, limit ~2MB).
  app.post(
    "/api/staff/:id/documents",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const result = createStaffDocumentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (documentTooLarge(result.data.base64Data)) {
        return res.status(400).json({
          message: "Document bahut bada hai — zyada se zyada 2MB ki file chalegi",
        });
      }
      const doc = await storage.createStaffDocument({
        schoolId: loaded.schoolId,
        staffId: loaded.member.id,
        docType: result.data.docType ?? null,
        fileName: result.data.fileName,
        filePath: result.data.filePath ?? null,
        fileData: result.data.base64Data,
        mimeType: result.data.mimeType ?? null,
      });
      res.status(201).json(documentMeta(doc));
    },
  );

  // #54d — staff document ki asli file (download/view ke liye).
  app.get(
    "/api/staff/:id/documents/:docId/file",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStaffDocument(docId);
      if (!doc || doc.staffId !== loaded.member.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (!doc.fileData) {
        return res
          .status(404)
          .json({ message: "Is document ki file uplabdh nahi hai" });
      }
      res.json({
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        base64Data: doc.fileData,
      });
    },
  );

  // #54e — staff document delete.
  app.delete(
    "/api/staff/:id/documents/:docId",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStaffDocument(docId);
      if (!doc || doc.staffId !== loaded.member.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      await storage.deleteStaffDocument(docId);
      res.json({ message: "Document deleted" });
    },
  );

  // Pending salaries — YE route #55 (GET /api/salary-payments) se PEHLE
  // register hona lazmi hai (design §5.6 note): "pending" ek literal
  // segment hai, koi :id route use kha na le isliye order yahi rakha.
  // Pending = active staff jinhone diye month/year me salary nahi payi,
  // aur unka advance/balance hisaab.
  app.get(
    "/api/salary-payments/pending",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const now = new Date();
      const CALENDAR_MONTHS = [
        "January", "February", "March", "April", "May", "June", "July",
        "August", "September", "October", "November", "December",
      ];
      const month =
        typeof req.query.month === "string"
          ? req.query.month
          : CALENDAR_MONTHS[now.getMonth()];
      const year =
        parseOptionalId(
          typeof req.query.year === "string" ? req.query.year : undefined,
        ) ?? now.getFullYear();
      const paid = await storage.getSalaryPayments(schoolId, month, year);
      const paidStaffIds = new Set(paid.map((payment) => payment.staffId));
      const activeStaff = await storage.getStaff(schoolId);
      const pending = activeStaff
        .filter((member) => !paidStaffIds.has(member.id))
        .map((member) => {
          const advance = member.advanceGiven ?? 0;
          return {
            staffId: member.id,
            name: member.name,
            designation: member.designation,
            basicSalary: member.basicSalary,
            advanceGiven: advance,
            pendingAmount: Math.max(0, member.basicSalary - advance),
            month,
            year,
          };
        });
      res.json(pending);
    },
  );

  // #55 — salary payments list (month/year filter ke saath).
  app.get(
    "/api/salary-payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const year = parseOptionalId(
        typeof req.query.year === "string" ? req.query.year : undefined,
      );
      const payments = await storage.getSalaryPayments(schoolId, month, year);
      res.json(payments);
    },
  );

  // #56 — salary pay.
  app.post(
    "/api/salary-payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createSalaryPaymentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const member = await storage.getStaffMember(result.data.staffId);
      if (!member || member.schoolId !== schoolId) {
        return res
          .status(400)
          .json({ message: "Staff does not belong to this school" });
      }
      // GAP-B2 (Phase 3 Batch C) — ek staff ki ek mahine ki salary
      // dusri baar nahi. Electron bhi yahi rokta tha; page ka catch
      // "SALARY_ALREADY_PAID" message ko pehchankar khaas toast
      // dikhata hai, isliye spelling bilkul yahi rakhi hai.
      const monthPayments = await storage.getSalaryPayments(
        schoolId,
        result.data.month,
        result.data.year,
      );
      if (
        monthPayments.some((payment) => payment.staffId === result.data.staffId)
      ) {
        return res.status(409).json({ message: "SALARY_ALREADY_PAID" });
      }
      const payment = await storage.createSalaryPayment({
        schoolId,
        staffId: result.data.staffId,
        month: result.data.month,
        year: result.data.year,
        amount: result.data.amount,
        // GAP-B1 — breakup (na aaye to purani remarks-wali body bhi
        // bilkul pehle jaise chalegi; bonus/deduction ka DB default 0).
        baseSalary: result.data.baseSalary ?? null,
        bonus: result.data.bonus ?? 0,
        deduction: result.data.deduction ?? 0,
        paymentMode: result.data.paymentMode ?? null,
        paymentDate: result.data.paymentDate ?? null,
        remarks: result.data.remarks ?? null,
      });
      res.status(201).json(payment);
    },
  );

  // #57 — salary payment delete.
  app.delete(
    "/api/salary-payments/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const payments = await storage.getSalaryPayments(schoolId);
      if (!payments.some((payment) => payment.id === id)) {
        return res.status(404).json({ message: "Salary payment not found" });
      }
      await storage.deleteSalaryPayment(id);
      res.json({ message: "Salary payment deleted" });
    },
  );

  // ---------------------------------------------------------------------
  // Expenses & reports (§5.7)
  // ---------------------------------------------------------------------

  // #58 — expenses list.
  app.get(
    "/api/expenses",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const expenseList = await storage.getExpenses(schoolId);
      res.json(expenseList);
    },
  );

  // #59 — expense add.
  app.post(
    "/api/expenses",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createExpenseBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const expense = await storage.createExpense({
        schoolId,
        title: result.data.title,
        category: result.data.category ?? null,
        amount: result.data.amount,
        expenseDate: result.data.expenseDate ?? null,
        remarks: result.data.remarks ?? null,
      });
      res.status(201).json(expense);
    },
  );

  // #60 — expense delete.
  app.delete(
    "/api/expenses/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const expense = await storage.getExpense(id);
      if (!expense || expense.schoolId !== schoolId) {
        return res.status(404).json({ message: "Expense not found" });
      }
      await storage.deleteExpense(id);
      res.json({ message: "Expense deleted" });
    },
  );

  // #61 — financial summary (fees − salary − expenses + pending dues).
  app.get(
    "/api/reports/financial-summary",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const summary = await storage.getFinancialSummary(schoolId);
      res.json(summary);
    },
  );

  // #62 — month-wise financial trend.
  app.get(
    "/api/reports/financial-trend",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const trend = await storage.getFinancialTrend(schoolId);
      res.json(trend);
    },
  );

  // #63 — dashboard stats (counts + aaj/is mahine ki collection).
  app.get(
    "/api/reports/dashboard",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const stats = await storage.getDashboardStats(schoolId);
      res.json(stats);
    },
  );

  // ---------------------------------------------------------------------
  // Exams, marks, results (§5.8 #64–69)
  // ---------------------------------------------------------------------

  const loadExamInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; exam: NonNullable<Awaited<ReturnType<typeof storage.getExam>>> } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const exam = await storage.getExam(id);
    if (!exam || exam.schoolId !== schoolId) {
      res.status(404).json({ message: "Exam not found" });
      return null;
    }
    return { schoolId, exam };
  };

  // #64 — exams list. Parent ko sirf apne baccho ki class wale exams
  // dikhenge (exam class-level hota hai, student-level nahi).
  app.get(
    "/api/exams",
    requireAuth,
    requireRole("principal", "teacher", "staff", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      let examList = await storage.getExams(schoolId);
      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        const classNames = new Set<string>();
        for (const studentId of linkedIds) {
          const student = await storage.getStudent(studentId);
          if (student) classNames.add(student.class);
        }
        examList = examList.filter((exam) => classNames.has(exam.class));
      }
      res.json(examList);
    },
  );

  // #65 — exam create.
  app.post(
    "/api/exams",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createExamBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const exam = await storage.createExam({
        schoolId,
        examName: result.data.examName,
        examType: result.data.examType ?? null,
        class: result.data.class,
        section: result.data.section ?? null,
        subject: result.data.subject ?? null,
        maxMarks: result.data.maxMarks ?? 100,
        passingMarks: result.data.passingMarks ?? null,
        examDate: result.data.examDate ?? null,
        session: result.data.session ?? null,
      });
      res.status(201).json(exam);
    },
  );

  // #66 — exam delete (uske marks bhi saath delete hote hain, storage me).
  app.delete(
    "/api/exams/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      await storage.deleteExam(loaded.exam.id);
      res.json({ message: "Exam deleted" });
    },
  );

  // #67 — ek exam ke marks. Parent: sirf apne linked baccho ke marks.
  app.get(
    "/api/exams/:id/marks",
    requireAuth,
    requireRole("principal", "teacher", "parent"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        const rows = await storage.getMarksForStudents(
          loaded.exam.id,
          linkedIds,
        );
        return res.json(rows);
      }
      const rows = await storage.getExamMarks(loaded.exam.id);
      res.json(rows);
    },
  );

  // #68 — marks bulk save. Body ke har student ka is school ka hona
  // lazmi hai; ek bhi bahar ka student ho to poora batch reject (400)
  // — aadha save karke halla nahi.
  app.post(
    "/api/exams/:id/marks",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      const result = saveMarksBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      for (const entry of result.data.marks) {
        const student = await storage.getStudent(entry.studentId);
        if (!student || student.schoolId !== loaded.schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      const saved = await storage.saveExamMarks(
        loaded.exam.id,
        loaded.schoolId,
        result.data.marks.map((entry) => ({
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          remarks: entry.remarks ?? null,
        })),
      );
      res.json(saved);
    },
  );

  // #69 — ek student ke saare results (exam ki detail ke saath).
  // Parent: sirf apna linked baccha loadStudentInScope se pakka hai.
  app.get(
    "/api/students/:id/results",
    requireAuth,
    requireRole("principal", "teacher", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const rows = await storage.getStudentMarks(loaded.student.id);
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const exam = await storage.getExam(row.examId);
          return {
            ...row,
            examName: exam?.examName ?? null,
            examType: exam?.examType ?? null,
            subject: exam?.subject ?? null,
            maxMarks: exam?.maxMarks ?? null,
            passingMarks: exam?.passingMarks ?? null,
            examDate: exam?.examDate ?? null,
          };
        }),
      );
      res.json(enriched);
    },
  );

  // ---------------------------------------------------------------------
  // Attendance (v1.5 #73–76) — Gibbon/RosarioSIS se seekha design:
  // hajri roz class-wise EK bulk save me lagti hai, default "present"
  // (client sab ko present rakh kar sirf exceptions badalta hai), aur
  // dobara bhejne par wahi din ki hajri update hoti hai (upsert).
  // Mark karna sirf principal/teacher (marks-entry #68 wala usool —
  // hajri class-teacher ka kaam hai; accountant ka kaam fees hai).
  // Padhna: school staff sab; parent sirf apne linked bacche ka
  // (loadStudentInScope ka † niyam — dusra baccha = 404).
  // ---------------------------------------------------------------------

  // #73 — ek class ki ek date ki hajri (roster ke saath mili hui).
  // status null = us din ki hajri abhi lagi hi nahi.
  app.get(
    "/api/attendance",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const className =
        typeof req.query.class === "string" ? req.query.class : undefined;
      if (!className) {
        return res.status(400).json({ message: "class query parameter is required" });
      }
      const section =
        typeof req.query.section === "string" ? req.query.section : undefined;
      const date =
        typeof req.query.date === "string"
          ? req.query.date
          : new Date().toISOString().slice(0, 10);
      if (!DATE_TEXT_RE.test(date)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      const students = await storage.getStudents(schoolId, {
        class: className,
        section,
      });
      const active = students.filter((student) => student.isActive !== 0);
      const rows = await storage.getAttendanceForStudents(
        active.map((student) => student.id),
        date,
      );
      const byStudent = new Map(rows.map((row) => [row.studentId, row]));
      res.json(
        active.map((student) => {
          const row = byStudent.get(student.id);
          return {
            studentId: student.id,
            name: student.name,
            rollNo: student.rollNo,
            class: student.class,
            section: student.section,
            status: row?.status ?? null,
            remarks: row?.remarks ?? null,
            markedBy: row?.markedBy ?? null,
          };
        }),
      );
    },
  );

  // #74 — hajri bulk mark/update. Body ke har student ka is school ka
  // hona lazmi hai; ek bhi bahar ka ho to poora batch reject (400) —
  // marks #68 wala hi usool, aadha save karke halla nahi.
  app.post(
    "/api/attendance",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = markAttendanceBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      for (const entry of result.data.entries) {
        const student = await storage.getStudent(entry.studentId);
        if (!student || student.schoolId !== schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      const saved = await storage.markAttendanceBulk(
        schoolId,
        req.user!.id,
        result.data.date,
        result.data.entries.map((entry) => ({
          studentId: entry.studentId,
          status: entry.status,
          remarks: entry.remarks ?? null,
        })),
      );
      res.json(saved);
    },
  );

  // #75 — ek student ki hajri history (month=YYYY-MM diya to sirf wo
  // mahina, warna saari). Parent: sirf apna linked baccha
  // (loadStudentInScope — dusra baccha 404).
  app.get(
    "/api/students/:id/attendance",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      if (month !== undefined && !MONTH_TEXT_RE.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }
      const rows = await storage.getStudentAttendance(
        loaded.student.id,
        month,
      );
      res.json(rows);
    },
  );

  // #76 — ek student ka mahina-summary (present/absent/late/half_day
  // ginti + percentage). month na diya to chal raha mahina.
  app.get(
    "/api/students/:id/attendance/summary",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const month =
        typeof req.query.month === "string" ? req.query.month : currentMonth;
      if (!MONTH_TEXT_RE.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }
      const summary = await storage.getStudentAttendanceSummary(
        loaded.student.id,
        month,
      );
      res.json(summary);
    },
  );

  // ---------------------------------------------------------------------
  // Notices (§5.8 #70–72) — audience: all | teachers | parents.
  // Parent ko teachers-wale notices kabhi nahi; teacher/staff ko
  // parents-wale nahi. Principal/accountant/super-hooked roles sab
  // dekh sakte hain (principal sab, accountant read-only).
  // ---------------------------------------------------------------------

  const noticeVisibleTo = (
    audience: string | null,
    role: string,
  ): boolean => {
    if (role === "principal" || role === "super_admin") return true;
    if (audience === "all") return true;
    if (audience === "teachers") {
      return role === "teacher" || role === "accountant";
    }
    if (audience === "parents") {
      return role === "parent" || role === "accountant";
    }
    return false;
  };

  const loadNoticeInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; notice: NonNullable<Awaited<ReturnType<typeof storage.getNotice>>> } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const notice = await storage.getNotice(id);
    if (!notice || notice.schoolId !== schoolId) {
      res.status(404).json({ message: "Notice not found" });
      return null;
    }
    return { schoolId, notice };
  };

  // #70 — notices list (koi bhi logged-in user, audience filter ke saath).
  app.get("/api/notices", requireAuth, async (req, res) => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return;
    const all = await storage.getNotices(schoolId);
    res.json(
      all.filter((notice) => noticeVisibleTo(notice.audience, req.user!.role)),
    );
  });

  // #71 — notice create.
  app.post(
    "/api/notices",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createNoticeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const notice = await storage.createNotice({
        schoolId,
        title: result.data.title,
        body: result.data.body ?? null,
        audience: result.data.audience ?? "all",
        createdBy: req.user!.id,
      });
      res.status(201).json(notice);
    },
  );

  // #72a — notice update. Principal kisi ka bhi; teacher sirf APNA
  // banaya hua (dusre ka = 404, §5.8).
  app.put(
    "/api/notices/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadNoticeInScope(req, res);
      if (!loaded) return;
      if (
        req.user!.role === "teacher" &&
        loaded.notice.createdBy !== req.user!.id
      ) {
        return res.status(404).json({ message: "Notice not found" });
      }
      const result = updateNoticeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const notice = await storage.updateNotice(loaded.notice.id, {
        ...(result.data.title !== undefined
          ? { title: result.data.title }
          : {}),
        ...(result.data.body !== undefined ? { body: result.data.body } : {}),
        ...(result.data.audience !== undefined
          ? { audience: result.data.audience }
          : {}),
        updatedAt: new Date(),
      });
      res.json(notice);
    },
  );

  // #72b — notice delete (ownership niyam update jaisa hi).
  app.delete(
    "/api/notices/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadNoticeInScope(req, res);
      if (!loaded) return;
      if (
        req.user!.role === "teacher" &&
        loaded.notice.createdBy !== req.user!.id
      ) {
        return res.status(404).json({ message: "Notice not found" });
      }
      await storage.deleteNotice(loaded.notice.id);
      res.json({ message: "Notice deleted" });
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
