import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage, type IStorage } from "./storage";
import { api } from "@shared/routes";
import {
  currentUser,
  requireAuth,
  requireRole,
  toAuthenticatedUser,
  toPublicUser,
  verifyPassword,
} from "./auth";

const idSchema = z.coerce.number().int().positive();
const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

function safeStudent(student: Awaited<ReturnType<typeof storage.getStudent>>) {
  if (!student) return student;
  const { aadhaar: _aadhaar, ...safe } = student;
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
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = credentialsSchema.parse(req.body);
    const user = await dataStore.getUserByUsername(username);

    // Keep invalid username and invalid password responses identical.
    if (!user || !user.schoolId || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const authenticatedUser = toAuthenticatedUser(user);
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

    return res.json({ user: toPublicUser(authenticatedUser) });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
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
    return res.json({ user: toPublicUser(currentUser(req)) });
  });

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

  app.put(api.schools.update.path, requireRole("admin"), async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);
    if (id !== user.schoolId) return res.status(404).json({ message: "School not found" });
    const input = api.schools.update.input.parse(req.body);
    const updated = await dataStore.updateSchool(user.schoolId, input);
    res.json(updated);
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
    const students = activeSession
      ? await dataStore.getStudents(user.schoolId, filters, activeSession.id)
      : [];
    res.json(students.map(safeStudent));
  });

  app.post(api.students.create.path, requireRole("admin", "staff", "teacher"), async (req, res) => {
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
    const student = await dataStore.getStudent(routeId(req.params.id), user.schoolId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(student));
  });

  app.put(api.students.update.path, requireRole("admin", "staff", "teacher"), async (req, res) => {
    const input = api.students.update.input.parse(req.body);
    const user = currentUser(req);
    const updated = await dataStore.updateStudent(routeId(req.params.id), user.schoolId, input);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.deactivate.path, requireRole("admin", "staff"), async (req, res) => {
    const updated = await dataStore.deactivateStudent(routeId(req.params.id), currentUser(req).schoolId);
    if (!updated) return res.status(404).json({ message: "Student not found" });
    res.json(safeStudent(updated));
  });

  app.post(api.students.promote.path, requireRole("admin"), async (req, res) => {
    const input = api.students.promote.input.parse(req.body);
    const user = currentUser(req);
    await dataStore.promoteStudents(input.studentIds, user.schoolId, input.targetClass);
    res.json({ message: "Students promoted successfully" });
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

  app.get(api.fees.payments.list.path, requireRole("admin", "accountant", "staff"), async (req, res) => {
    const user = currentUser(req);
    const studentId = req.query.studentId === undefined
      ? undefined
      : idSchema.parse(req.query.studentId);
    const activeSession = await dataStore.getActiveSession(user.schoolId);
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

  app.get(api.fees.payments.defaulters.path, requireRole("admin", "accountant", "staff"), async (req, res) => {
    const classStr = typeof req.query.class === "string" ? req.query.class : undefined;
    const month = z.string().min(1).parse(req.query.month);
    const year = req.query.year === undefined ? undefined : z.coerce.number().int().min(1900).max(2200).parse(req.query.year);
    const defaulters = await dataStore.getDefaulters(currentUser(req).schoolId, classStr, month, year);
    res.json(defaulters);
  });

  // === Staff ===
  app.get(api.staff.list.path, requireRole("admin"), async (req, res) => {
    const staffMembers = await dataStore.getStaff(currentUser(req).schoolId);
    res.json(staffMembers);
  });

  app.post(api.staff.create.path, requireRole("admin"), async (req, res) => {
    const input = api.staff.create.input.parse(req.body);
    const staffMember = await dataStore.createStaff({
      ...input,
      schoolId: currentUser(req).schoolId,
    });
    res.status(201).json(staffMember);
  });

  app.put(api.staff.update.path, requireRole("admin"), async (req, res) => {
    const input = api.staff.update.input.parse(req.body);
    const updated = await dataStore.updateStaff(routeId(req.params.id), currentUser(req).schoolId, input);
    if (!updated) return res.status(404).json({ message: "Staff member not found" });
    res.json(updated);
  });

  return httpServer;
}
