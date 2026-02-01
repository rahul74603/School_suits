
import { 
  users, schools, students, feeStructures, feePayments, staff,
  type User, type InsertUser, type School, type InsertSchool,
  type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
  type FeePayment, type InsertFeePayment, type Staff, type InsertStaff
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users & Schools
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  // Students
  getStudent(id: number): Promise<Student | undefined>;
  getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student>;
  promoteStudents(studentIds: number[], targetClass: string): Promise<void>;

  // Fees
  getFeeStructures(schoolId: number): Promise<FeeStructure[]>;
  createFeeStructure(structure: InsertFeeStructure): Promise<FeeStructure>;
  getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]>;
  createFeePayment(payment: InsertFeePayment): Promise<FeePayment>;
  getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]>;

  // Staff
  getStaff(schoolId: number): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
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

  // === Students ===
  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]> {
    const conditions = [eq(students.schoolId, schoolId), eq(students.isActive, true)];
    
    if (filters?.class && filters.class !== "all") conditions.push(eq(students.class, filters.class));
    if (filters?.section && filters.section !== "all") conditions.push(eq(students.section, filters.section));
    if (filters?.search) conditions.push(ilike(students.name, `%${filters.search}%`));

    return await db.select().from(students).where(and(...conditions));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, updates: Partial<InsertStudent>): Promise<Student> {
    const [updated] = await db.update(students).set(updates).where(eq(students.id, id)).returning();
    return updated;
  }

  async promoteStudents(studentIds: number[], targetClass: string): Promise<void> {
    await db.update(students)
      .set({ class: targetClass })
      .where(sql`${students.id} IN ${studentIds}`);
  }

  // === Fees ===
  async getFeeStructures(schoolId: number): Promise<FeeStructure[]> {
    return await db.select().from(feeStructures).where(eq(feeStructures.schoolId, schoolId));
  }

  async createFeeStructure(insertStructure: InsertFeeStructure): Promise<FeeStructure> {
    const [structure] = await db.insert(feeStructures).values(insertStructure).returning();
    return structure;
  }

  async getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]> {
    if (studentId) {
      return await db.select().from(feePayments).where(eq(feePayments.studentId, studentId));
    }
    return await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
  }

  async createFeePayment(insertPayment: InsertFeePayment): Promise<FeePayment> {
    const [payment] = await db.insert(feePayments).values(insertPayment).returning();
    return payment;
  }

  async getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]> {
    // This is a simplified logic. In a real app, we'd join with fee structures and check payments.
    // For now, we'll return a mocked structure or basic query if we had complex logic.
    // Let's implement a basic check: Students in a class who haven't paid for a specific month.
    
    // 1. Get all active students in the class
    const studentList = await this.getStudents(schoolId, { class: classStr });
    
    // 2. Get payments for that month
    // This requires a more complex query or multiple queries. For MVP, we'll do in-memory filtering for simplicity or a subquery.
    
    const defaulters = [];
    for (const student of studentList) {
      const payment = await db.select().from(feePayments).where(
        and(
          eq(feePayments.studentId, student.id),
          eq(feePayments.month, month || ""), 
          eq(feePayments.year, new Date().getFullYear())
        )
      );
      
      if (payment.length === 0) {
        // Need to find fee amount for this class
        const [feeStruct] = await db.select().from(feeStructures).where(
            and(eq(feeStructures.class, student.class), eq(feeStructures.schoolId, schoolId))
        );
        const amount = feeStruct ? feeStruct.monthlyFee : 0;
        
        defaulters.push({
          studentId: student.id,
          name: student.name,
          amountPending: amount
        });
      }
    }
    return defaulters;
  }

  // === Staff ===
  async getStaff(schoolId: number): Promise<Staff[]> {
    return await db.select().from(staff).where(eq(staff.schoolId, schoolId));
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(insertStaff).returning();
    return newStaff;
  }
}

export const storage = new DatabaseStorage();
