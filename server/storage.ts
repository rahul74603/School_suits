import {
  users,
  schools,
  academicSessions,
  students,
  feeStructures,
  feePayments,
  staff,
  studentDues,
  type User,
  type InsertUser,
  type School,
  type InsertSchool,
  type AcademicSession,
  type InsertAcademicSession,
  type Student,
  type InsertStudent,
  type FeeStructure,
  type InsertFeeStructure,
  type FeePayment,
  type InsertFeePayment,
  type Staff,
  type InsertStaff,
  type StudentDues,
  type InsertStudentDues,
  type StoredStudentInsert,
  type StoredFeeStructureInsert,
  type StoredFeePaymentInsert,
  type StoredStaffInsert,
} from "@shared/schema";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getSchools(): Promise<School[]>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  getActiveSession(schoolId: number): Promise<AcademicSession | undefined>;
  createAcademicSession(
    session: InsertAcademicSession & { schoolId: number },
  ): Promise<AcademicSession>;

  getStudent(id: number, schoolId?: number): Promise<Student | undefined>;
  getStudents(
    schoolId: number,
    filters?: { class?: string; section?: string; search?: string },
    sessionId?: number,
  ): Promise<Student[]>;
  createStudent(student: StoredStudentInsert): Promise<Student>;
  updateStudent(
    id: number,
    schoolId: number,
    student: Partial<StoredStudentInsert>,
  ): Promise<Student | undefined>;
  deactivateStudent(id: number, schoolId: number): Promise<Student | undefined>;
  promoteStudents(
    studentIds: number[],
    schoolId: number,
    targetClass: string,
  ): Promise<void>;

  getFeeStructures(
    schoolId: number,
    sessionId?: number,
  ): Promise<FeeStructure[]>;
  createFeeStructure(
    structure: StoredFeeStructureInsert,
  ): Promise<FeeStructure>;
  updateFeeStructure(
    id: number,
    schoolId: number,
    updates: Partial<StoredFeeStructureInsert>,
  ): Promise<FeeStructure | undefined>;
  deleteFeeStructure(id: number, schoolId: number): Promise<boolean>;

  getFeePayments(
    schoolId: number,
    studentId?: number,
    sessionId?: number,
  ): Promise<FeePayment[]>;
  createFeePayment(payment: StoredFeePaymentInsert): Promise<FeePayment>;
  createFeePaymentForSchool(
    payment: StoredFeePaymentInsert,
    schoolId: number,
  ): Promise<FeePayment | undefined>;

  getDefaulters(
    schoolId: number,
    classStr?: string,
    month?: string,
    year?: number,
  ): Promise<
    {
      studentId: number;
      name: string;
      class: string;
      section: string;
      amountPaid: number;
      amountPending: number;
      month: string;
      year: number;
    }[]
  >;

  getStaff(schoolId: number): Promise<Staff[]>;
  createStaff(staff: StoredStaffInsert): Promise<Staff>;
  updateStaff(
    id: number,
    schoolId: number,
    updates: Partial<StoredStaffInsert>,
  ): Promise<Staff | undefined>;

  getStudentStatus(
    studentId: number,
    classStr: string,
    year: number,
    schoolId?: number,
    sessionId?: number,
  ): Promise<{
    admissionPaid: boolean;
    admissionBalance: number;
    admissionPaidSoFar: number;
    admissionTotal: number;
    monthStatus: Array<{
      name: string;
      tuitionStatus: "paid" | "due" | "future";
      transportStatus: "paid" | "due" | "future";
      extras?: Array<{
        name: string;
        amount: number;
        status: "paid" | "due" | "future";
      }>;
    }>;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    monthlyFee: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchool(id: number): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db
      .insert(schools)
      .values(insertSchool)
      .returning();
    return school;
  }

  async updateSchool(
    id: number,
    schoolUpdate: Partial<InsertSchool>,
  ): Promise<School> {
    const [school] = await db
      .update(schools)
      .set(schoolUpdate)
      .where(eq(schools.id, id))
      .returning();
    if (!school) {
      throw new Error("School not found");
    }
    return school;
  }

  async getActiveSession(
    schoolId: number,
  ): Promise<AcademicSession | undefined> {
    const [session] = await db
      .select()
      .from(academicSessions)
      .where(
        and(
          eq(academicSessions.schoolId, schoolId),
          eq(academicSessions.isActive, true),
        ),
      )
      .limit(1);
    return session;
  }

  async createAcademicSession(
    insertSession: InsertAcademicSession & { schoolId: number },
  ): Promise<AcademicSession> {
    const [session] = await db
      .insert(academicSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getStudent(
    id: number,
    schoolId?: number,
  ): Promise<Student | undefined> {
    const conditions = [eq(students.id, id)];

    if (schoolId !== undefined) {
      conditions.push(eq(students.schoolId, schoolId));
    }

    const [student] = await db
      .select()
      .from(students)
      .where(and(...conditions));

    return student;
  }

  async getStudents(
    schoolId: number,
    filters?: { class?: string; section?: string; search?: string },
    sessionId?: number,
  ): Promise<Student[]> {
    const conditions = [
      eq(students.schoolId, schoolId),
      eq(students.isActive, 1),
    ];

    if (sessionId !== undefined) {
      conditions.push(eq(students.sessionId, sessionId));
    }

    if (filters?.class && filters.class !== "all") {
      conditions.push(eq(students.class, filters.class));
    }

    if (filters?.section && filters.section !== "all") {
      conditions.push(eq(students.section, filters.section));
    }

    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(students.name, term),
          ilike(students.admissionNo, term),
          ilike(students.rollNo, term),
        )!,
      );
    }

    return await db
      .select()
      .from(students)
      .where(and(...conditions));
  }

  async createStudent(
    insertStudent: StoredStudentInsert,
  ): Promise<Student> {
    const [student] = await db
      .insert(students)
      .values(insertStudent)
      .returning();

    return student;
  }

  async updateStudent(
    id: number,
    schoolId: number,
    studentUpdate: Partial<StoredStudentInsert>,
  ): Promise<Student | undefined> {
    const [student] = await db
      .update(students)
      .set({
        ...studentUpdate,
        updatedAt: new Date(),
      })
      .where(
        and(eq(students.id, id), eq(students.schoolId, schoolId)),
      )
      .returning();

    return student;
  }

  async deactivateStudent(
    id: number,
    schoolId: number,
  ): Promise<Student | undefined> {
    const [student] = await db
      .update(students)
      .set({
        isActive: 0,
        updatedAt: new Date(),
      })
      .where(
        and(eq(students.id, id), eq(students.schoolId, schoolId)),
      )
      .returning();

    return student;
  }

  async promoteStudents(
    studentIds: number[],
    schoolId: number,
    targetClass: string,
  ): Promise<void> {
    if (studentIds.length === 0) {
      return;
    }

    await db
      .update(students)
      .set({
        class: targetClass,
        isPromoted: 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(students.schoolId, schoolId),
          sql`${students.id} IN ${studentIds}`,
        ),
      );
  }

  async getFeeStructures(
    schoolId: number,
    sessionId?: number,
  ): Promise<FeeStructure[]> {
    const conditions = [eq(feeStructures.schoolId, schoolId)];

    if (sessionId !== undefined) {
      conditions.push(eq(feeStructures.sessionId, sessionId));
    }

    return await db
      .select()
      .from(feeStructures)
      .where(and(...conditions));
  }

  async createFeeStructure(
    insertStructure: StoredFeeStructureInsert,
  ): Promise<FeeStructure> {
    const [structure] = await db
      .insert(feeStructures)
      .values(insertStructure)
      .returning();

    return structure;
  }

  async updateFeeStructure(
    id: number,
    schoolId: number,
    updates: Partial<StoredFeeStructureInsert>,
  ): Promise<FeeStructure | undefined> {
    const [updated] = await db
      .update(feeStructures)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feeStructures.id, id),
          eq(feeStructures.schoolId, schoolId),
        ),
      )
      .returning();

    return updated;
  }

  async deleteFeeStructure(
    id: number,
    schoolId: number,
  ): Promise<boolean> {
    const [structure] = await db
      .select()
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.id, id),
          eq(feeStructures.schoolId, schoolId),
        ),
      )
      .limit(1);

    if (!structure) {
      return false;
    }

    const [payment] = await db
      .select({ id: feePayments.id })
      .from(feePayments)
      .where(
        and(
          eq(feePayments.schoolId, schoolId),
          eq(feePayments.sessionId, structure.sessionId),
        ),
      )
      .limit(1);

    if (payment) {
      return false;
    }

    await db
      .delete(feeStructures)
      .where(
        and(
          eq(feeStructures.id, id),
          eq(feeStructures.schoolId, schoolId),
        ),
      );

    return true;
  }

  async getFeePayments(
    schoolId: number,
    studentId?: number,
    sessionId?: number,
  ): Promise<FeePayment[]> {
    const conditions = [eq(feePayments.schoolId, schoolId)];

    if (studentId !== undefined) {
      conditions.push(eq(feePayments.studentId, studentId));
    }

    if (sessionId !== undefined) {
      conditions.push(eq(feePayments.sessionId, sessionId));
    }

    return await db
      .select()
      .from(feePayments)
      .where(and(...conditions));
  }

  async createFeePayment(
    insertPayment: StoredFeePaymentInsert,
  ): Promise<FeePayment> {
    const [payment] = await db
      .insert(feePayments)
      .values(insertPayment)
      .returning();

    return payment;
  }

  async createFeePaymentForSchool(
    insertPayment: StoredFeePaymentInsert,
    schoolId: number,
  ): Promise<FeePayment | undefined> {
    return await db.transaction(async (transaction) => {
      const [student] = await transaction
        .select({
          id: students.id,
          schoolId: students.schoolId,
          sessionId: students.sessionId,
        })
        .from(students)
        .where(
          and(
            eq(students.id, insertPayment.studentId),
            eq(students.schoolId, schoolId),
            eq(students.sessionId, insertPayment.sessionId),
            eq(students.isActive, 1),
          ),
        )
        .limit(1);

      if (!student) {
        return undefined;
      }

      const [payment] = await transaction
        .insert(feePayments)
        .values({
          ...insertPayment,
          schoolId,
        })
        .returning();

      return payment;
    });
  }

  async getDefaulters(
    schoolId: number,
    classStr?: string,
    month?: string,
    year?: number,
  ): Promise<
    {
      studentId: number;
      name: string;
      class: string;
      section: string;
      amountPaid: number;
      amountPending: number;
      month: string;
      year: number;
    }[]
  > {
    const activeSession = await this.getActiveSession(schoolId);

    if (!activeSession || !month) {
      return [];
    }

    const targetYear =
      year ??
      (activeSession.startDate
        ? new Date(`${activeSession.startDate}T00:00:00`).getFullYear()
        : new Date().getFullYear());

    const studentList = await this.getStudents(
      schoolId,
      { class: classStr },
      activeSession.id,
    );

    const structures = await db
      .select()
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.schoolId, schoolId),
          eq(feeStructures.sessionId, activeSession.id),
        ),
      );

    const payments = await db
      .select()
      .from(feePayments)
      .where(
        and(
          eq(feePayments.schoolId, schoolId),
          eq(feePayments.sessionId, activeSession.id),
          eq(feePayments.month, month),
          eq(feePayments.year, targetYear),
        ),
      );

    const structureByClass = new Map(
      structures.map((structure) => [
        structure.class,
        structure.monthlyFee,
      ]),
    );

    const paidByStudent = new Map<number, number>();

    for (const payment of payments) {
      paidByStudent.set(
        payment.studentId,
        (paidByStudent.get(payment.studentId) ?? 0) + payment.amount,
      );
    }

    return studentList.flatMap((student) => {
      const expected = structureByClass.get(student.class) ?? 0;
      const amountPaid = paidByStudent.get(student.id) ?? 0;
      const amountPending = Math.max(expected - amountPaid, 0);

      return amountPending > 0
        ? [
            {
              studentId: student.id,
              name: student.name,
              class: student.class,
              section: student.section,
              amountPaid,
              amountPending,
              month,
              year: targetYear,
            },
          ]
        : [];
    });
  }

  async getStaff(schoolId: number): Promise<Staff[]> {
    return await db
      .select()
      .from(staff)
      .where(eq(staff.schoolId, schoolId));
  }

  async createStaff(
    insertStaff: StoredStaffInsert,
  ): Promise<Staff> {
    const [newStaff] = await db
      .insert(staff)
      .values(insertStaff)
      .returning();

    return newStaff;
  }

  async updateStaff(
    id: number,
    schoolId: number,
    updates: Partial<StoredStaffInsert>,
  ): Promise<Staff | undefined> {
    const [updated] = await db
      .update(staff)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staff.id, id),
          eq(staff.schoolId, schoolId),
        ),
      )
      .returning();

    return updated;
  }

  async getStudentStatus(
    studentId: number,
    classStr: string,
    year: number,
    schoolId?: number,
    sessionId?: number,
  ) {
    const student = await this.getStudent(studentId, schoolId);

    if (!student) {
      throw new Error("Student not found");
    }

    const activeSessionId =
      sessionId ??
      (
        await this.getActiveSession(
          student.schoolId,
        )
      )?.id;

    if (!activeSessionId) {
      return {
        admissionPaid: false,
        admissionBalance: 0,
        admissionPaidSoFar: 0,
        admissionTotal: 0,
        monthStatus: [],
        pendingDues: [],
        monthlyFee: 0,
      };
    }

    const [feeStructure] = await db
      .select()
      .from(feeStructures)
      .where(
        and(
          eq(feeStructures.schoolId, student.schoolId),
          eq(feeStructures.sessionId, activeSessionId),
          eq(feeStructures.class, classStr),
        ),
      )
      .limit(1);

    if (!feeStructure) {
      return {
        admissionPaid: false,
        admissionBalance: 0,
        admissionPaidSoFar: 0,
        admissionTotal: 0,
        monthStatus: [],
        pendingDues: [],
        monthlyFee: 0,
      };
    }

    const payments = await db
      .select()
      .from(feePayments)
      .where(
        and(
          eq(feePayments.studentId, studentId),
          eq(feePayments.schoolId, student.schoolId),
          eq(feePayments.sessionId, activeSessionId),
          eq(feePayments.year, year),
        ),
      );

    const admissionPayments = payments.filter(
      (payment) => payment.remarks === "ADMISSION_FEE",
    );

    const admissionTotal = feeStructure.admissionFee ?? 0;
    const admissionPaidSoFar = admissionPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const admissionBalance = Math.max(
      0,
      admissionTotal - admissionPaidSoFar,
    );
    const admissionPaid = admissionBalance === 0;

    type MonthData = {
      name: string;
      tuitionStatus: "paid" | "due" | "future";
      transportStatus: "paid" | "due" | "future";
      extras?: Array<{
        name: string;
        amount: number;
        status: "paid" | "due" | "future";
      }>;
    };

    const months: MonthData[] = [
      { name: "April", tuitionStatus: "due", transportStatus: "due" },
      { name: "May", tuitionStatus: "due", transportStatus: "due" },
      { name: "June", tuitionStatus: "due", transportStatus: "due" },
      { name: "July", tuitionStatus: "due", transportStatus: "due" },
      { name: "August", tuitionStatus: "due", transportStatus: "due" },
      { name: "September", tuitionStatus: "due", transportStatus: "due" },
      { name: "October", tuitionStatus: "due", transportStatus: "due" },
      { name: "November", tuitionStatus: "due", transportStatus: "due" },
      { name: "December", tuitionStatus: "due", transportStatus: "due" },
      { name: "January", tuitionStatus: "due", transportStatus: "due" },
      { name: "February", tuitionStatus: "due", transportStatus: "due" },
      { name: "March", tuitionStatus: "due", transportStatus: "due" },
    ];

    payments.forEach((payment) => {
      const month = months.find(
        (item) => item.name === payment.month,
      );

      if (!month) {
        return;
      }

      if (payment.remarks === "TUITION_FEE") {
        month.tuitionStatus = "paid";
      } else if (payment.remarks === "TRANSPORT_FEE") {
        month.transportStatus = "paid";
      } else if (payment.remarks !== "ADMISSION_FEE") {
        month.extras ??= [];
        month.extras.push({
          name: payment.remarks || "Other Fee",
          amount: payment.amount,
          status: "paid",
        });
      }
    });

    const pendingDuesList = await db
      .select()
      .from(studentDues)
      .where(
        and(
          eq(studentDues.studentId, studentId),
          eq(studentDues.isPaid, 0),
        ),
      );

    return {
      admissionPaid,
      admissionBalance,
      admissionPaidSoFar,
      admissionTotal,
      monthStatus: months,
      pendingDues: pendingDuesList.map((due) => ({
        id: due.id,
        fee_name: due.feeName,
        due_date: due.dueDate.toISOString(),
        amount: due.amount,
      })),
      monthlyFee: feeStructure.monthlyFee,
    };
  }
}

// Database is mandatory for the current application.
export const storage: IStorage = new DatabaseStorage();

// Keep compatibility for existing imports that may use these types.
export type StorageInsertUser = InsertUser;
export type StorageInsertStudent = InsertStudent;
export type StorageInsertFeeStructure = InsertFeeStructure;
export type StorageInsertFeePayment = InsertFeePayment;
export type StorageInsertStaff = InsertStaff;
export type StorageStudentDues = StudentDues;
export type StorageInsertStudentDues = InsertStudentDues;
