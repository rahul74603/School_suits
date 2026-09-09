
import { 
  users, schools, academicSessions, students, feeStructures, feePayments, staff,
  type User, type InsertUser, type School, type InsertSchool,
  type AcademicSession, type InsertAcademicSession, type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
  type FeePayment, type InsertFeePayment, type Staff, type InsertStaff, type StoredStudentInsert, type StoredFeeStructureInsert, type StoredFeePaymentInsert, type StoredStaffInsert
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, or, sql } from "drizzle-orm";

export interface IStorage {
  // Users & Schools
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  // Academic sessions
  getActiveSession(schoolId: number): Promise<AcademicSession | undefined>;
  createAcademicSession(session: InsertAcademicSession & { schoolId: number }): Promise<AcademicSession>;

  // Students
  getStudent(id: number, schoolId: number): Promise<Student | undefined>;
  getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }, sessionId?: number): Promise<Student[]>;
  createStudent(student: StoredStudentInsert): Promise<Student>;
  updateStudent(id: number, schoolId: number, student: Partial<StoredStudentInsert>): Promise<Student>;
  deactivateStudent(id: number, schoolId: number): Promise<Student | undefined>;
  promoteStudents(studentIds: number[], schoolId: number, targetClass: string): Promise<void>;

  // Fees
  getFeeStructures(schoolId: number, sessionId?: number): Promise<FeeStructure[]>;
  createFeeStructure(structure: StoredFeeStructureInsert): Promise<FeeStructure>;
  updateFeeStructure(id: number, schoolId: number, updates: Partial<StoredFeeStructureInsert>): Promise<FeeStructure | undefined>;
  deleteFeeStructure(id: number, schoolId: number): Promise<boolean>;
  getFeePayments(schoolId: number, studentId?: number, sessionId?: number): Promise<FeePayment[]>;
  createFeePayment(payment: StoredFeePaymentInsert): Promise<FeePayment>;
  createFeePaymentForSchool(payment: StoredFeePaymentInsert, schoolId: number): Promise<FeePayment | undefined>;
  getDefaulters(schoolId: number, classStr?: string, month?: string, year?: number): Promise<{ studentId: number, name: string, class: string, section: string, amountPaid: number, amountPending: number, month: string, year: number }[]>;

  // Staff
  getStaff(schoolId: number): Promise<Staff[]>;
  createStaff(staff: StoredStaffInsert): Promise<Staff>;
  updateStaff(id: number, schoolId: number, updates: Partial<StoredStaffInsert>): Promise<Staff | undefined>;
}

