
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Schools ===
  app.get(api.schools.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const school = await storage.getSchool(id);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  app.put(api.schools.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.schools.update.input.parse(req.body);
    const updated = await storage.updateSchool(id, input);
    res.json(updated);
  });

  // === Students ===
  app.get(api.students.list.path, async (req, res) => {
    // Hardcoded schoolId for MVP (assuming single tenant per deployment or session based)
    // In a real app, this comes from req.user.schoolId
    const schoolId = 1; 
    const filters = {
      class: req.query.class as string,
      section: req.query.section as string,
      search: req.query.search as string,
    };
    const students = await storage.getStudents(schoolId, filters);
    res.json(students);
  });

  app.post(api.students.create.path, async (req, res) => {
    const input = api.students.create.input.parse(req.body);
    const student = await storage.createStudent(input);
    res.status(201).json(student);
  });

  app.get(api.students.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const student = await storage.getStudent(id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  });

  app.put(api.students.update.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.students.update.input.parse(req.body);
    const updated = await storage.updateStudent(id, input);
    res.json(updated);
  });

  app.post(api.students.promote.path, async (req, res) => {
    const { studentIds, targetClass } = req.body;
    await storage.promoteStudents(studentIds, targetClass);
    res.json({ message: "Students promoted successfully" });
  });

  // === Fees ===
  app.get(api.fees.structures.list.path, async (req, res) => {
    const schoolId = 1;
    const structures = await storage.getFeeStructures(schoolId);
    res.json(structures);
  });

  app.post(api.fees.structures.create.path, async (req, res) => {
    const input = api.fees.structures.create.input.parse(req.body);
    const structure = await storage.createFeeStructure(input);
    res.status(201).json(structure);
  });

  app.get(api.fees.payments.list.path, async (req, res) => {
    const schoolId = 1;
    const studentId = req.query.studentId ? parseInt(req.query.studentId as string) : undefined;
    const payments = await storage.getFeePayments(schoolId, studentId);
    res.json(payments);
  });

  app.post(api.fees.payments.create.path, async (req, res) => {
    const input = api.fees.payments.create.input.parse(req.body);
    const payment = await storage.createFeePayment(input);
    res.status(201).json(payment);
  });

  app.get(api.fees.payments.defaulters.path, async (req, res) => {
    const schoolId = 1;
    const classStr = req.query.class as string;
    const month = req.query.month as string;
    const defaulters = await storage.getDefaulters(schoolId, classStr, month);
    res.json(defaulters);
  });

  // === Staff ===
  app.get(api.staff.list.path, async (req, res) => {
    const schoolId = 1;
    const staffMembers = await storage.getStaff(schoolId);
    res.json(staffMembers);
  });

  app.post(api.staff.create.path, async (req, res) => {
    const input = api.staff.create.input.parse(req.body);
    const staffMember = await storage.createStaff(input);
    res.status(201).json(staffMember);
  });

  // Seed Data function
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const school = await storage.getSchool(1);
  if (!school) {
    console.log("Seeding database...");
    await storage.createSchool({
      name: "St. Xavier's Public School",
      address: "123, MG Road, New Delhi",
      contact: "9876543210",
      logo: "https://placehold.co/100x100?text=Logo",
    });

    await storage.createUser({
      username: "admin",
      password: "password123", // In real app, hash this!
      role: "admin",
      name: "Principal",
      schoolId: 1,
    });

    // Fee Structure
    await storage.createFeeStructure({
      class: "10",
      monthlyFee: 1500,
      admissionFee: 5000,
      schoolId: 1,
    });

    // Students
    const student = await storage.createStudent({
      admissionNo: "A001",
      name: "Rohan Kumar",
      fatherName: "Suresh Kumar",
      class: "10",
      section: "A",
      rollNo: "1",
      contact: "9988776655",
      address: "Sector 4, Delhi",
      schoolId: 1,
    });

    // Payments
    await storage.createFeePayment({
      studentId: student.id,
      amount: 1500,
      month: "January",
      year: 2024,
      receiptNo: "REC001",
      remarks: "Cash",
      schoolId: 1,
    });

    console.log("Seeding complete.");
  }
}
