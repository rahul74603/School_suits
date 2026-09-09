import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertSchoolSchema,
  insertStudentSchema,
  insertFeeStructureSchema,
  insertFeePaymentSchema,
  insertStaffSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const parseSchoolId = (value: unknown) => {
    if (typeof value !== "string") return 1;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const parseOptionalId = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };
  
  // Schools
  app.get("/api/schools", async (req, res) => {
    const schools = (await storage.getSchools?.()) || [];
    res.json(schools);
  });

  app.get("/api/schools/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const school = await storage.getSchool(id);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  app.post("/api/schools", async (req, res) => {
    const result = insertSchoolSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const school = await storage.createSchool(result.data);
    res.json(school);
  });

  // Students
  app.get("/api/students", async (req, res) => {
    const schoolId = parseSchoolId(req.query.schoolId);
    
    const filters = {
      class: typeof req.query.class === "string" ? req.query.class : undefined,
      section: typeof req.query.section === "string" ? req.query.section : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
    };
    
    const students = await storage.getStudents(schoolId, filters);
    res.json(students);
  });

  app.post("/api/students", async (req, res) => {
    const result = insertStudentSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const student = await storage.createStudent(result.data);
    res.json(student);
  });

  // Fees
  app.get("/api/fee-structures", async (req, res) => {
    const schoolId = parseSchoolId(req.query.schoolId);
    const structures = await storage.getFeeStructures(schoolId);
    res.json(structures);
  });

  app.post("/api/fee-structures", async (req, res) => {
    const result = insertFeeStructureSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const structure = await storage.createFeeStructure(result.data);
    res.json(structure);
  });

  app.get("/api/payments", async (req, res) => {
    const schoolId = parseSchoolId(req.query.schoolId);
    const studentId = parseOptionalId(req.query.studentId);
    const payments = await storage.getFeePayments(schoolId, studentId);
    res.json(payments);
  });

  app.post("/api/payments", async (req, res) => {
    const result = insertFeePaymentSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const payment = await storage.createFeePayment(result.data);
    res.status(201).json(payment);
  });

  app.get("/api/fees/defaulters", async (req, res) => {
    const schoolId = parseSchoolId(req.query.schoolId);
    const classStr = typeof req.query.class === "string" ? req.query.class : undefined;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const defaulters = await storage.getDefaulters(schoolId, classStr, month);
    res.json(defaulters);
  });

  // Staff
  app.get("/api/staff", async (req, res) => {
    const schoolId = parseSchoolId(req.query.schoolId);
    const staffList = await storage.getStaff(schoolId);
    res.json(staffList);
  });

  app.post("/api/staff", async (req, res) => {
    const result = insertStaffSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const newStaff = await storage.createStaff(result.data);
    res.json(newStaff);
  });

  const httpServer = createServer(app);
  return httpServer;
}
