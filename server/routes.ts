import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import {
  insertSchoolSchema,
  insertStudentSchema,
  insertFeeStructureSchema,
  insertFeePaymentSchema,
  insertStaffSchema,
} from "@shared/schema";
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

function routeId(value: string | string[]): number {
  return idSchema.parse(Array.isArray(value) ? value[0] : value);
}

function safeStudent(student: Awaited<ReturnType<typeof storage.getStudent>>) {
  if (!student) return student;

  const { aadhaar: _aadhaar, ...safe } = student;
  return safe;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = credentialsSchema.parse(req.body);
    const user = await storage.getUserByUsername(username);

    if (!user || !user.schoolId || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.isActive === 0) {
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

  // Academic sessions
  app.get("/api/academic-sessions/active", requireAuth, async (req, res) => {
    const session = await storage.getActiveSession(currentUser(req).schoolId);
    return res.json(session ?? null);
  });

  // Schools
  app.get("/api/schools/:id", requireAuth, async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);

    if (id !== user.schoolId) {
      return res.status(404).json({ message: "School not found" });
    }

    const school = await storage.getSchool(user.schoolId);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json(school);
  });

  app.put("/api/schools/:id", requireRole("admin"), async (req, res) => {
    const id = routeId(req.params.id);
    const user = currentUser(req);

    if (id !== user.schoolId) {
      return res.status(404).json({ message: "School not found" });
    }

    const result = insertSchoolSchema.partial().safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const updated = await storage.updateSchool(user.schoolId, result.data);
    return res.json(updated);
  });

  // Students
  app.get("/api/students", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const activeSession = await storage.getActiveSession(user.schoolId);

    if (!activeSession) {
      return res.json([]);
    }

    const filters = {
      class:
        typeof req.query.class === "string"
          ? req.query.class
          : undefined,
      section:
        typeof req.query.section === "string"
          ? req.query.section
          : undefined,
      search:
        typeof req.query.search === "string"
          ? req.query.search
          : undefined,
    };

    const students = await storage.getStudents(
      user.schoolId,
      filters,
      activeSession.id,
    );

    return res.json(students.map(safeStudent));
  });

  app.post(
    "/api/students",
    requireRole("admin", "staff", "teacher"),
    async (req, res) => {
      const result = insertStudentSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const user = currentUser(req);
      const activeSession = await storage.getActiveSession(user.schoolId);

      if (!activeSession) {
        return res.status(409).json({
          message: "No active academic session",
        });
      }

      const admissionNo =
        result.data.admissionNo?.trim() ||
        `ADM-${new Date().getFullYear()}-${Date.now()}`;

      const student = await storage.createStudent({
        ...result.data,
        admissionNo,
        schoolId: user.schoolId,
        sessionId: activeSession.id,
      });

      return res.status(201).json(safeStudent(student));
    },
  );

  app.get("/api/students/:id", requireAuth, async (req, res) => {
    const student = await storage.getStudent(
      routeId(req.params.id),
      currentUser(req).schoolId,
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.json(safeStudent(student));
  });

  app.put(
    "/api/students/:id",
    requireRole("admin", "staff", "teacher"),
    async (req, res) => {
      const result = insertStudentSchema
        .partial()
        .safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const updated = await storage.updateStudent(
        routeId(req.params.id),
        currentUser(req).schoolId,
        result.data,
      );

      if (!updated) {
        return res.status(404).json({ message: "Student not found" });
      }

      return res.json(safeStudent(updated));
    },
  );

  app.post(
    "/api/students/:id/deactivate",
    requireRole("admin", "staff"),
    async (req, res) => {
      const updated = await storage.deactivateStudent(
        routeId(req.params.id),
        currentUser(req).schoolId,
      );

      if (!updated) {
        return res.status(404).json({ message: "Student not found" });
      }

      return res.json(safeStudent(updated));
    },
  );

  app.post(
    "/api/students/promote",
    requireRole("admin"),
    async (req, res) => {
      const input = z
        .object({
          studentIds: z.array(idSchema).min(1),
          targetClass: z.string().trim().min(1).max(100),
        })
        .safeParse(req.body);

      if (!input.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      await storage.promoteStudents(
        input.data.studentIds,
        currentUser(req).schoolId,
        input.data.targetClass,
      );

      return res.json({ message: "Students promoted successfully" });
    },
  );

  // Fees
  app.get("/api/fee-structures", requireAuth, async (req, res) => {
    const user = currentUser(req);
    const activeSession = await storage.getActiveSession(user.schoolId);

    if (!activeSession) {
      return res.json([]);
    }

    const structures = await storage.getFeeStructures(
      user.schoolId,
      activeSession.id,
    );

    return res.json(structures);
  });

  app.post(
    "/api/fee-structures",
    requireRole("admin", "accountant"),
    async (req, res) => {
      const result = insertFeeStructureSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const user = currentUser(req);
      const activeSession = await storage.getActiveSession(user.schoolId);

      if (!activeSession) {
        return res.status(409).json({
          message: "No active academic session",
        });
      }

      const structure = await storage.createFeeStructure({
        ...result.data,
        schoolId: user.schoolId,
        sessionId: activeSession.id,
      });

      return res.status(201).json(structure);
    },
  );

  app.put(
    "/api/fee-structures/:id",
    requireRole("admin", "accountant"),
    async (req, res) => {
      const result = insertFeeStructureSchema
        .partial()
        .safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const updated = await storage.updateFeeStructure(
        routeId(req.params.id),
        currentUser(req).schoolId,
        result.data,
      );

      if (!updated) {
        return res.status(404).json({
          message: "Fee structure not found",
        });
      }

      return res.json(updated);
    },
  );

  app.delete(
    "/api/fee-structures/:id",
    requireRole("admin", "accountant"),
    async (req, res) => {
      const deleted = await storage.deleteFeeStructure(
        routeId(req.params.id),
        currentUser(req).schoolId,
      );

      if (!deleted) {
        return res.status(409).json({
          message:
            "Fee structure not found or already used by fee records",
        });
      }

      return res.status(204).send();
    },
  );

  app.get(
    "/api/payments",
    requireRole("admin", "accountant", "staff"),
    async (req, res) => {
      const user = currentUser(req);
      const studentId =
        req.query.studentId === undefined
          ? undefined
          : idSchema.parse(req.query.studentId);

      const activeSession = await storage.getActiveSession(user.schoolId);

      const sessionId =
        req.query.sessionId === undefined
          ? activeSession?.id
          : idSchema.parse(req.query.sessionId);

      if (sessionId === undefined) {
        return res.json([]);
      }

      const payments = await storage.getFeePayments(
        user.schoolId,
        studentId,
        sessionId,
      );

      return res.json(payments);
    },
  );

  app.post(
    "/api/payments",
    requireRole("admin", "accountant"),
    async (req, res) => {
      const result = insertFeePaymentSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const user = currentUser(req);
      const activeSession = await storage.getActiveSession(user.schoolId);

      if (!activeSession) {
        return res.status(409).json({
          message: "No active academic session",
        });
      }

      const payment = await storage.createFeePaymentForSchool(
        {
          ...result.data,
          schoolId: user.schoolId,
          sessionId: activeSession.id,
        },
        user.schoolId,
      );

      if (!payment) {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      return res.status(201).json(payment);
    },
  );

  app.get(
    "/api/fees/defaulters",
    requireRole("admin", "accountant", "staff"),
    async (req, res) => {
      const classStr =
        typeof req.query.class === "string"
          ? req.query.class
          : undefined;

      const month =
        typeof req.query.month === "string"
          ? req.query.month
          : undefined;

      const year =
        req.query.year === undefined
          ? undefined
          : z.coerce.number().int().min(1900).max(2200).parse(
              req.query.year,
            );

      const defaulters = await storage.getDefaulters(
        currentUser(req).schoolId,
        classStr,
        month,
        year,
      );

      return res.json(defaulters);
    },
  );

  // Staff
  app.get("/api/staff", requireRole("admin"), async (req, res) => {
    const staffList = await storage.getStaff(
      currentUser(req).schoolId,
    );

    return res.json(staffList);
  });

  app.post(
    "/api/staff",
    requireRole("admin"),
    async (req, res) => {
      const result = insertStaffSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const newStaff = await storage.createStaff({
        ...result.data,
        schoolId: currentUser(req).schoolId,
      });

      return res.status(201).json(newStaff);
    },
  );

  app.put(
    "/api/staff/:id",
    requireRole("admin"),
    async (req, res) => {
      const result = insertStaffSchema
        .partial()
        .safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const updated = await storage.updateStaff(
        routeId(req.params.id),
        currentUser(req).schoolId,
        result.data,
      );

      if (!updated) {
        return res.status(404).json({
          message: "Staff member not found",
        });
      }

      return res.json(updated);
    },
  );

  return createServer(app);
}