import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { storage, type IStorage } from "./storage";
import { api } from "@shared/routes";
import {
  insertAcademicStreamSchema,
  insertNoticeSchema,
  insertHomeworkSchema,
  insertTimetableEntrySchema,
  insertLeaveRequestSchema,
  insertCertificateSchema,
  insertTransportRouteSchema,
  insertStudentTransportAllocationSchema,
} from "@shared/schema";
import { parseCsv, toCsv } from "./csv";
import { createNativeDump, newBackupKey, removeBackup, restoreNativeDump, safeBackupPath, restoreInProgress } from "./backup";
import { calculateReportTotals } from "./report-card";
import {
  currentUser,
  requireAuth,
  requireRole,
  toAuthenticatedUser,
  toPublicUser,
  verifyPassword,
  hashPassword,
  csrfProtection,
} from "./auth";

const idSchema = z.coerce.number().int().positive();
const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

function safeStudent(student: Awaited<ReturnType<typeof storage.getStudent>>) {
  if (!student) return student;
  const { aadhaar: _aadhaar, photo: _photo, ...safe } = student;
  return safe;
}

function routeId(value: string | string[]): number {
  return idSchema.parse(Array.isArray(value) ? value[0] : value);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  dataStore: IStorage = storage,
): Promise<Server> {
  const audit = async (input: { schoolId?: number | null; sessionId?: number | null; actorUserId?: number | null; actorRole?: string | null; action: string; targetType?: string | null; targetId?: number | null; metadata?: Record<string, unknown> }) => { if (typeof (dataStore as any).createAuditEvent !== "function") return; try { await (dataStore as any).createAuditEvent({ schoolId: input.schoolId ?? null, sessionId: input.sessionId ?? null, actorUserId: input.actorUserId ?? null, actorRole: input.actorRole ?? null, action: input.action, targetType: input.targetType ?? null, targetId: input.targetId ?? null, metadata: input.metadata ? JSON.stringify(input.metadata) : null }); } catch { /* audit failure must not break the protected business operation */ } };
  app.use(csrfProtection);
  app.use(async (req, res, next) => { const sessionUser = req.session.user; const getState = (dataStore as any).getUserAuthState; if (!sessionUser || typeof getState !== "function") return next(); try { const current = await getState(sessionUser.id); if (!current || !current.isActive || current.schoolId !== sessionUser.schoolId || current.role !== sessionUser.role || (sessionUser.authVersion !== undefined && current.authVersion !== sessionUser.authVersion)) { req.session.destroy(() => undefined); return res.status(401).json({ message: "Authentication required" }); } next(); } catch { return res.status(503).json({ message: "Authentication service unavailable" }); } });
  app.use((req, res, next) => { const actor = req.session.user; if (actor && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.path !== "/api/auth/login") { const targetMatch = req.path.match(/\/(\d+)(?:\/|$)/); res.on("finish", () => { void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: `${req.method} ${req.path}`, targetType: req.path.split("/")[2] || null, targetId: targetMatch ? Number(targetMatch[1]) : null, metadata: { status: res.statusCode } }); }); } next(); });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = credentialsSchema.parse(req.body);
    const user = await dataStore.getUserByUsername(username);
    const security = user && typeof (dataStore as any).getUserAuthState === "function" ? await (dataStore as any).getUserAuthState(user.id).catch(() => undefined) : undefined;
    const locked = security?.lockedUntil && new Date(security.lockedUntil).getTime() > Date.now();
    const validPassword = !!user && !!user.schoolId && await verifyPassword(password, user.passwordHash);
    if (!user || !user.schoolId || security?.isActive === false || locked || !validPassword) {
      if (user && !validPassword && typeof (dataStore as any).recordLoginFailure === "function") { const state = await (dataStore as any).recordLoginFailure(user.id).catch(() => undefined); if (state?.lockedUntil) void audit({ schoolId: user.schoolId, actorUserId: user.id, actorRole: user.role, action: "account.locked", targetType: "user", targetId: user.id }); }
      if (user?.schoolId) void audit({ schoolId: user.schoolId, actorUserId: user.id, actorRole: user.role, action: "auth.login.failure", targetType: "user", targetId: user.id });
      return res.status(401).json({ message: "Invalid username or password" });
    }
    if (typeof (dataStore as any).resetLoginFailures === "function") await (dataStore as any).resetLoginFailures(user.id).catch(() => undefined);

    const authenticatedUser = toAuthenticatedUser(user);
    if (security?.authVersion !== undefined) authenticatedUser.authVersion = security.authVersion;
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    req.session.user = authenticatedUser;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    void audit({ schoolId: user.schoolId, actorUserId: user.id, actorRole: user.role, action: "auth.login.success", targetType: "user", targetId: user.id });
    return res.json({ user: toPublicUser(authenticatedUser) });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const actor = currentUser(req); void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: "auth.logout", targetType: "user", targetId: actor.id });
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    res.clearCookie("school_suite.sid");
    return res.status(204).send();
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({ user: toPublicUser(currentUser(req)), csrfToken: req.session.csrfToken ?? null });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const input = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200).regex(/[A-Z]/, "New password needs an uppercase letter").regex(/[a-z]/, "New password needs a lowercase letter").regex(/[0-9]/, "New password needs a number").regex(/[^A-Za-z0-9]/, "New password needs a symbol"), confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] }).parse(req.body);
    const actor = currentUser(req); const user = await dataStore.getUser(actor.id); if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) return res.status(400).json({ message: "Current password is incorrect" });
    if (input.currentPassword === input.newPassword) return res.status(400).json({ message: "New password must be different" });
    if (typeof (dataStore as any).updateUserPassword !== "function") return res.status(503).json({ message: "Password service unavailable" });
    await (dataStore as any).updateUserPassword(actor.id, await hashPassword(input.newPassword));
    void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: "auth.password.change", targetType: "user", targetId: actor.id });
    const refreshed = typeof (dataStore as any).getUserAuthState === "function" ? await (dataStore as any).getUserAuthState(actor.id) : undefined;
    await new Promise<void>((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.user = { ...actor, authVersion: refreshed?.authVersion };
    return res.json({ message: "Password changed successfully" });
  });

  // === Audit history and account security ===
  app.get("/api/audit-events", requireRole("admin", "principal"), async (req,res) => { const user=currentUser(req); const limit=typeof req.query.limit === "string" ? Math.min(Number(req.query.limit),500) : 200; const events=typeof (dataStore as any).getAuditEvents === "function" ? await (dataStore as any).getAuditEvents(user.schoolId,limit) : []; res.json(events.map((event:any)=>({id:event.id,schoolId:event.schoolId,sessionId:event.sessionId,actorUserId:event.actorUserId,actorRole:event.actorRole,action:event.action,targetType:event.targetType,targetId:event.targetId,metadata:event.metadata,createdAt:event.createdAt}))); });
  app.post("/api/school-users/:id/unlock", requireRole("admin"), async (req,res) => { const user=currentUser(req); const id=routeId(req.params.id); const unlocked=typeof (dataStore as any).unlockUser === "function" && await (dataStore as any).unlockUser(id,user.schoolId); if(!unlocked)return res.status(404).json({message:"User not found"}); void audit({schoolId:user.schoolId,actorUserId:user.id,actorRole:user.role,action:"account.unlock",targetType:"user",targetId:id}); res.json({message:"Account unlocked"}); });

  // === School management ===
  app.get("/api/school-users", requireRole("admin", "principal"), async (req, res) => {
    const actor = currentUser(req);
    const users = await dataStore.getUsersBySchool(actor.schoolId);
    const enriched = await Promise.all(users.map(async ({ id, username, name, role, schoolId }) => {
      const state = typeof (dataStore as any).getUserAuthState === "function" ? await (dataStore as any).getUserAuthState(id).catch(() => undefined) : undefined;
      return { id, username, name, role, schoolId, isActive: state?.isActive ?? true, failedLoginAttempts: state?.failedLoginAttempts ?? 0, lockedUntil: state?.lockedUntil ?? null };
    }));
    res.json(enriched);
  });
  app.post("/api/school-users", requireRole("admin", "principal"), async (req, res) => {
    const actor = currentUser(req);
    const input = z.object({
      username: z.string().trim().min(2, "Login ID / Email must be at least 2 characters").max(120),
      name: z.string().trim().min(1, "Name is required").max(120),
      role: z.enum(["admin", "principal", "accountant", "teacher", "staff", "student"]),
      password: z.string().min(6, "Password must be at least 6 characters").max(200),
      staffId: z.number().int().positive().nullable().optional(),
      studentId: z.number().int().positive().nullable().optional(),
    }).parse(req.body);
    if (actor.role === "principal" && input.role === "admin") {
      return res.status(403).json({ message: "Principals cannot create administrator accounts" });
    }
    const existing = await dataStore.getUserByUsername(input.username);
    if (existing) return res.status(409).json({ message: `Login ID / Email "${input.username}" already exists` });
    const created = await dataStore.createUser({
      username: input.username,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      schoolId: actor.schoolId,
    });
    if (input.staffId && ["teacher", "staff", "principal", "accountant"].includes(input.role)) {
      try {
        await dataStore.createStaffUserLink({
          staffId: input.staffId,
          userId: created.id,
          schoolId: actor.schoolId,
        });
      } catch {
        // Ignore if already linked
      }
    }
    if (input.studentId && input.role === "student") {
      const session = await dataStore.getActiveSession(actor.schoolId);
      if (session) {
        try {
          await dataStore.createStudentUserLink({
            studentId: input.studentId,
            userId: created.id,
            schoolId: actor.schoolId,
            sessionId: session.id,
          });
        } catch {
          // Ignore if already linked
        }
      }
    }
    void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: "user.create", targetType: "user", targetId: created.id, metadata: { role: created.role } });
    res.status(201).json({ id: created.id, username: created.username, name: created.name, role: created.role, schoolId: created.schoolId, isActive: true });
  });
  app.post("/api/school-users/:id/reset-password", requireRole("admin", "principal"), async (req, res) => {
    const actor = currentUser(req);
    const id = routeId(req.params.id);
    const { newPassword } = z.object({ newPassword: z.string().min(6).max(200) }).parse(req.body);
    const target = await dataStore.getUser(id);
    if (!target || target.schoolId !== actor.schoolId) {
      return res.status(404).json({ message: "User not found in this school" });
    }
    if (actor.role === "principal" && target.role === "admin") {
      return res.status(403).json({ message: "Principals cannot reset administrator passwords" });
    }
    await dataStore.updateUserPassword(id, await hashPassword(newPassword));
    await dataStore.resetLoginFailures(id);
    void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: "account.password_reset", targetType: "user", targetId: id });
    res.json({ message: "Password reset successfully" });
  });
  app.patch("/api/school-users/:id/status", requireRole("admin"), async (req, res) => {
    const actor = currentUser(req);
    const id = routeId(req.params.id);
    if (id === actor.id) return res.status(400).json({ message: "Cannot deactivate your own account" });
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    if (typeof (dataStore as any).setUserActiveStatus !== "function") return res.status(503).json({ message: "User status service unavailable" });
    const ok = await (dataStore as any).setUserActiveStatus(id, actor.schoolId, isActive);
    if (!ok) return res.status(404).json({ message: "User not found" });
    void audit({ schoolId: actor.schoolId, actorUserId: actor.id, actorRole: actor.role, action: isActive ? "account.activate" : "account.deactivate", targetType: "user", targetId: id });
    res.json({ id, isActive });
  });
  app.get("/api/student-user-links", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getStudentUserLinks !== "function") return res.json([]);
    res.json(await (dataStore as any).getStudentUserLinks(user.schoolId, session.id));
  });
  app.get("/api/payroll/staff-links", requireRole("admin", "principal", "accountant"), async (req, res) => {
    const user = currentUser(req);
    if (typeof (dataStore as any).getStaffUserLinks !== "function") return res.json([]);
    res.json(await (dataStore as any).getStaffUserLinks(user.schoolId));
  });
  app.get("/api/academic-sessions", requireAuth, async (req, res) => res.json(await dataStore.getAcademicSessions(currentUser(req).schoolId)));
  app.post("/api/academic-sessions", requireRole("admin", "principal"), async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(100), startDate: z.string().optional().nullable(), endDate: z.string().optional().nullable(), isActive: z.boolean().optional() }).parse(req.body);
    const user = currentUser(req); const session = await dataStore.createAcademicSession({ ...input, schoolId: user.schoolId, isActive: false });
    res.status(201).json(session);
  });
  app.patch("/api/academic-sessions/:id", requireRole("admin", "principal"), async (req, res) => {
    const input = z.object({ name: z.string().trim().min(1).max(100).optional(), startDate: z.string().nullable().optional(), endDate: z.string().nullable().optional() }).parse(req.body);
    const result = await dataStore.updateAcademicSession(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!result) return res.status(404).json({ message: "Session not found" }); res.json(result);
  });
  app.post("/api/academic-sessions/:id/activate", requireRole("admin", "principal"), async (req, res) => {
    const result = await dataStore.activateAcademicSession(routeId(req.params.id), currentUser(req).schoolId);
    if (!result) return res.status(404).json({ message: "Session not found" }); res.json(result);
  });
  app.get("/api/management/classes", requireAuth, async (req, res) => {
    const user = currentUser(req); const sessionId = idSchema.parse(req.query.sessionId);
    res.json(await dataStore.getClasses(user.schoolId, sessionId));
  });
  app.post("/api/management/classes", requireRole("admin", "principal"), async (req, res) => {
    const input = z.object({ sessionId: z.number().int().positive(), name: z.string().trim().min(1).max(100), displayOrder: z.number().int().optional(), isActive: z.boolean().optional() }).parse(req.body); const user = currentUser(req);
    res.status(201).json(await dataStore.createClass({ ...input, schoolId: user.schoolId, isActive: input.isActive ?? true }));
  });
  app.patch("/api/management/classes/:id", requireRole("admin", "principal"), async (req, res) => { const user=currentUser(req); const sessionId=idSchema.parse(req.body.sessionId); const input=z.object({name:z.string().trim().min(1).max(100).optional(),displayOrder:z.number().int().optional(),isActive:z.boolean().optional()}).parse(req.body); const result=await dataStore.updateClass(routeId(req.params.id),user.schoolId,sessionId,input); if(!result)return res.status(404).json({message:"Class not found"}); res.json(result); });
  app.delete("/api/management/classes/:id", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const active = await dataStore.getActiveSession(user.schoolId);
    const sessionId = req.query.sessionId ? idSchema.parse(req.query.sessionId) : active?.id;
    if (!sessionId) return res.status(409).json({ message: "No active academic session" });
    if (typeof (dataStore as any).deleteClass !== "function") return res.status(503).json({ message: "Delete class unavailable" });
    const deleted = await (dataStore as any).deleteClass(routeId(req.params.id), user.schoolId, sessionId);
    if (!deleted) return res.status(404).json({ message: "Class not found" });
    res.status(204).send();
  });
  app.get("/api/management/sections", requireAuth, async (req, res) => { const user=currentUser(req); res.json(await dataStore.getSections(user.schoolId,idSchema.parse(req.query.sessionId),req.query.classId ? idSchema.parse(req.query.classId) : undefined)); });
  app.post("/api/management/sections", requireRole("admin", "principal"), async (req, res) => { const input=z.object({sessionId:z.number().int().positive(),classId:z.number().int().positive(),name:z.string().trim().min(1).max(50),displayOrder:z.number().int().optional(),isActive:z.boolean().optional()}).parse(req.body); const user=currentUser(req); res.status(201).json(await dataStore.createSection({...input,schoolId:user.schoolId,isActive:input.isActive ?? true})); });
  app.patch("/api/management/sections/:id", requireRole("admin", "principal"), async (req, res) => { const user=currentUser(req); const sessionId=idSchema.parse(req.body.sessionId); const input=z.object({name:z.string().trim().min(1).max(50).optional(),displayOrder:z.number().int().optional(),isActive:z.boolean().optional()}).parse(req.body); const result=await dataStore.updateSection(routeId(req.params.id),user.schoolId,sessionId,input); if(!result)return res.status(404).json({message:"Section not found"}); res.json(result); });
  app.delete("/api/management/sections/:id", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const active = await dataStore.getActiveSession(user.schoolId);
    const sessionId = req.query.sessionId ? idSchema.parse(req.query.sessionId) : active?.id;
    if (!sessionId) return res.status(409).json({ message: "No active academic session" });
    if (typeof (dataStore as any).deleteSection !== "function") return res.status(503).json({ message: "Delete section unavailable" });
    const deleted = await (dataStore as any).deleteSection(routeId(req.params.id), user.schoolId, sessionId);
    if (!deleted) return res.status(404).json({ message: "Section not found" });
    res.status(204).send();
  });

  // === Academic Streams & Board Presets (Class 11–12 PCM, PCB, Commerce, Arts, Agriculture) ===
  app.get("/api/academic-streams", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getAcademicStreams !== "function") return res.json([]);
    res.json(await (dataStore as any).getAcademicStreams(user.schoolId, session.id));
  });

  app.post("/api/academic-streams", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertAcademicStreamSchema.parse(req.body);
    const created = await (dataStore as any).createAcademicStream({
      ...input,
      schoolId: user.schoolId,
      sessionId: session.id,
      boardPattern: input.boardPattern ?? "MPBSE",
      applicableClasses: input.applicableClasses ?? "11,12",
      compulsorySubjects: input.compulsorySubjects ?? "",
      coreSubjects: input.coreSubjects ?? "",
      electiveOptions: input.electiveOptions ?? "",
      maxElectives: input.maxElectives ?? 1,
      isActive: true,
    });
    res.status(201).json(created);
  });

  app.delete("/api/academic-streams/:id", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await (dataStore as any).deleteAcademicStream(routeId(req.params.id), user.schoolId, session.id);
    if (!deleted) return res.status(404).json({ message: "Stream not found" });
    res.status(204).send();
  });

  app.post("/api/academic-streams/preset", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const { board } = z.object({ board: z.enum(["MPBSE", "CBSE", "STATE", "ICSE"]) }).parse(req.body);

    const presetsByBoard: Record<string, Array<{
      name: string;
      code: string;
      compulsorySubjects: string;
      coreSubjects: string;
      electiveOptions: string;
      maxElectives: number;
    }>> = {
      MPBSE: [
        {
          name: "Science — Mathematics Group (PCM / गणित संकाय)",
          code: "PCM",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Physics, Chemistry, Mathematics",
          electiveOptions: "Computer Science, Informatics Practices, Physical Education, Sanskrit",
          maxElectives: 1,
        },
        {
          name: "Science — Biology Group (PCB / जीव विज्ञान संकाय)",
          code: "PCB",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Physics, Chemistry, Biology",
          electiveOptions: "Informatics Practices, Physical Education, Biotechnology, Mathematics (Additional)",
          maxElectives: 1,
        },
        {
          name: "Science — Maths + Biology Combined (PCMB)",
          code: "PCMB",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Physics, Chemistry, Mathematics, Biology",
          electiveOptions: "Physical Education, Computer Science",
          maxElectives: 1,
        },
        {
          name: "Commerce Group (वाणिज्य संकाय)",
          code: "COMMERCE",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Book Keeping & Accountancy, Business Studies",
          electiveOptions: "Economics, Informatics Practices, Business Mathematics, Industrial Organisation, Physical Education",
          maxElectives: 2,
        },
        {
          name: "Arts / Humanities Group (कला संकाय)",
          code: "ARTS",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "History, Political Science",
          electiveOptions: "Geography, Economics, Sociology, Psychology, Sanskrit, Home Science, Drawing & Painting",
          maxElectives: 2,
        },
        {
          name: "Agriculture Group (कृषि संकाय)",
          code: "AGRICULTURE",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Elements of Science & Maths for Agriculture, Crop Production & Horticulture, Animal Husbandry & Poultry Farming",
          electiveOptions: "Physical Education, Computer Basics",
          maxElectives: 1,
        },
      ],
      CBSE: [
        {
          name: "Science — Engineering (PCM)",
          code: "PCM",
          compulsorySubjects: "English Core",
          coreSubjects: "Physics, Chemistry, Mathematics",
          electiveOptions: "Computer Science, Informatics Practices, Physical Education, Economics, Hindi Core, Engineering Graphics",
          maxElectives: 2,
        },
        {
          name: "Science — Medical (PCB)",
          code: "PCB",
          compulsorySubjects: "English Core",
          coreSubjects: "Physics, Chemistry, Biology",
          electiveOptions: "Physical Education, Psychology, Biotechnology, Informatics Practices, Hindi Core, Mathematics",
          maxElectives: 2,
        },
        {
          name: "Commerce Stream",
          code: "COMMERCE",
          compulsorySubjects: "English Core",
          coreSubjects: "Accountancy, Business Studies, Economics",
          electiveOptions: "Mathematics, Applied Mathematics, Informatics Practices, Entrepreneurship, Physical Education, Hindi Core",
          maxElectives: 2,
        },
        {
          name: "Humanities / Arts Stream",
          code: "ARTS",
          compulsorySubjects: "English Core",
          coreSubjects: "History, Political Science",
          electiveOptions: "Geography, Economics, Sociology, Psychology, Fine Arts, Physical Education, Hindi Core, Legal Studies",
          maxElectives: 3,
        },
      ],
      STATE: [
        {
          name: "Science — Mathematics (PCM)",
          code: "PCM",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Physics, Chemistry, Mathematics",
          electiveOptions: "Computer Science, Physical Education, Sanskrit",
          maxElectives: 1,
        },
        {
          name: "Science — Biology (PCB)",
          code: "PCB",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Physics, Chemistry, Biology",
          electiveOptions: "Computer Science, Physical Education, Agriculture",
          maxElectives: 1,
        },
        {
          name: "Commerce",
          code: "COMMERCE",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Accountancy, Business Organisation / Studies, Economics",
          electiveOptions: "Mathematics, Computer Application, Banking",
          maxElectives: 1,
        },
        {
          name: "Arts / Humanities",
          code: "ARTS",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "History, Civics / Political Science",
          electiveOptions: "Geography, Economics, Sociology, Education, Sanskrit, Home Science",
          maxElectives: 2,
        },
        {
          name: "Agriculture",
          code: "AGRICULTURE",
          compulsorySubjects: "Hindi, English",
          coreSubjects: "Agronomy / Crop Production, Animal Husbandry, Agricultural Science",
          electiveOptions: "Physical Education",
          maxElectives: 1,
        },
      ],
      ICSE: [
        {
          name: "ISC Science (PCM / PCB)",
          code: "SCIENCE",
          compulsorySubjects: "English",
          coreSubjects: "Physics, Chemistry",
          electiveOptions: "Mathematics, Biology, Computer Science, Biotechnology, Physical Education, Economics",
          maxElectives: 3,
        },
        {
          name: "ISC Commerce",
          code: "COMMERCE",
          compulsorySubjects: "English",
          coreSubjects: "Accounts, Commerce, Economics",
          electiveOptions: "Mathematics, Business Studies, Computer Science, Physical Education",
          maxElectives: 2,
        },
        {
          name: "ISC Humanities",
          code: "ARTS",
          compulsorySubjects: "English",
          coreSubjects: "History, Political Science",
          electiveOptions: "Geography, Sociology, Psychology, Economics, Art, Legal Studies",
          maxElectives: 3,
        },
      ],
    };

    const boardLabelMap: Record<string, string> = {
      MPBSE: "MP Board (MPBSE)",
      CBSE: "CBSE (Central Board)",
      STATE: "State Board (UP / RBSE / Bihar / CG / MH)",
      ICSE: "ICSE / ISC Board",
    };

    await dataStore.updateSchool(user.schoolId, { boardAffiliation: boardLabelMap[board] } as any);

    const existingSubjects = await dataStore.getSubjects(user.schoolId, session.id);
    const existingSubjectNames = new Set(existingSubjects.map((s) => s.name.toLowerCase()));

    const createdStreams = [];
    for (const preset of presetsByBoard[board] ?? []) {
      const stream = await (dataStore as any).createAcademicStream({
        schoolId: user.schoolId,
        sessionId: session.id,
        name: preset.name,
        code: preset.code,
        boardPattern: board,
        applicableClasses: "11,12",
        compulsorySubjects: preset.compulsorySubjects,
        coreSubjects: preset.coreSubjects,
        electiveOptions: preset.electiveOptions,
        maxElectives: preset.maxElectives,
        isActive: true,
      });
      createdStreams.push(stream);

      const allStreamSubjects = [
        ...preset.compulsorySubjects.split(",").map((s) => ({ name: s.trim(), type: "compulsory_language" as const })),
        ...preset.coreSubjects.split(",").map((s) => ({ name: s.trim(), type: "core" as const })),
        ...preset.electiveOptions.split(",").map((s) => ({ name: s.trim(), type: "elective" as const })),
      ].filter((item) => item.name.length > 0);

      for (const subj of allStreamSubjects) {
        if (!existingSubjectNames.has(subj.name.toLowerCase())) {
          existingSubjectNames.add(subj.name.toLowerCase());
          try {
            await dataStore.createSubject({
              schoolId: user.schoolId,
              sessionId: session.id,
              name: subj.name,
              code: `${preset.code.slice(0, 3)}-${subj.name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}`,
              stream: preset.code,
              subjectType: subj.type,
              applicableClasses: "11,12",
              isActive: true,
            });
          } catch {
            // Ignore duplicate code/name
          }
        }
      }
    }

    res.status(201).json({ board: boardLabelMap[board], streams: createdStreams });
  });

  app.put("/api/students/:id/stream", requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const studentId = routeId(req.params.id);
    const input = z.object({
      stream: z.string().max(120).nullable().optional(),
      streamId: z.number().int().positive().nullable().optional(),
      electedSubjects: z.string().max(1500).nullable().optional(),
    }).parse(req.body);
    const student = await dataStore.getStudent(studentId, user.schoolId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const updated = await dataStore.updateStudent(studentId, user.schoolId, {
      stream: input.stream ?? null,
      streamId: input.streamId ?? null,
      electedSubjects: input.electedSubjects ?? null,
    });
    res.json(updated);
  });

  // === Database backups ===
  const backupAdmin = requireRole("admin");
  const backupDto = (value: any) => ({ id: value.id, schoolId: value.schoolId, createdAt: value.createdAt, backupType: value.backupType, status: value.status, sizeBytes: value.sizeBytes, restoreStatus: value.restoreStatus, restoreStartedAt: value.restoreStartedAt, restoreCompletedAt: value.restoreCompletedAt, errorMessage: value.errorMessage });
  app.post("/api/backups", backupAdmin, async (req, res) => { const user=currentUser(req); const storageKey=newBackupKey(); const record=await dataStore.createBackupRecord({schoolId:user.schoolId,createdByUserId:user.id,createdAt:new Date(),backupType:"postgres-custom",status:"pending",sizeBytes:null,storageKey,restoreStatus:null,restoreStartedAt:null,restoreCompletedAt:null,errorMessage:null}); try { const size=await createNativeDump(storageKey); const completed=await dataStore.updateBackupRecord(record.id,user.schoolId,{status:"completed",sizeBytes:size,errorMessage:null}); return res.status(201).json(backupDto(completed)); } catch(error) { const failed=await dataStore.updateBackupRecord(record.id,user.schoolId,{status:"failed",errorMessage:error instanceof Error ? error.message : "Backup failed"}); return res.status(503).json(backupDto(failed)); } });
  app.get("/api/backups", backupAdmin, async (req,res)=>res.json((await dataStore.getBackups(currentUser(req).schoolId)).map(backupDto)));
  app.get("/api/backups/:id", backupAdmin, async (req,res)=>{const value=await dataStore.getBackup(routeId(req.params.id),currentUser(req).schoolId);if(!value||value.status==="deleted")return res.status(404).json({message:"Backup not found"});res.json(backupDto(value));});
  app.get("/api/backups/:id/download", backupAdmin, async (req,res)=>{const value=await dataStore.getBackup(routeId(req.params.id),currentUser(req).schoolId);if(!value||value.status!=="completed")return res.status(404).json({message:"Backup not found"});try{const file=safeBackupPath(value.storageKey);res.download(file,`school-backup-${value.id}.dump`,(error)=>{if(error&&!res.headersSent)res.status(404).json({message:"Backup not available"});});}catch{res.status(404).json({message:"Backup not found"});}});
  app.delete("/api/backups/:id", backupAdmin, async (req,res)=>{const user=currentUser(req);const value=await dataStore.getBackup(routeId(req.params.id),user.schoolId);if(!value)return res.status(404).json({message:"Backup not found"});await removeBackup(value.storageKey);await dataStore.deleteBackupRecord(value.id,user.schoolId);res.status(204).send();});
  app.post("/api/backups/:id/restore", backupAdmin, async (req,res)=>{const user=currentUser(req);if(req.body?.confirmation!=="RESTORE_DATABASE")return res.status(400).json({message:"Explicit confirmation is required"});if(restoreInProgress)return res.status(409).json({message:"Another restore is already in progress"});const value=await dataStore.getBackup(routeId(req.params.id),user.schoolId);if(!value||value.status!=="completed")return res.status(404).json({message:"Backup not found"});const safetyKey=newBackupKey();let safety:any;try{const safetyRecord=await dataStore.createBackupRecord({schoolId:user.schoolId,createdByUserId:user.id,createdAt:new Date(),backupType:"postgres-custom",status:"pending",sizeBytes:null,storageKey:safetyKey,restoreStatus:null,restoreStartedAt:null,restoreCompletedAt:null,errorMessage:null});const size=await createNativeDump(safetyKey);safety=await dataStore.updateBackupRecord(safetyRecord.id,user.schoolId,{status:"completed",sizeBytes:size});await dataStore.updateBackupRecord(value.id,user.schoolId,{restoreStatus:"running",restoreStartedAt:new Date(),errorMessage:null});await restoreNativeDump(value.storageKey);const done=await dataStore.updateBackupRecord(value.id,user.schoolId,{restoreStatus:"completed",restoreCompletedAt:new Date()});return res.json({message:"Database restored",backup:backupDto(done),safetyBackupId:safety?.id});}catch(error){await dataStore.updateBackupRecord(value.id,user.schoolId,{restoreStatus:"failed",errorMessage:error instanceof Error?error.message:"Restore failed"});return res.status(503).json({message:error instanceof Error?error.message:"Restore failed",safetyBackupId:safety?.id});}});

  // === Documents, imports, exports and reports ===
  const management = requireRole("admin", "principal");
  app.get("/api/documents", requireAuth, async (req, res) => {
    const user = currentUser(req); const sessionId = req.query.sessionId ? idSchema.parse(req.query.sessionId) : undefined;
    if (user.role === "student") { const session = await dataStore.getActiveSession(user.schoolId); const student = session ? await dataStore.getStudentForUser(user.id, user.schoolId, session.id) : undefined; if (!student) return res.json([]); const docs = await dataStore.getDocuments(user.schoolId, session?.id); return res.json(docs.filter((d) => d.ownerType === "student" && d.ownerId === student.id)); }
    if (!["admin", "principal", "teacher"].includes(user.role)) return res.status(403).json({ message: "Document access is not authorized" });
    const docs = await dataStore.getDocuments(user.schoolId, sessionId);
    if (user.role === "teacher") { const session = sessionId ? (await dataStore.getAcademicSessions(user.schoolId)).find((value) => value.id === sessionId) : await dataStore.getActiveSession(user.schoolId); if (!session) return res.json([]); const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id); const allowed = new Set((await Promise.all(assignments.map((assignment) => dataStore.getStudents(user.schoolId, { class: assignment.className, section: assignment.section }, session.id)))).flat().map((student) => student.id)); return res.json(docs.filter((document) => document.ownerType !== "student" || allowed.has(document.ownerId ?? -1))); }
    res.json(docs);
  });
  app.post("/api/documents/metadata", management, async (req, res) => {
    const input = z.object({ sessionId: z.number().int().positive().nullable().optional(), ownerType: z.enum(["student", "staff", "school"]), ownerId: z.number().int().positive().nullable().optional(), documentType: z.string().trim().min(1).max(60), filename: z.string().trim().regex(/^[^\\/\\\\]{1,180}$/), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).parse(req.body); const user = currentUser(req);
    if (input.ownerType === "student") { const owner = await dataStore.getStudent(input.ownerId!, user.schoolId); if (!owner || (input.sessionId && owner.sessionId !== input.sessionId)) return res.status(404).json({ message: "Document owner not found" }); }
    if (input.ownerType === "staff") { const owner = (await dataStore.getStaff(user.schoolId)).find((value) => value.id === input.ownerId); if (!owner) return res.status(404).json({ message: "Document owner not found" }); }
    if (input.sessionId && !(await dataStore.getAcademicSessions(user.schoolId)).some((session) => session.id === input.sessionId)) return res.status(404).json({ message: "Session not found" });
    const document = await dataStore.createDocument({ ...input, schoolId: user.schoolId, ownerId: input.ownerId ?? null, sessionId: input.sessionId ?? null, storageKey: `metadata-only/${user.schoolId}/${randomUUID()}`, uploadedByUserId: user.id, isActive: true });
    res.status(201).json({ id: document.id, schoolId: document.schoolId, sessionId: document.sessionId, ownerType: document.ownerType, ownerId: document.ownerId, documentType: document.documentType, filename: document.filename, mimeType: document.mimeType, sizeBytes: document.sizeBytes, isActive: document.isActive, uploadedAt: document.uploadedAt });
  });
  app.delete("/api/documents/:id", management, async (req, res) => { const value=await dataStore.deactivateDocument(routeId(req.params.id),currentUser(req).schoolId); if(!value)return res.status(404).json({message:"Document not found"}); res.json({id:value.id,isActive:value.isActive}); });
  const importCsv = async (req: any, res: any, kind: "students" | "staff") => { try { const user=currentUser(req); const parsed=parseCsv(typeof req.body === "string" ? req.body : ""); if (kind === "students") { const session=await dataStore.getActiveSession(user.schoolId); if(!session)return res.status(409).json({message:"No active session"}); const result=await dataStore.importStudents(user.schoolId,session.id,parsed.rows); return res.status(201).json({created:result.created.length,errors:result.errors}); } const result=await dataStore.importStaff(user.schoolId,parsed.rows); return res.status(201).json({created:result.created.length,errors:result.errors}); } catch (error) { const message=error instanceof Error ? error.message : "Import failed"; try { const parsed=JSON.parse(message); if(parsed.importErrors)return res.status(422).json(parsed); } catch {} return res.status(400).json({message}); } };
  app.post("/api/import/students", requireRole("admin", "principal", "accountant"), (req,res)=>importCsv(req,res,"students"));
  app.post("/api/import/staff", management, (req,res)=>importCsv(req,res,"staff"));
  app.get("/api/export/students", requireRole("admin", "principal", "accountant"), async (req,res) => { const user=currentUser(req); const session=await dataStore.getActiveSession(user.schoolId); if(!session)return res.status(409).json({message:"No active session"}); const rows=await dataStore.getStudents(user.schoolId,undefined,session.id); const csv=toCsv(["admissionNo","name","fatherName","class","section","rollNo","contact","isActive"],rows); res.type("text/csv").set("Content-Disposition","attachment; filename=students.csv").send(csv); });
  app.get("/api/export/staff", requireRole("admin", "principal", "accountant"), async (req,res) => { const rows=await dataStore.getStaff(currentUser(req).schoolId); const csv=toCsv(["name","designation","contact","joinDate"],rows); res.type("text/csv").set("Content-Disposition","attachment; filename=staff.csv").send(csv); });
  app.get("/api/reports/overview", requireAuth, async (req,res) => { const user=currentUser(req); const session=await dataStore.getActiveSession(user.schoolId); if(!session)return res.json({session:null}); if(user.role === "student") { const student=await dataStore.getStudentForUser(user.id,user.schoolId,session.id); if(!student)return res.status(404).json({message:"Student not found"}); const [attendance,results]=await Promise.all([dataStore.getAttendance(user.schoolId,session.id,{studentId:student.id}),dataStore.getExamResults(user.schoolId,session.id,{studentId:student.id,status:"published"})]); return res.json({session,student:{id:student.id,name:student.name,class:student.class,section:student.section},attendance,results}); } let students=await dataStore.getStudents(user.schoolId,undefined,session.id); let attendance=await dataStore.getAttendance(user.schoolId,session.id); let exams=await dataStore.getExams(user.schoolId,session.id); if(user.role === "teacher"){ const assignments=await dataStore.getTeacherClassAssignments(user.schoolId,session.id,user.id); const scoped=(await Promise.all(assignments.map(a=>dataStore.getStudents(user.schoolId,{class:a.className,section:a.section},session.id)))).flat(); const allowed=new Set(scoped.map(s=>s.id)); students=students.filter(s=>allowed.has(s.id)); attendance=attendance.filter(a=>allowed.has(a.studentId)); exams=[]; } const result:any={session,studentSummary:{total:students.length,active:students.filter(s=>s.isActive).length,byClass:Object.entries(students.reduce<Record<string,number>>((a,s)=>{a[`${s.class} / ${s.section}`]=(a[`${s.class} / ${s.section}`]||0)+1;return a},{}))},attendanceSummary:{total:attendance.length,present:attendance.filter(a=>a.status==="present").length},examSummary:{total:exams.length}}; if(["admin","principal","accountant"].includes(user.role)){ const [payments,expenses,payroll]=await Promise.all([dataStore.getFinancialFeeIncome(user.schoolId,session.id),dataStore.getExpenses(user.schoolId,session.id),dataStore.getPaidPayroll(user.schoolId,session.id)]); result.financial={feeIncome:payments.reduce((n,p)=>n+p.amount,0),expenses:expenses.reduce((n,e)=>n+e.amount,0),paidPayroll:payroll.reduce((n,p)=>n+p.netSalary,0)}; } res.json(result); });

  // === Academic sessions ===
  app.get(api.sessions.active.path, requireAuth, async (req, res) => {
    res.json(await dataStore.getActiveSession(currentUser(req).schoolId) ?? null);
  });

  // === Schools ===
  app.get(api.schools.get.path, requireAuth, async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);
    if (id !== user.schoolId) return res.status(404).json({ message: "School not found" });
    const school = await dataStore.getSchool(user.schoolId);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  app.put(api.schools.update.path, requireRole("admin", "principal"), async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);
    if (id !== user.schoolId) return res.status(404).json({ message: "School not found" });
    const input = api.schools.update.input.parse(req.body);
    const updated = await dataStore.updateSchool(user.schoolId, input);
    res.json(updated);
  });

  // === Subjects and teacher assignments ===
  const academicManager = requireRole("admin", "principal");
  app.get(api.subjects.list.path, requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.json([]);
    const subjects = await dataStore.getSubjects(user.schoolId, session.id);
    if (user.role === "teacher") {
      const assignments = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const allowed = new Set(assignments.map((assignment) => assignment.subjectId));
      return res.json(subjects.filter((subject) => allowed.has(subject.id)));
    }
    return res.json(subjects);
  });

  app.post(api.subjects.create.path, academicManager, async (req, res) => {
    const input = api.subjects.create.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const subject = await dataStore.createSubject({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return res.status(201).json(subject);
  });
  app.patch(api.subjects.update.path, academicManager, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const subject = await dataStore.updateSubject(routeId(req.params.id), user.schoolId, session.id, api.subjects.update.input.parse(req.body));
    return subject ? res.json(subject) : res.status(404).json({ message: "Subject not found" });
  });
  app.delete(api.subjects.delete.path, academicManager, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await dataStore.deleteSubject(routeId(req.params.id), user.schoolId, session.id);
    return deleted ? res.status(204).send() : res.status(409).json({ message: "Subject not found or still assigned" });
  });

  app.get(api.assignments.list.path, requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.json({ subjects: [], classes: [] });
    const teacherUserId = user.role === "teacher" ? user.id : undefined;
    return res.json({
      subjects: await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, teacherUserId),
      classes: await dataStore.getTeacherClassAssignments(user.schoolId, session.id, teacherUserId),
    });
  });
  app.post(api.assignments.assignSubject.path, academicManager, async (req, res) => {
    const input = api.assignments.assignSubject.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const assignment = await dataStore.createTeacherSubjectAssignment({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return assignment ? res.status(201).json(assignment) : res.status(400).json({ message: "Teacher, subject, or session is invalid" });
  });
  app.delete(api.assignments.removeSubject.path, academicManager, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    return (await dataStore.deleteTeacherSubjectAssignment(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Assignment not found" });
  });
  app.post(api.assignments.assignClass.path, academicManager, async (req, res) => {
    const input = api.assignments.assignClass.input.parse(req.body);
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createTeacherClassAssignment({ ...input, schoolId: user.schoolId, sessionId: session.id })); }
    catch { return res.status(400).json({ message: "Teacher or assignment is invalid" }); }
  });
  app.delete(api.assignments.removeClass.path, academicManager, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    return (await dataStore.deleteTeacherClassAssignment(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Assignment not found" });
  });
  app.post(api.studentLinks.create.path, academicManager, async (req, res) => {
    const input = api.studentLinks.create.input.parse(req.body);
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const link = await dataStore.createStudentUserLink({ ...input, schoolId: user.schoolId, sessionId: session.id });
    return link ? res.status(201).json(link) : res.status(400).json({ message: "Student or student user is invalid" });
  });

  // === Exams ===
  const examManagers = requireRole("admin", "principal");
  const examReaders = requireRole("admin", "principal", "teacher", "student");
  async function currentExamContext(user: ReturnType<typeof currentUser>) {
    return dataStore.getActiveSession(user.schoolId);
  }
  async function authorizedExam(examId: number, user: ReturnType<typeof currentUser>) {
    const session = await currentExamContext(user);
    if (!session) return undefined;
    const exam = await dataStore.getExam(examId, user.schoolId, session.id);
    if (!exam) return undefined;
    if (user.role === "admin" || user.role === "principal") return { session, exam, scopes: await dataStore.getExamScopes(exam.id, user.schoolId, session.id), schedules: await dataStore.getExamSchedules(exam.id, user.schoolId, session.id) };
    const scopes = await dataStore.getExamScopes(exam.id, user.schoolId, session.id);
    const schedules = await dataStore.getExamSchedules(exam.id, user.schoolId, session.id);
    if (user.role === "teacher") {
      const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const classKeys = new Set(classes.map((item) => `${item.className}\\0${item.section}`));
      const subjectIds = new Set(subjects.map((item) => item.subjectId));
      const allowedScopes = scopes.filter((scope) => classKeys.has(`${scope.className}\\0${scope.section}`));
      const allowedKeys = new Set(allowedScopes.map((scope) => `${scope.className}\\0${scope.section}`));
      const allowedSchedules = schedules.filter((schedule) => allowedKeys.has(`${schedule.className}\\0${schedule.section}`) && subjectIds.has(schedule.subjectId));
      return allowedSchedules.length || allowedScopes.length ? { session, exam, scopes: allowedScopes, schedules: allowedSchedules } : undefined;
    }
    const student = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
    if (!student || exam.status !== "published") return undefined;
    const ownScopes = scopes.filter((scope) => scope.className === student.class && scope.section === student.section);
    return ownScopes.length ? { session, exam, scopes: ownScopes, schedules: schedules.filter((schedule) => schedule.className === student.class && schedule.section === student.section) } : undefined;
  }

  app.get(api.exams.list.path, examReaders, async (req, res) => {
    const user = currentUser(req);
    const session = await currentExamContext(user);
    if (!session) return res.json([]);
    const requestedStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const requestedClass = typeof req.query.class === "string" ? req.query.class : undefined;
    const requestedSection = typeof req.query.section === "string" ? req.query.section : undefined;
    const exams = await dataStore.getExams(user.schoolId, session.id);
    const visible = [];
    for (const exam of exams) {
      if (requestedStatus && exam.status !== requestedStatus) continue;
      const detail = await authorizedExam(exam.id, user);
      if (!detail) continue;
      if (requestedClass && !detail.scopes.some((scope) => scope.className === requestedClass && (!requestedSection || scope.section === requestedSection))) continue;
      visible.push(exam);
    }
    return res.json(visible);
  });
  app.get(api.exams.get.path, examReaders, async (req, res) => {
    const detail = await authorizedExam(routeId(req.params.id), currentUser(req));
    return detail ? res.json({ exam: detail.exam, scopes: detail.scopes, schedules: detail.schedules }) : res.status(404).json({ message: "Exam not found" });
  });
  app.post(api.exams.create.path, examManagers, async (req, res) => {
    const input = api.exams.create.input.parse(req.body);
    const user = currentUser(req); const session = await currentExamContext(user);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const seen = new Set<string>();
    for (const scope of input.scopes) { const key = `${scope.className}\\0${scope.section}`; if (seen.has(key)) return res.status(400).json({ message: "Duplicate class/section scope" }); seen.add(key); }
    try {
      const result = await dataStore.createExam({ name: input.name, examType: input.examType, startDate: input.startDate, endDate: input.endDate, status: input.status ?? "draft", isActive: input.isActive ?? true, schoolId: user.schoolId, sessionId: session.id }, input.scopes);
      return res.status(201).json(result);
    } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create exam" }); }
  });
  app.patch(api.exams.update.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updateExam(routeId(req.params.id), user.schoolId, session.id, api.exams.update.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Exam not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update exam" }); }
  });
  app.post(api.exams.status.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.setExamStatus(routeId(req.params.id), user.schoolId, session.id, api.exams.status.input.parse(req.body).status); return updated ? res.json(updated) : res.status(404).json({ message: "Exam not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid exam status transition" }); }
  });
  app.post(api.exams.addSchedule.path, examManagers, async (req, res) => {
    const input = api.exams.addSchedule.input.parse(req.body); const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createExamSchedule({ ...input, examId: routeId(req.params.id), schoolId: user.schoolId, sessionId: session.id })); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to add exam schedule" }); }
  });
  app.patch(api.exams.updateSchedule.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updateExamSchedule(routeId(req.params.id), user.schoolId, session.id, api.exams.updateSchedule.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Schedule not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update schedule" }); }
  });
  app.delete(api.exams.removeSchedule.path, examManagers, async (req, res) => {
    const user = currentUser(req); const session = await currentExamContext(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return (await dataStore.deleteExamSchedule(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Schedule not found" }); }
    catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to remove schedule" }); }
  });

  // === Student ID cards ===
  app.get(api.studentIdCards.get.path, requireRole("admin", "principal", "teacher", "student"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const requestedStudentId = routeId(req.params.studentId);
    const student = user.role === "student"
      ? await dataStore.getStudentForUser(user.id, user.schoolId, session.id)
      : await dataStore.getStudent(requestedStudentId, user.schoolId);
    if (!student || student.id !== requestedStudentId || student.sessionId !== session.id || !student.isActive) return res.status(404).json({ message: "ID card not found" });
    if (user.role === "teacher") {
      const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      if (!assignments.some(item => item.className === student.class && item.section === student.section)) return res.status(404).json({ message: "ID card outside teacher assignment" });
    }
    const school = await dataStore.getSchool(user.schoolId);
    return res.json({ card: {
      school: school ? { id: school.id, name: school.name, logo: school.logo, address: school.address, contact: school.contact } : null,
      student: { id: student.id, name: student.name, admissionNo: student.admissionNo, class: student.class, section: student.section, rollNo: student.rollNo },
      session: { id: session.id, name: session.name },
      photoUrl: null,
      photoAvailable: false,
    } });
  });

  // === Marksheet / report cards ===
  app.get(api.reportCards.get.path, requireRole("admin", "principal", "teacher", "student"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const requestedStudentId = routeId(req.params.studentId);
    const examId = routeId(req.params.examId);
    const student = user.role === "student"
      ? await dataStore.getStudentForUser(user.id, user.schoolId, session.id)
      : await dataStore.getStudent(requestedStudentId, user.schoolId);
    if (!student || (user.role === "student" && student.id !== requestedStudentId && requestedStudentId !== student.id)) {
      return res.status(404).json({ message: "Report card not found" });
    }
    const exam = await dataStore.getExam(examId, user.schoolId, session.id);
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    if (user.role === "student" && exam.status !== "published") return res.status(404).json({ message: "Report card not published" });
    const scopes = await dataStore.getExamScopes(exam.id, user.schoolId, session.id);
    const schedules = (await dataStore.getExamSchedules(exam.id, user.schoolId, session.id)).filter(schedule => schedule.className === student.class && schedule.section === student.section);
    const scopeMatches = scopes.some(scope => scope.className === student.class && scope.section === student.section);
    if (!scopeMatches || schedules.length === 0) return res.status(404).json({ message: "Student is not applicable to this exam" });
    if (user.role === "teacher") {
      const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      if (!classes.some(item => item.className === student.class && item.section === student.section)) return res.status(404).json({ message: "Report card outside teacher assignment" });
      const subjectIds = new Set(subjects.map(item => item.subjectId));
      if (!schedules.every(schedule => subjectIds.has(schedule.subjectId))) return res.status(404).json({ message: "Report card contains unassigned subjects" });
    }
    const results = await dataStore.getExamResults(user.schoolId, session.id, { examId: exam.id, studentId: student.id });
    const resultBySchedule = new Map(results.map(result => [result.scheduleId, result]));
    if (user.role === "student" && schedules.some(schedule => resultBySchedule.get(schedule.id)?.status !== "published")) return res.status(404).json({ message: "Report card results are not published" });
    const subjects = await dataStore.getSubjects(user.schoolId, session.id);
    const subjectNames = new Map(subjects.map(subject => [subject.id, subject.name]));
    const rows = schedules.map(schedule => {
      const result = resultBySchedule.get(schedule.id);
      const absent = result?.isAbsent ?? false;
      const obtained = absent ? null : (result?.obtainedMarks ?? null);
      const subjectPercentage = obtained === null ? null : Math.round((obtained / schedule.maxMarks) * 10000) / 100;
      return { scheduleId: schedule.id, subjectId: schedule.subjectId, subjectName: subjectNames.get(schedule.subjectId) ?? `Subject ${schedule.subjectId}`, examDate: schedule.examDate, maxMarks: schedule.maxMarks, passingMarks: schedule.passingMarks, obtainedMarks: obtained, absent, subjectResult: absent ? "Absent" : obtained === null ? "Not entered" : obtained >= schedule.passingMarks ? "Pass" : "Fail", subjectPercentage, remarks: result?.remarks ?? null, resultStatus: result?.status ?? "missing" };
    });
    const totals = calculateReportTotals(rows);
    const school = await dataStore.getSchool(user.schoolId);
    return res.json({ report: { school, student: { id: student.id, name: student.name, admissionNo: student.admissionNo, class: student.class, section: student.section, rollNo: student.rollNo }, session, exam: { id: exam.id, name: exam.name, examType: exam.examType, status: exam.status }, rows, ...totals, calculationNote: "Absent subjects are excluded from the percentage denominator and never receive invented marks; an absent subject still makes the overall result Fail." } });
  });

  // === Exam results / marks ===
  const resultManagers = requireRole("admin", "principal", "teacher");
  const resultReaders = requireRole("admin", "principal", "teacher", "student");
  async function resultContext(user: ReturnType<typeof currentUser>) {
    const session = await dataStore.getActiveSession(user.schoolId);
    return session ? { session, results: await dataStore.getExamResults(user.schoolId, session.id) } : undefined;
  }
  async function teacherAllowsSchedule(user: ReturnType<typeof currentUser>, schedule: { className: string; section: string; subjectId: number; sessionId: number }) {
    if (user.role !== "teacher") return true;
    const classes = await dataStore.getTeacherClassAssignments(user.schoolId, schedule.sessionId, user.id);
    const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, schedule.sessionId, user.id);
    return classes.some(item => item.className === schedule.className && item.section === schedule.section) && subjects.some(item => item.subjectId === schedule.subjectId);
  }
  async function visibleResult(user: ReturnType<typeof currentUser>, result: Awaited<ReturnType<IStorage["getExamResult"]>>) {
    if (!result) return false;
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || result.sessionId !== session.id) return false;
    const exam = await dataStore.getExam(result.examId, user.schoolId, session.id);
    const schedules = exam ? await dataStore.getExamSchedules(exam.id, user.schoolId, session.id) : [];
    const schedule = schedules.find(item => item.id === result.scheduleId);
    if (!exam || !schedule) return false;
    if (user.role === "student") {
      const student = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      return !!student && student.id === result.studentId && exam.status === "published" && result.status === "published";
    }
    return teacherAllowsSchedule(user, schedule);
  }

  app.get(api.examResults.list.path, resultReaders, async (req, res) => {
    const user = currentUser(req); const context = await resultContext(user); if (!context) return res.json([]);
    const requested = { examId: typeof req.query.examId === "string" ? idSchema.parse(req.query.examId) : undefined, scheduleId: typeof req.query.scheduleId === "string" ? idSchema.parse(req.query.scheduleId) : undefined, studentId: typeof req.query.studentId === "string" ? idSchema.parse(req.query.studentId) : undefined, status: typeof req.query.status === "string" ? req.query.status : undefined };
    if (user.role === "student") { const student = await dataStore.getStudentForUser(user.id, user.schoolId, context.session.id); requested.studentId = student?.id; requested.status = "published"; }
    let results = requested.studentId ? await dataStore.getExamResults(user.schoolId, context.session.id, requested) : await dataStore.getExamResults(user.schoolId, context.session.id, requested);
    const output = [];
    for (const result of results) {
      if (!(await visibleResult(user, result))) continue;
      const schedule = (await dataStore.getExamSchedules(result.examId, user.schoolId, context.session.id)).find(item => item.id === result.scheduleId);
      if (schedule && typeof req.query.class === "string" && schedule.className !== req.query.class) continue;
      if (schedule && typeof req.query.section === "string" && schedule.section !== req.query.section) continue;
      output.push(result);
    }
    return res.json(output);
  });
  app.get(api.examResults.student.path, resultReaders, async (req, res) => {
    const user = currentUser(req); const context = await resultContext(user); if (!context) return res.json([]);
    const own = user.role === "student" ? await dataStore.getStudentForUser(user.id, user.schoolId, context.session.id) : undefined;
    const studentId = own?.id ?? (user.role === "student" ? -1 : routeId(req.params.studentId));
    const results = await dataStore.getExamResults(user.schoolId, context.session.id, { studentId });
    const output = []; for (const result of results) if (await visibleResult(user, result)) output.push(result);
    return res.json(output);
  });
  app.post(api.examResults.bulk.path, resultManagers, async (req, res) => {
    const input = api.examResults.bulk.input.parse(req.body); const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" });
    const exam = await dataStore.getExam(input.examId, user.schoolId, session.id); const schedule = (await dataStore.getExamSchedules(input.examId, user.schoolId, session.id)).find(item => item.id === input.scheduleId);
    if (!exam || !schedule || schedule.className !== input.className || schedule.section !== input.section || !(await teacherAllowsSchedule(user, schedule))) return res.status(403).json({ message: "Marks entry is outside your assignment" });
    try { const created = await dataStore.createExamResultsBulk(input.records.map(record => ({ ...record, examId: input.examId, scheduleId: input.scheduleId, className: input.className, section: input.section, schoolId: user.schoolId, sessionId: session.id, status: "draft" as const }))); return res.status(201).json(created); }
    catch (error) { return res.status(error instanceof Error && error.message.includes("Duplicate") ? 409 : 400).json({ message: error instanceof Error ? error.message : "Unable to save marks" }); }
  });
  app.patch(api.examResults.update.path, resultManagers, async (req, res) => {
    const user = currentUser(req); const input = api.examResults.update.input.parse(req.body); const target = await dataStore.getExamResult(routeId(req.params.id), currentUser(req).schoolId, (await dataStore.getActiveSession(user.schoolId))?.id ?? -1);
    if (!target || !(await visibleResult(user, target))) return res.status(404).json({ message: "Result not found" });
    try { const updated = await dataStore.updateExamResult(target.id, user.schoolId, target.sessionId, input); return updated ? res.json(updated) : res.status(404).json({ message: "Result not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update marks" }); }
  });
  app.post(api.examResults.status.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.examResults.status.input.parse(req.body); const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" });
    if (!(await dataStore.getExam(input.examId, user.schoolId, session.id))) return res.status(404).json({ message: "Exam not found" });
    return res.json({ updated: await dataStore.setExamResultsStatus(input.examId, user.schoolId, session.id, input.status) });
  });
  app.get(api.examResults.summary.path, resultReaders, async (req, res) => {
    const user = currentUser(req); const context = await resultContext(user); if (!context) return res.json({ totalObtained: 0, totalMaximum: 0, percentage: 0, passed: 0, failed: 0, absent: 0 });
    const student = user.role === "student" ? await dataStore.getStudentForUser(user.id, user.schoolId, context.session.id) : undefined;
    const examId = typeof req.query.examId === "string" ? idSchema.parse(req.query.examId) : undefined;
    const results = await dataStore.getExamResults(user.schoolId, context.session.id, { examId, studentId: student?.id });
    let totalObtained = 0, totalMaximum = 0, passed = 0, failed = 0, absent = 0;
    for (const result of results) { if (!(await visibleResult(user, result))) continue; const schedule = (await dataStore.getExamSchedules(result.examId, user.schoolId, context.session.id)).find(item => item.id === result.scheduleId); if (!schedule) continue; totalMaximum += schedule.maxMarks; if (result.isAbsent) { absent++; failed++; continue; } totalObtained += result.obtainedMarks ?? 0; if ((result.obtainedMarks ?? 0) >= schedule.passingMarks) passed++; else failed++; }
    return res.json({ totalObtained, totalMaximum, percentage: totalMaximum ? Math.round(totalObtained / totalMaximum * 10000) / 100 : 0, passed, failed, absent });
  });

  // === Attendance ===
  const attendanceReaders = requireRole("admin", "principal", "teacher", "student");
  const attendanceManagers = requireRole("admin", "principal", "teacher");
  const attendanceQuery = (req: any) => ({
    from: typeof req.query.from === "string" ? req.query.from : undefined,
    to: typeof req.query.to === "string" ? req.query.to : undefined,
    date: typeof req.query.date === "string" ? req.query.date : undefined,
    className: typeof req.query.class === "string" ? req.query.class : undefined,
    section: typeof req.query.section === "string" ? req.query.section : undefined,
    subjectId: typeof req.query.subjectId === "string" ? idSchema.parse(req.query.subjectId) : undefined,
    studentId: typeof req.query.studentId === "string" ? idSchema.parse(req.query.studentId) : undefined,
  });
  const hasTeacherScope = async (user: ReturnType<typeof currentUser>, className: string, section: string, subjectId?: number) => {
    if (user.role !== "teacher") return true;
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return false;
    const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
    if (!classes.some((assignment) => assignment.className === className && assignment.section === section)) return false;
    if (subjectId !== undefined) {
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      if (!subjects.some((assignment) => assignment.subjectId === subjectId)) return false;
    }
    return true;
  };
  const scopedAttendance = async (req: any, user: ReturnType<typeof currentUser>) => {
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return { session: undefined, records: [] as Awaited<ReturnType<IStorage["getAttendance"]>> };
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      return { session, records: own ? await dataStore.getAttendance(user.schoolId, session.id, { ...attendanceQuery(req), studentId: own.id }) : [] };
    }
    let records = await dataStore.getAttendance(user.schoolId, session.id, attendanceQuery(req));
    if (user.role === "teacher") {
      const classes = await dataStore.getTeacherClassAssignments(user.schoolId, session.id, user.id);
      const subjects = await dataStore.getTeacherSubjectAssignments(user.schoolId, session.id, user.id);
      const classKeys = new Set(classes.map((item) => `${item.className}\\0${item.section}`));
      const subjectIds = new Set(subjects.map((item) => item.subjectId));
      records = records.filter((record) => classKeys.has(`${record.className}\\0${record.section}`) && (record.subjectId === null || subjectIds.has(record.subjectId)));
    }
    return { session, records };
  };

  app.get(api.attendance.list.path, attendanceReaders, async (req, res) => {
    const { records } = await scopedAttendance(req, currentUser(req));
    return res.json(records);
  });

  app.post(api.attendance.mark.path, attendanceManagers, async (req, res) => {
    const input = api.attendance.mark.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    if (!(await hasTeacherScope(user, input.className, input.section, input.subjectId ?? undefined))) {
      return res.status(403).json({ message: "Teacher is not assigned to this class or subject" });
    }
    try {
      const created = await dataStore.createAttendanceBulk(input.records.map((record) => ({
        ...record, className: input.className, section: input.section, attendanceDate: input.attendanceDate,
        subjectId: input.subjectId ?? null, schoolId: user.schoolId, sessionId: session.id, markedByUserId: user.id,
      })));
      return res.status(201).json(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save attendance";
      return res.status(message.includes("Duplicate") ? 409 : 400).json({ message });
    }
  });

  app.patch(api.attendance.update.path, attendanceManagers, async (req, res) => {
    const input = api.attendance.update.input.parse(req.body);
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const records = await dataStore.getAttendance(user.schoolId, session.id);
    const target = records.find((record) => record.id === routeId(req.params.id));
    if (!target) return res.status(404).json({ message: "Attendance record not found" });
    if (!(await hasTeacherScope(user, target.className, target.section, target.subjectId ?? undefined))) return res.status(403).json({ message: "Attendance is outside your assignment" });
    const updated = await dataStore.updateAttendance(target.id, user.schoolId, session.id, input.status);
    return updated ? res.json(updated) : res.status(404).json({ message: "Attendance record not found" });
  });

  app.get(api.attendance.summary.path, attendanceReaders, async (req, res) => {
    const { records } = await scopedAttendance(req, currentUser(req));
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const record of records) counts[record.status as keyof typeof counts]++;
    const total = records.length;
    return res.json({ ...counts, total, percentage: total === 0 ? 0 : Math.round(((counts.present + counts.late) / total) * 10000) / 100 });
  });

  // === Payroll ===
  const payrollManagers = requireRole("admin", "accountant");
  const payrollReaders = requireRole("admin", "principal", "accountant", "staff", "teacher");
  async function payrollSession(user: ReturnType<typeof currentUser>) { return dataStore.getActiveSession(user.schoolId); }
  async function ownStaffId(user: ReturnType<typeof currentUser>, sessionId?: number) {
    if (!["staff", "teacher"].includes(user.role)) return undefined;
    const staffMember = await dataStore.getStaffForUser(user.id, user.schoolId);
    return staffMember?.id;
  }
  app.post(api.payroll.staffLinks.path, requireRole("admin"), async (req, res) => {
    const input = api.payroll.staffLinks.input.parse(req.body); const user = currentUser(req);
    const link = await dataStore.createStaffUserLink({ ...input, schoolId: user.schoolId });
    return link ? res.status(201).json(link) : res.status(400).json({ message: "Staff or user is invalid for this school" });
  });
  app.get(api.payroll.structures.list.path, payrollReaders, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.json([]);
    const staffId = await ownStaffId(user, session.id);
    if (["staff", "teacher"].includes(user.role) && staffId === undefined) return res.json([]);
    const structures = await dataStore.getSalaryStructures(user.schoolId, session.id, staffId);
    return res.json(structures.map(({ ...structure }) => structure));
  });
  app.post(api.payroll.structures.create.path, payrollManagers, async (req, res) => {
    const input = api.payroll.structures.create.input.parse(req.body); const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createSalaryStructure({ ...input, staffId: input.staffId, schoolId: user.schoolId, sessionId: session.id })); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create salary structure" }); }
  });
  app.patch(api.payroll.structures.update.path, payrollManagers, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updateSalaryStructure(routeId(req.params.id), user.schoolId, session.id, api.payroll.structures.update.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Salary structure not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update salary structure" }); }
  });
  app.post(api.payroll.structures.status.path, payrollManagers, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    const updated = await dataStore.setSalaryStructureActive(routeId(req.params.id), user.schoolId, session.id, api.payroll.structures.status.input.parse(req.body).isActive);
    return updated ? res.json(updated) : res.status(404).json({ message: "Salary structure not found" });
  });
  app.get(api.payroll.list.path, payrollReaders, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.json([]);
    const own = await ownStaffId(user, session.id); const staffId = ["staff", "teacher"].includes(user.role) ? own : (typeof req.query.staffId === "string" ? idSchema.parse(req.query.staffId) : undefined);
    if (["staff", "teacher"].includes(user.role) && own === undefined) return res.json([]);
    const records = await dataStore.getPayroll(user.schoolId, session.id, { staffId, month: typeof req.query.month === "string" ? idSchema.parse(req.query.month) : undefined, year: typeof req.query.year === "string" ? idSchema.parse(req.query.year) : undefined });
    return res.json(records);
  });
  app.get(api.payroll.summary.path, requireRole("admin", "principal", "accountant"), async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.json({ count: 0, totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalAdvanceDeduction: 0, totalNet: 0, paid: 0, pending: 0 });
    const records = await dataStore.getPayroll(user.schoolId, session.id, { month: typeof req.query.month === "string" ? idSchema.parse(req.query.month) : undefined, year: typeof req.query.year === "string" ? idSchema.parse(req.query.year) : undefined });
    return res.json({ count: records.length, totalBasic: records.reduce((sum, row) => sum + row.basicAmount, 0), totalAllowances: records.reduce((sum, row) => sum + row.allowances, 0), totalDeductions: records.reduce((sum, row) => sum + row.deductions, 0), totalAdvanceDeduction: records.reduce((sum, row) => sum + row.advanceDeduction, 0), totalNet: records.reduce((sum, row) => sum + row.netSalary, 0), paid: records.filter(row => row.status === "paid").length, pending: records.filter(row => row.status !== "paid").length });
  });
  app.get(api.payroll.get.path, payrollReaders, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    const record = await dataStore.getPayrollRecord(routeId(req.params.id), user.schoolId, session.id); if (!record) return res.status(404).json({ message: "Payroll record not found" });
    const own = await ownStaffId(user, session.id); if (["staff", "teacher"].includes(user.role) && own !== record.staffId) return res.status(404).json({ message: "Payroll record not found" });
    return res.json(record);
  });
  app.get(api.payroll.staffHistory.path, payrollReaders, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.json([]);
    const requested = routeId(req.params.staffId); const own = await ownStaffId(user, session.id); const staffId = ["staff", "teacher"].includes(user.role) ? own : requested;
    if (["staff", "teacher"].includes(user.role) && own !== requested) return res.status(404).json({ message: "Payroll history not found" });
    return res.json(staffId === undefined ? [] : await dataStore.getPayroll(user.schoolId, session.id, { staffId }));
  });
  app.post(api.payroll.create.path, payrollManagers, async (req, res) => {
    const input = api.payroll.create.input.parse(req.body); const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { return res.status(201).json(await dataStore.createPayroll({ ...input, schoolId: user.schoolId, sessionId: session.id })); } catch (error) { return res.status(error instanceof Error && error.message.includes("No active") ? 400 : 409).json({ message: error instanceof Error ? error.message : "Unable to create payroll" }); }
  });
  app.patch(api.payroll.update.path, payrollManagers, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.updatePayroll(routeId(req.params.id), user.schoolId, session.id, api.payroll.update.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Payroll record not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update payroll" }); }
  });
  app.post(api.payroll.status.path, payrollManagers, async (req, res) => {
    const user = currentUser(req); const session = await payrollSession(user); if (!session) return res.status(409).json({ message: "No active academic session" });
    try { const updated = await dataStore.setPayrollStatus(routeId(req.params.id), user.schoolId, session.id, api.payroll.status.input.parse(req.body).status); return updated ? res.json(updated) : res.status(404).json({ message: "Payroll record not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid payroll status transition" }); }
  });


  // === Financial management ===
  const financialReaders = requireRole("admin", "principal", "accountant");
  const financialManagers = requireRole("admin", "accountant");
  function financialRange(query: any): { from?: string; to?: string } {
    const month = typeof query.month === "string" ? Number(query.month) : undefined;
    const year = typeof query.year === "string" ? Number(query.year) : undefined;
    if (month !== undefined || year !== undefined) {
      if (!month || !year || month < 1 || month > 12 || year < 1900 || year > 2200) throw new Error("Invalid month or year");
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      return { from, to: last };
    }
    return { from: typeof query.from === "string" ? query.from : undefined, to: typeof query.to === "string" ? query.to : undefined };
  }
  app.get(api.financial.income.path, financialReaders, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.json({ total: 0, payments: [] });
    try { const payments = await dataStore.getFinancialFeeIncome(user.schoolId, session.id, financialRange(req.query)); return res.json({ total: payments.reduce((sum, payment) => sum + payment.amount, 0), payments: payments.map(payment => ({ id: payment.id, amount: payment.amount, paymentDate: payment.paymentDate, month: payment.month, year: payment.year, receiptNo: payment.receiptNo })) }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid financial filter" }); }
  });
  app.get(api.financial.expenses.path, financialReaders, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.json([]);
    try { return res.json(await dataStore.getExpenses(user.schoolId, session.id, { ...financialRange(req.query), categoryId: typeof req.query.categoryId === "string" ? idSchema.parse(req.query.categoryId) : undefined })); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid expense filter" }); }
  });
  app.get(api.financial.categories.path, financialReaders, async (req, res) => res.json(await dataStore.getExpenseCategories(currentUser(req).schoolId)));
  app.post(api.financial.createCategory.path, financialManagers, async (req, res) => { const category = await dataStore.createExpenseCategory({ ...api.financial.createCategory.input.parse(req.body), schoolId: currentUser(req).schoolId }); return res.status(201).json(category); });
  app.patch(api.financial.updateCategory.path, financialManagers, async (req, res) => { const category = await dataStore.updateExpenseCategory(routeId(req.params.id), currentUser(req).schoolId, api.financial.updateCategory.input.parse(req.body)); return category ? res.json(category) : res.status(404).json({ message: "Expense category not found" }); });
  app.post(api.financial.createExpense.path, financialManagers, async (req, res) => { const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" }); try { return res.status(201).json(await dataStore.createExpense({ ...api.financial.createExpense.input.parse(req.body), schoolId: user.schoolId, sessionId: session.id, createdByUserId: user.id })); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to create expense" }); } });
  app.patch(api.financial.updateExpense.path, financialManagers, async (req, res) => { const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" }); try { const updated = await dataStore.updateExpense(routeId(req.params.id), user.schoolId, session.id, api.financial.updateExpense.input.parse(req.body)); return updated ? res.json(updated) : res.status(404).json({ message: "Expense not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update expense" }); } });
  app.delete(api.financial.deleteExpense.path, financialManagers, async (req, res) => { const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" }); try { return (await dataStore.deleteExpense(routeId(req.params.id), user.schoolId, session.id)) ? res.status(204).send() : res.status(404).json({ message: "Expense not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to delete expense" }); } });
  app.post(api.financial.expenseStatus.path, financialManagers, async (req, res) => { const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.status(409).json({ message: "No active academic session" }); try { const updated = await dataStore.setExpenseStatus(routeId(req.params.id), user.schoolId, session.id, api.financial.expenseStatus.input.parse(req.body).status); return updated ? res.json(updated) : res.status(404).json({ message: "Expense not found" }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid expense status" }); } });
  app.get(api.financial.summary.path, financialReaders, async (req, res) => {
    const user = currentUser(req); const session = await dataStore.getActiveSession(user.schoolId); if (!session) return res.json({ totalFeeIncome: 0, totalIncome: 0, totalPayrollExpense: 0, totalOtherExpenses: 0, totalExpenses: 0, netBalance: 0, expenseByCategory: [], payrollCount: 0, feePaymentCount: 0 });
    try { const range = financialRange(req.query); const fees = await dataStore.getFinancialFeeIncome(user.schoolId, session.id, range); const payroll = await dataStore.getPaidPayroll(user.schoolId, session.id, range); const expenses = (await dataStore.getExpenses(user.schoolId, session.id, range)).filter(expense => expense.status === "finalized"); const categories = await dataStore.getExpenseCategories(user.schoolId); const categoryNames = new Map(categories.map(category => [category.id, category.name])); const totalFeeIncome = fees.reduce((sum, item) => sum + item.amount, 0); const totalPayrollExpense = payroll.reduce((sum, item) => sum + item.netSalary, 0); const totalOtherExpenses = expenses.reduce((sum, item) => sum + item.amount, 0); const expenseByCategory = Array.from(expenses.reduce((map, expense) => map.set(expense.categoryId, (map.get(expense.categoryId) ?? 0) + expense.amount), new Map<number, number>())).map(([categoryId, amount]) => ({ categoryId, categoryName: categoryNames.get(categoryId) ?? "Unknown", amount })); const totalExpenses = totalPayrollExpense + totalOtherExpenses; return res.json({ totalFeeIncome, totalIncome: totalFeeIncome, totalPayrollExpense, totalOtherExpenses, totalExpenses, netBalance: totalFeeIncome - totalExpenses, expenseByCategory, payrollCount: payroll.length, feePaymentCount: fees.length }); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid financial filter" }); }
  });

  // === Students ===
  app.get(api.students.list.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const filters = {
      class: typeof req.query.class === "string" ? req.query.class : undefined,
      section: typeof req.query.section === "string" ? req.query.section : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    };
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (user.role === "student") {
      const student = activeSession ? await dataStore.getStudentForUser(user.id, user.schoolId, activeSession.id) : undefined;
      return res.json(student ? [safeStudent(student)] : []);
    }
    let students = activeSession
      ? await dataStore.getStudents(user.schoolId, filters, activeSession.id)
      : [];
    if (user.role === "teacher" && activeSession) {
      const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, activeSession.id, user.id);
      const allowed = new Set(assignments.map((assignment) => `${assignment.className}\\0${assignment.section}`));
      students = students.filter((student) => allowed.has(`${student.class}\\0${student.section}`));
    }
    res.json(students.map(safeStudent));
  });

  app.post(api.students.create.path, requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const input = api.students.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const admissionNo = input.admissionNo?.trim() || `ADM-${new Date().getFullYear()}-${Date.now()}`;
    const student = await dataStore.createStudent({ ...input, admissionNo, schoolId: user.schoolId, sessionId: activeSession.id });
    res.status(201).json(safeStudent(student));
  });

  app.get(api.students.get.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const requestedId = routeId(req.params.id);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (user.role === "student") {
      const own = activeSession ? await dataStore.getStudentForUser(user.id, user.schoolId, activeSession.id) : undefined;
      if (!own || own.id !== requestedId) return res.status(404).json({ message: "Student not found" });
      return res.json(safeStudent(own));
    }
    const student = await dataStore.getStudent(requestedId, user.schoolId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (user.role === "teacher" && activeSession) {
      const assignments = await dataStore.getTeacherClassAssignments(user.schoolId, activeSession.id, user.id);
      if (!assignments.some((assignment) => assignment.className === student.class && assignment.section === student.section)) {
        return res.status(404).json({ message: "Student not found" });
      }
    }
    res.json(safeStudent(student));
  });

  app.put(api.students.update.path, requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const input = api.students.update.input.parse(req.body);
    const user = currentUser(req);
    const updated = await dataStore.updateStudent(routeId(req.params.id), user.schoolId, input);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.deactivate.path, requireRole("admin", "principal", "staff"), async (req, res) => {
    const updated = await dataStore.deactivateStudent(routeId(req.params.id), currentUser(req).schoolId);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.promote.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.students.promote.input.parse(req.body);
    const user = currentUser(req);
    await dataStore.promoteStudents(input.studentIds, user.schoolId, input.targetClass);
    res.json({ message: "Students promoted successfully" });
  });

  // === Student dues ===
  app.get("/api/student-dues", requireRole("admin", "principal", "accountant", "staff", "student"), async (req,res)=>{const user=currentUser(req);const session=await dataStore.getActiveSession(user.schoolId);if(!session)return res.json([]);let studentId=typeof req.query.studentId === "string" ? idSchema.parse(req.query.studentId) : undefined;if(user.role === "student"){const own=await dataStore.getStudentForUser(user.id,user.schoolId,session.id);if(!own)return res.json([]);studentId=own.id;}res.json(await dataStore.getStudentDues(user.schoolId,session.id,studentId));});
  app.post("/api/student-dues", requireRole("admin", "principal", "accountant", "staff"), async (req,res)=>{const input=z.object({studentId:z.number().int().positive(),description:z.string().trim().min(1).max(200),amount:z.number().int().positive(),dueDate:z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullable().optional()}).parse(req.body);const user=currentUser(req);const session=await dataStore.getActiveSession(user.schoolId);if(!session)return res.status(409).json({message:"No active session"});const student=await dataStore.getStudent(input.studentId,user.schoolId);if(!student||student.sessionId!==session.id)return res.status(404).json({message:"Student not found"});res.status(201).json(await dataStore.createStudentDue({...input,schoolId:user.schoolId,sessionId:session.id,status:"open",dueDate:input.dueDate??null}));});
  app.patch("/api/student-dues/:id", requireRole("admin", "principal", "accountant", "staff"), async(req,res)=>{const input=z.object({status:z.enum(["open","settled","void"])}).parse(req.body);const session=await dataStore.getActiveSession(currentUser(req).schoolId);if(!session)return res.status(409).json({message:"No active session"});const value=await dataStore.updateStudentDue(routeId(req.params.id),currentUser(req).schoolId,session.id,input.status);if(!value)return res.status(404).json({message:"Due not found"});res.json(value);});

  // === Transport / Bus Routes ===
  app.get(api.transport.list.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const includeInactive = req.query.includeInactive === "true";

    if (includeInactive && !["admin", "principal"].includes(user.role)) {
      return res.status(403).json({ message: "Inactive transport routes are restricted" });
    }

    res.json(await dataStore.getTransportRoutes(user.schoolId, includeInactive));
  });

  app.post(api.transport.create.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.transport.create.input.parse(req.body);
    const user = currentUser(req);
    const route = await dataStore.createTransportRoute({
      ...input,
      schoolId: user.schoolId,
    });
    res.status(201).json(route);
  });

  app.patch(api.transport.update.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.transport.update.input.parse(req.body);
    const user = currentUser(req);
    const route = await dataStore.updateTransportRoute(routeId(req.params.id), user.schoolId, input);
    if (!route) return res.status(404).json({ message: "Transport route not found" });
    res.json(route);
  });

  app.post(api.transport.deactivate.path, requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const route = await dataStore.deactivateTransportRoute(routeId(req.params.id), user.schoolId);
    if (!route) return res.status(404).json({ message: "Transport route not found" });
    res.json(route);
  });

  app.put(api.transport.assignStudent.path, requireRole("admin", "principal", "staff", "teacher"), async (req, res) => {
    const input = api.transport.assignStudent.input.parse(req.body);
    const user = currentUser(req);
    const student = await dataStore.assignStudentTransport(
      routeId(req.params.id),
      user.schoolId,
      input.transportId,
    );

    if (!student) {
      return res.status(404).json({
        message: input.transportId === null
          ? "Student not found"
          : "Student or active transport route not found",
      });
    }

    res.json(safeStudent(student));
  });

  // === Fees ===
  app.get(api.fees.structures.list.path, requireAuth, async (req, res) => {
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    const structures = activeSession
      ? await dataStore.getFeeStructures(user.schoolId, activeSession.id)
      : [];
    res.json(structures);
  });

  app.post(api.fees.structures.create.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.structures.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const structure = await dataStore.createFeeStructure({
      ...input,
      schoolId: user.schoolId,
      sessionId: activeSession.id,
    });
    res.status(201).json(structure);
  });

  app.put(api.fees.structures.update.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.structures.update.input.parse(req.body);
    const updated = await dataStore.updateFeeStructure(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!updated) return res.status(404).json({ message: "Fee structure not found" });
    res.json(updated);
  });

  app.delete(api.fees.structures.delete.path, requireRole("admin", "accountant"), async (req, res) => {
    const deleted = await dataStore.deleteFeeStructure(routeId(req.params.id), currentUser(req).schoolId);
    if (!deleted) return res.status(409).json({ message: "Fee structure not found or already used by fee records" });
    res.status(204).send();
  });

  app.get(api.fees.payments.list.path, requireRole("admin", "principal", "accountant", "staff", "student"), async (req, res) => {
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    let studentId = req.query.studentId === undefined
      ? undefined
      : idSchema.parse(req.query.studentId);
    if (user.role === "student") {
      const own = activeSession ? await dataStore.getStudentForUser(user.id, user.schoolId, activeSession.id) : undefined;
      if (!own) return res.json([]);
      studentId = own.id;
    }
    const requestedSession = req.query.sessionId === undefined ? activeSession?.id : idSchema.parse(req.query.sessionId);
    const payments = requestedSession === undefined ? [] : await dataStore.getFeePayments(user.schoolId, studentId, requestedSession);
    res.json(payments);
  });

  app.post(api.fees.payments.create.path, requireRole("admin", "accountant"), async (req, res) => {
    const input = api.fees.payments.create.input.parse(req.body);
    const user = currentUser(req);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
    if (!activeSession) return res.status(409).json({ message: "No active academic session" });
    const payment = await dataStore.createFeePaymentForSchool({
      ...input,
      schoolId: user.schoolId,
      sessionId: activeSession.id,
    }, user.schoolId);
    if (!payment) return res.status(404).json({ message: "Student not found" });
    res.status(201).json(payment);
  });

  app.get(api.fees.payments.defaulters.path, requireRole("admin", "principal", "accountant", "staff"), async (req, res) => {
    const classStr = typeof req.query.class === "string" ? req.query.class : undefined;
    const month = z.string().min(1).parse(req.query.month);
    const year = req.query.year === undefined ? undefined : z.coerce.number().int().min(1900).max(2200).parse(req.query.year);
    const defaulters = await dataStore.getDefaulters(currentUser(req).schoolId, classStr, month, year);
    res.json(defaulters);
  });

  // === Staff ===
  app.get(api.staff.list.path, requireRole("admin", "principal"), async (req, res) => {
    const staffMembers = await dataStore.getStaff(currentUser(req).schoolId);
    res.json(staffMembers);
  });

  app.post(api.staff.create.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.staff.create.input.parse(req.body);
    const staffMember = await dataStore.createStaff({
      ...input,
      schoolId: currentUser(req).schoolId,
    });
    res.status(201).json(staffMember);
  });

  app.put(api.staff.update.path, requireRole("admin", "principal"), async (req, res) => {
    const input = api.staff.update.input.parse(req.body);
    const updated = await dataStore.updateStaff(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!updated) return res.status(404).json({ message: "Staff member not found" });
    res.json(updated);
  });

  // === Notice Board & Circulars ===
  app.get("/api/notices", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    let list = typeof (dataStore as any).getNotices === "function" ? await (dataStore as any).getNotices(user.schoolId, session?.id) : [];
    if (user.role === "student") {
      const own = session ? await dataStore.getStudentForUser(user.id, user.schoolId, session.id) : undefined;
      list = list.filter((n: any) => n.targetAudience === "all" || n.targetAudience === "students" || (n.targetAudience === "class" && own && n.targetClass === own.class && (!n.targetSection || n.targetSection === own.section)));
    } else if (user.role === "teacher") {
      list = list.filter((n: any) => n.targetAudience === "all" || n.targetAudience === "teachers" || n.targetAudience === "staff" || n.targetAudience === "class");
    } else if (user.role === "staff" || user.role === "accountant") {
      list = list.filter((n: any) => n.targetAudience === "all" || n.targetAudience === "staff");
    }
    res.json(list);
  });

  app.post("/api/notices", requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const input = insertNoticeSchema.parse(req.body);
    const session = await dataStore.getActiveSession(user.schoolId);
    const created = await (dataStore as any).createNotice({
      ...input,
      schoolId: user.schoolId,
      sessionId: session?.id ?? null,
      createdByUserId: user.id,
      category: input.category ?? "general",
      targetAudience: input.targetAudience ?? "all",
      isPinned: input.isPinned ?? false,
      isActive: true,
    });
    res.status(201).json(created);
  });

  app.patch("/api/notices/:id", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const input = insertNoticeSchema.partial().extend({ isPinned: z.boolean().optional(), isActive: z.boolean().optional() }).parse(req.body);
    const updated = await (dataStore as any).updateNotice(routeId(req.params.id), user.schoolId, input);
    if (!updated) return res.status(404).json({ message: "Notice not found" });
    res.json(updated);
  });

  app.delete("/api/notices/:id", requireRole("admin", "principal"), async (req, res) => {
    const deleted = await (dataStore as any).deleteNotice(routeId(req.params.id), currentUser(req).schoolId);
    if (!deleted) return res.status(404).json({ message: "Notice not found" });
    res.status(204).send();
  });

  // === Homework & Daily Diary ===
  app.get("/api/homework", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getHomework !== "function") return res.json([]);
    let className = typeof req.query.class === "string" ? req.query.class : undefined;
    let section = typeof req.query.section === "string" ? req.query.section : undefined;
    const subjectId = typeof req.query.subjectId === "string" && req.query.subjectId ? idSchema.parse(req.query.subjectId) : undefined;
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      if (!own) return res.json([]);
      className = own.class;
      section = own.section;
    }
    const items = await (dataStore as any).getHomework(user.schoolId, session.id, { className, section, subjectId });
    res.json(items);
  });

  app.post("/api/homework", requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertHomeworkSchema.parse(req.body);
    const created = await (dataStore as any).createHomework({
      ...input,
      schoolId: user.schoolId,
      sessionId: session.id,
      assignedByUserId: user.id,
      status: input.status ?? "active",
    });
    res.status(201).json(created);
  });

  app.delete("/api/homework/:id", requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await (dataStore as any).deleteHomework(routeId(req.params.id), user.schoolId, session.id);
    if (!deleted) return res.status(404).json({ message: "Homework not found" });
    res.status(204).send();
  });

  // === Class Timetable / Routine ===
  app.get("/api/timetable", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getTimetable !== "function") return res.json([]);
    let className = typeof req.query.class === "string" ? req.query.class : undefined;
    let section = typeof req.query.section === "string" ? req.query.section : undefined;
    const dayOfWeek = typeof req.query.dayOfWeek === "string" ? req.query.dayOfWeek : undefined;
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      if (!own) return res.json([]);
      className = own.class;
      section = own.section;
    }
    const entries = await (dataStore as any).getTimetable(user.schoolId, session.id, { className, section, dayOfWeek });
    res.json(entries);
  });

  app.post("/api/timetable", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertTimetableEntrySchema.parse(req.body);
    const created = await (dataStore as any).createTimetableEntry({
      ...input,
      schoolId: user.schoolId,
      sessionId: session.id,
      teacherUserId: input.teacherUserId ?? null,
      roomNo: input.roomNo ?? null,
    });
    res.status(201).json(created);
  });

  app.delete("/api/timetable/:id", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await (dataStore as any).deleteTimetableEntry(routeId(req.params.id), user.schoolId, session.id);
    if (!deleted) return res.status(404).json({ message: "Timetable entry not found" });
    res.status(204).send();
  });

  // === Leave Requests ===
  app.get("/api/leaves", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getLeaveRequests !== "function") return res.json([]);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    if (user.role === "student" || user.role === "staff" || user.role === "accountant") {
      return res.json(await (dataStore as any).getLeaveRequests(user.schoolId, session.id, { userId: user.id, status }));
    }
    const list = await (dataStore as any).getLeaveRequests(user.schoolId, session.id, { status });
    res.json(list);
  });

  app.post("/api/leaves", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertLeaveRequestSchema.parse(req.body);
    let applicantType: "student" | "staff" = user.role === "student" ? "student" : (input.applicantType ?? "staff");
    let studentId: number | null = input.studentId ?? null;
    let applicantName = user.name;
    let className: string | null = input.className ?? null;
    let section: string | null = input.section ?? null;
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      if (own) {
        studentId = own.id;
        applicantName = own.name;
        className = own.class;
        section = own.section;
      }
    } else if (applicantType === "student" && studentId) {
      const student = await dataStore.getStudent(studentId, user.schoolId);
      if (student) {
        applicantName = student.name;
        className = student.class;
        section = student.section;
      }
    }
    const created = await (dataStore as any).createLeaveRequest({
      ...input,
      schoolId: user.schoolId,
      sessionId: session.id,
      userId: user.id,
      applicantName,
      applicantType,
      studentId,
      className,
      section,
      leaveType: input.leaveType ?? "sick",
    });
    res.status(201).json(created);
  });

  app.post("/api/leaves/:id/review", requireRole("admin", "principal", "teacher"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = z.object({ status: z.enum(["approved", "rejected"]), reviewRemarks: z.string().max(500).nullable().optional() }).parse(req.body);
    const updated = await (dataStore as any).reviewLeaveRequest(routeId(req.params.id), user.schoolId, session.id, input.status, user.id, input.reviewRemarks);
    if (!updated) return res.status(404).json({ message: "Leave request not found" });
    res.json(updated);
  });

  // === Certificates (Transfer / Bonafide / Character / Fee) ===
  app.get("/api/certificates", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getCertificates !== "function") return res.json([]);
    let studentId = typeof req.query.studentId === "string" ? idSchema.parse(req.query.studentId) : undefined;
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      if (!own) return res.json([]);
      studentId = own.id;
    }
    res.json(await (dataStore as any).getCertificates(user.schoolId, session.id, studentId));
  });

  app.post("/api/certificates", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertCertificateSchema.parse(req.body);
    const prefix = input.certificateType.slice(0, 3).toUpperCase();
    const certificateNo = input.certificateNo?.trim() || `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const created = await (dataStore as any).createCertificate({
      ...input,
      certificateNo,
      schoolId: user.schoolId,
      sessionId: session.id,
      issuedByUserId: user.id,
      conduct: input.conduct ?? "Good",
      reason: input.reason ?? null,
      remarks: input.remarks ?? null,
    });
    void audit({ schoolId: user.schoolId, sessionId: session.id, actorUserId: user.id, actorRole: user.role, action: `certificate.issue.${input.certificateType}`, targetType: "student", targetId: input.studentId, metadata: { certificateNo } });
    res.status(201).json(created);
  });

  app.post("/api/certificates/:id/revoke", requireRole("admin", "principal"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const updated = await (dataStore as any).revokeCertificate(routeId(req.params.id), user.schoolId, session.id);
    if (!updated) return res.status(404).json({ message: "Certificate not found" });
    res.json(updated);
  });

  // === Transport Management ===
  app.get("/api/transport/routes", requireAuth, async (req, res) => {
    const user = currentUser(req);
    if (typeof (dataStore as any).getTransportRoutes !== "function") return res.json([]);
    const routes = await (dataStore as any).getTransportRoutes(user.schoolId, true);
    res.json(routes.map((r: any) => ({ ...r, monthlyFee: r.monthlyFee ?? r.amount })));
  });

  app.post("/api/transport/routes", requireRole("admin", "principal", "accountant"), async (req, res) => {
    const user = currentUser(req);
    const input = insertTransportRouteSchema.parse(req.body);
    const created = await (dataStore as any).createTransportRoute({
      ...input,
      schoolId: user.schoolId,
      amount: input.amount ?? input.monthlyFee ?? 500,
      capacity: input.capacity ?? 40,
      isActive: true,
    });
    res.status(201).json({ ...created, monthlyFee: (created as any).monthlyFee ?? created.amount });
  });

  app.get("/api/transport/allocations", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session || typeof (dataStore as any).getStudentTransportAllocations !== "function") return res.json([]);
    const routeId = typeof req.query.routeId === "string" && req.query.routeId ? idSchema.parse(req.query.routeId) : undefined;
    let allocations = await (dataStore as any).getStudentTransportAllocations(user.schoolId, session.id, routeId);
    if (user.role === "student") {
      const own = await dataStore.getStudentForUser(user.id, user.schoolId, session.id);
      allocations = own ? allocations.filter((a: any) => a.studentId === own.id) : [];
    }
    res.json(allocations);
  });

  app.post("/api/transport/allocations", requireRole("admin", "principal", "accountant", "staff"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const input = insertStudentTransportAllocationSchema.parse(req.body);
    const created = await (dataStore as any).createStudentTransportAllocation({
      ...input,
      schoolId: user.schoolId,
      sessionId: session.id,
      isActive: true,
    });
    res.status(201).json(created);
  });

  app.delete("/api/transport/allocations/:id", requireRole("admin", "principal", "accountant"), async (req, res) => {
    const user = currentUser(req);
    const session = await dataStore.getActiveSession(user.schoolId);
    if (!session) return res.status(409).json({ message: "No active academic session" });
    const deleted = await (dataStore as any).removeStudentTransport(routeId(req.params.id), user.schoolId, session.id);
    if (!deleted) return res.status(404).json({ message: "Transport allocation not found" });
    res.status(204).send();
  });

  return httpServer;
}