export class DatabaseStorage implements IStorage {
  // === Users & Schools ===
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSchool(id: number): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: number, updates: Partial<InsertSchool>): Promise<School> {
    const [updated] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning();
    return updated;
  }

  // === Academic sessions ===
  async getActiveSession(schoolId: number): Promise<AcademicSession | undefined> {
    const [session] = await db.select().from(academicSessions).where(
      and(eq(academicSessions.schoolId, schoolId), eq(academicSessions.isActive, true)),
    );
    return session;
  }

  async createAcademicSession(insertSession: InsertAcademicSession & { schoolId: number }): Promise<AcademicSession> {
    const [session] = await db.insert(academicSessions).values(insertSession).returning();
    return session;
  }

  // === Students ===
  async getStudent(id: number, schoolId: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(
      and(eq(students.id, id), eq(students.schoolId, schoolId)),
    );
    return student;
  }

  async getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }, sessionId?: number): Promise<Student[]> {
    const conditions = [eq(students.schoolId, schoolId), eq(students.isActive, true)];
    if (sessionId !== undefined) conditions.push(eq(students.sessionId, sessionId));
    
    if (filters?.class && filters.class !== "all") conditions.push(eq(students.class, filters.class));
    if (filters?.section && filters.section !== "all") conditions.push(eq(students.section, filters.section));
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(or(ilike(students.name, term), ilike(students.admissionNo, term), ilike(students.rollNo, term))!);
    }

    return await db.select().from(students).where(and(...conditions));
  }

  async createStudent(insertStudent: StoredStudentInsert): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, schoolId: number, updates: Partial<StoredStudentInsert>): Promise<Student> {
    const [updated] = await db.update(students).set({ ...updates, updatedAt: new Date() }).where(
      and(eq(students.id, id), eq(students.schoolId, schoolId)),
    ).returning();
    return updated;
  }

  async deactivateStudent(id: number, schoolId: number): Promise<Student | undefined> {
    const [updated] = await db.update(students).set({ isActive: false, updatedAt: new Date() }).where(
      and(eq(students.id, id), eq(students.schoolId, schoolId)),
    ).returning();
    return updated;
  }

  async promoteStudents(studentIds: number[], schoolId: number, targetClass: string): Promise<void> {
    if (studentIds.length === 0) return;
    await db.update(students)
      .set({ class: targetClass })
      .where(and(eq(students.schoolId, schoolId), sql`${students.id} IN ${studentIds}`));
  }

  // === Fees ===
  async getFeeStructures(schoolId: number, sessionId?: number): Promise<FeeStructure[]> {
    const conditions = [eq(feeStructures.schoolId, schoolId)];
    if (sessionId !== undefined) conditions.push(eq(feeStructures.sessionId, sessionId));
    return await db.select().from(feeStructures).where(and(...conditions));
  }

  async createFeeStructure(insertStructure: StoredFeeStructureInsert): Promise<FeeStructure> {
    const [structure] = await db.insert(feeStructures).values(insertStructure).returning();
    return structure;
  }

  async updateFeeStructure(id: number, schoolId: number, updates: Partial<StoredFeeStructureInsert>): Promise<FeeStructure | undefined> {
    const [updated] = await db.update(feeStructures).set({ ...updates, updatedAt: new Date() }).where(
      and(eq(feeStructures.id, id), eq(feeStructures.schoolId, schoolId)),
    ).returning();
    return updated;
  }

  async deleteFeeStructure(id: number, schoolId: number): Promise<boolean> {
    const [structure] = await db.select().from(feeStructures).where(and(eq(feeStructures.id, id), eq(feeStructures.schoolId, schoolId)));
    if (!structure) return false;
    const relatedPayments = await db.select({ id: feePayments.id }).from(feePayments).where(
      and(eq(feePayments.schoolId, schoolId), eq(feePayments.sessionId, structure.sessionId)),
    ).limit(1);
    if (relatedPayments.length > 0) return false;
    await db.delete(feeStructures).where(and(eq(feeStructures.id, id), eq(feeStructures.schoolId, schoolId)));
    return true;
  }

  async getFeePayments(schoolId: number, studentId?: number, sessionId?: number): Promise<FeePayment[]> {
    const conditions = [eq(feePayments.schoolId, schoolId)];
    if (studentId) conditions.push(eq(feePayments.studentId, studentId));
    if (sessionId) conditions.push(eq(feePayments.sessionId, sessionId));
    return await db.select().from(feePayments).where(and(...conditions));
  }

  async createFeePayment(insertPayment: StoredFeePaymentInsert): Promise<FeePayment> {
    const [payment] = await db.insert(feePayments).values(insertPayment).returning();
    return payment;
  }

  async createFeePaymentForSchool(
    insertPayment: StoredFeePaymentInsert,
    schoolId: number,
  ): Promise<FeePayment | undefined> {
    return db.transaction(async (transaction) => {
      const [student] = await transaction.select({ id: students.id }).from(students).where(
        and(eq(students.id, insertPayment.studentId), eq(students.schoolId, schoolId)),
      );
      if (!student) return undefined;
      const [payment] = await transaction.insert(feePayments).values({
        ...insertPayment,
        schoolId,
      }).returning();
      return payment;
    });
  }

  async getDefaulters(schoolId: number, classStr?: string, month?: string, year?: number): Promise<{ studentId: number, name: string, class: string, section: string, amountPaid: number, amountPending: number, month: string, year: number }[]> {
    const activeSession = await this.getActiveSession(schoolId);
    if (!activeSession || !month) return [];
    const targetYear = year ?? (activeSession.startDate ? new Date(`${activeSession.startDate}T00:00:00`).getFullYear() : new Date().getFullYear());
    const studentList = await this.getStudents(schoolId, { class: classStr }, activeSession.id);
    const structures = await db.select().from(feeStructures).where(and(eq(feeStructures.schoolId, schoolId), eq(feeStructures.sessionId, activeSession.id)));
    const payments = await db.select().from(feePayments).where(and(
      eq(feePayments.schoolId, schoolId), eq(feePayments.sessionId, activeSession.id),
      eq(feePayments.month, month), eq(feePayments.year, targetYear),
    ));
    const structureByClass = new Map(structures.map((structure) => [structure.class, structure.monthlyFee]));
    const paidByStudent = new Map<number, number>();
    for (const payment of payments) paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) ?? 0) + payment.amount);
    return studentList.flatMap((student) => {
      const expected = structureByClass.get(student.class) ?? 0;
      const amountPaid = paidByStudent.get(student.id) ?? 0;
      const amountPending = Math.max(expected - amountPaid, 0);
      return amountPending > 0 ? [{ studentId: student.id, name: student.name, class: student.class, section: student.section, amountPaid, amountPending, month, year: targetYear }] : [];
    });
  }

  // === Staff ===
  async getStaff(schoolId: number): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.schoolId, schoolId));
  }

  async createStaff(insertStaff: StoredStaffInsert): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(insertStaff).returning();
    return newStaff;
  }

  async updateStaff(id: number, schoolId: number, updates: Partial<StoredStaffInsert>): Promise<Staff | undefined> {
    const [updated] = await db.update(staff).set({ ...updates, updatedAt: new Date() }).where(
      and(eq(staff.id, id), eq(staff.schoolId, schoolId)),
    ).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
