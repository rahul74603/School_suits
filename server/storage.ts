
import { 
  users, schools, academicSessions, schoolClasses, schoolSections, students, documents, backupRecords, studentDues, subjects, teacherSubjectAssignments, teacherClassAssignments, studentUserLinks, attendanceRecords, exams, examClassScopes, examSchedules, examResults, staffUserLinks, salaryStructures, payrollRecords, expenseCategories, expenses, feeStructures, feePayments, staff,
  type User, type InsertUser, type School, type InsertSchool, type Document, type BackupRecord, type StudentDue,
  type AcademicSession, type InsertAcademicSession, type SchoolClass, type SchoolSection, type InsertClass, type InsertSection, type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
  type FeePayment, type InsertFeePayment, type Staff, type InsertStaff, type Subject, type TeacherSubjectAssignment, type TeacherClassAssignment, type StudentUserLink, type AttendanceRecord, type Exam, type ExamClassScope, type ExamSchedule,
  type InsertSubject, type InsertTeacherSubjectAssignment, type InsertTeacherClassAssignment, type InsertStudentUserLink, type InsertAttendance, type InsertExam, type InsertExamClassScope, type InsertExamSchedule, type ExamResult, type InsertExamResult, type StaffUserLink, type SalaryStructure, type PayrollRecord, type InsertStaffUserLink, type InsertSalaryStructure, type InsertPayroll, type ExpenseCategory, type Expense, type InsertExpenseCategory, type InsertExpense,
  type StoredStudentInsert, type StoredFeeStructureInsert, type StoredFeePaymentInsert, type StoredStaffInsert
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, or, sql } from "drizzle-orm";

export interface IStorage {
  // Users & Schools
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersBySchool(schoolId: number): Promise<User[]>;
  getDocuments(schoolId: number, sessionId?: number): Promise<Document[]>;
  getBackups(schoolId: number): Promise<BackupRecord[]>;
  getBackup(id: number, schoolId: number): Promise<BackupRecord | undefined>;
  createBackupRecord(input: Omit<BackupRecord, "id">): Promise<BackupRecord>;
  updateBackupRecord(id: number, schoolId: number, updates: Partial<BackupRecord>): Promise<BackupRecord | undefined>;
  deleteBackupRecord(id: number, schoolId: number): Promise<boolean>;
  createDocument(input: Omit<Document, "id" | "uploadedAt">): Promise<Document>;
  deactivateDocument(id: number, schoolId: number): Promise<Document | undefined>;
  importStudents(schoolId: number, sessionId: number, rows: Array<Record<string, unknown>>): Promise<{ created: Student[]; errors: Array<{ row: number; message: string }> }>;
  importStaff(schoolId: number, rows: Array<Record<string, unknown>>): Promise<{ created: Staff[]; errors: Array<{ row: number; message: string }> }>;
  createUser(user: InsertUser): Promise<User>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  // Academic sessions
  getActiveSession(schoolId: number): Promise<AcademicSession | undefined>;
  getAcademicSessions(schoolId: number): Promise<AcademicSession[]>;
  createAcademicSession(session: InsertAcademicSession & { schoolId: number }): Promise<AcademicSession>;
  updateAcademicSession(id: number, schoolId: number, updates: Partial<InsertAcademicSession>): Promise<AcademicSession | undefined>;
  activateAcademicSession(id: number, schoolId: number): Promise<AcademicSession | undefined>;
  getClasses(schoolId: number, sessionId: number): Promise<SchoolClass[]>;
  createClass(input: InsertClass & { schoolId: number; sessionId: number }): Promise<SchoolClass>;
  updateClass(id: number, schoolId: number, sessionId: number, updates: Partial<InsertClass>): Promise<SchoolClass | undefined>;
  getSections(schoolId: number, sessionId: number, classId?: number): Promise<SchoolSection[]>;
  createSection(input: InsertSection & { schoolId: number; sessionId: number; classId: number }): Promise<SchoolSection>;
  updateSection(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSection>): Promise<SchoolSection | undefined>;

  // Subjects and assignments
  getSubjects(schoolId: number, sessionId: number): Promise<Subject[]>;
  createSubject(subject: InsertSubject & { schoolId: number; sessionId: number }): Promise<Subject>;
  updateSubject(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSubject>): Promise<Subject | undefined>;
  deleteSubject(id: number, schoolId: number, sessionId: number): Promise<boolean>;
  getTeacherSubjectAssignments(schoolId: number, sessionId: number, teacherUserId?: number): Promise<TeacherSubjectAssignment[]>;
  createTeacherSubjectAssignment(assignment: InsertTeacherSubjectAssignment & { schoolId: number; sessionId: number }): Promise<TeacherSubjectAssignment | undefined>;
  deleteTeacherSubjectAssignment(id: number, schoolId: number, sessionId: number): Promise<boolean>;
  getTeacherClassAssignments(schoolId: number, sessionId: number, teacherUserId?: number): Promise<TeacherClassAssignment[]>;
  createTeacherClassAssignment(assignment: InsertTeacherClassAssignment & { schoolId: number; sessionId: number }): Promise<TeacherClassAssignment>;
  deleteTeacherClassAssignment(id: number, schoolId: number, sessionId: number): Promise<boolean>;
  createStudentUserLink(link: InsertStudentUserLink & { schoolId: number; sessionId: number }): Promise<StudentUserLink | undefined>;
  getStudentForUser(userId: number, schoolId: number, sessionId: number): Promise<Student | undefined>;

  // Exams
  getExams(schoolId: number, sessionId: number): Promise<Exam[]>;
  getExam(id: number, schoolId: number, sessionId: number): Promise<Exam | undefined>;
  getExamScopes(examId: number, schoolId: number, sessionId: number): Promise<ExamClassScope[]>;
  getExamSchedules(examId: number, schoolId: number, sessionId: number): Promise<ExamSchedule[]>;
  createExam(exam: InsertExam & { schoolId: number; sessionId: number }, scopes: InsertExamClassScope[]): Promise<{ exam: Exam; scopes: ExamClassScope[] }>;
  updateExam(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExam>): Promise<Exam | undefined>;
  setExamStatus(id: number, schoolId: number, sessionId: number, status: Exam["status"]): Promise<Exam | undefined>;
  createExamSchedule(schedule: InsertExamSchedule & { examId: number; schoolId: number; sessionId: number }): Promise<ExamSchedule>;
  updateExamSchedule(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExamSchedule>): Promise<ExamSchedule | undefined>;
  deleteExamSchedule(id: number, schoolId: number, sessionId: number): Promise<boolean>;

  // Exam results
  getExamResults(schoolId: number, sessionId: number, filters?: { examId?: number; scheduleId?: number; studentId?: number; status?: string }): Promise<ExamResult[]>;
  getExamResult(id: number, schoolId: number, sessionId: number): Promise<ExamResult | undefined>;
  createExamResultsBulk(records: Array<InsertExamResult & { examId: number; scheduleId: number; schoolId: number; sessionId: number; className: string; section: string }>): Promise<ExamResult[]>;
  updateExamResult(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExamResult>): Promise<ExamResult | undefined>;
  setExamResultsStatus(examId: number, schoolId: number, sessionId: number, status: ExamResult["status"]): Promise<number>;

  // Attendance
  getAttendance(schoolId: number, sessionId: number, filters?: { from?: string; to?: string; date?: string; className?: string; section?: string; subjectId?: number; studentId?: number }): Promise<AttendanceRecord[]>;
  createAttendanceBulk(records: Array<InsertAttendance & { schoolId: number; sessionId: number; markedByUserId: number }>): Promise<AttendanceRecord[]>;
  updateAttendance(id: number, schoolId: number, sessionId: number, status: InsertAttendance["status"]): Promise<AttendanceRecord | undefined>;

  // Students
  getStudent(id: number, schoolId: number): Promise<Student | undefined>;
  getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }, sessionId?: number): Promise<Student[]>;
  createStudent(student: StoredStudentInsert): Promise<Student>;
  updateStudent(id: number, schoolId: number, student: Partial<StoredStudentInsert>): Promise<Student>;
  deactivateStudent(id: number, schoolId: number): Promise<Student | undefined>;
  promoteStudents(studentIds: number[], schoolId: number, targetClass: string): Promise<void>;

  // Fees
  getStudentDues(schoolId: number, sessionId: number, studentId?: number): Promise<StudentDue[]>;
  createStudentDue(input: Omit<StudentDue, "id" | "createdAt">): Promise<StudentDue>;
  updateStudentDue(id: number, schoolId: number, sessionId: number, status: StudentDue["status"]): Promise<StudentDue | undefined>;
  getFeeStructures(schoolId: number, sessionId?: number): Promise<FeeStructure[]>;
  createFeeStructure(structure: StoredFeeStructureInsert): Promise<FeeStructure>;
  updateFeeStructure(id: number, schoolId: number, updates: Partial<StoredFeeStructureInsert>): Promise<FeeStructure | undefined>;
  deleteFeeStructure(id: number, schoolId: number): Promise<boolean>;
  getFeePayments(schoolId: number, studentId?: number, sessionId?: number): Promise<FeePayment[]>;
  createFeePayment(payment: StoredFeePaymentInsert): Promise<FeePayment>;
  createFeePaymentForSchool(payment: StoredFeePaymentInsert, schoolId: number): Promise<FeePayment | undefined>;
  getDefaulters(schoolId: number, classStr?: string, month?: string, year?: number): Promise<{ studentId: number, name: string, class: string, section: string, amountPaid: number, amountPending: number, month: string, year: number }[]>;

  // Payroll
  createStaffUserLink(link: InsertStaffUserLink & { schoolId: number }): Promise<StaffUserLink | undefined>;
  getStaffForUser(userId: number, schoolId: number): Promise<Staff | undefined>;
  getSalaryStructures(schoolId: number, sessionId: number, staffId?: number): Promise<SalaryStructure[]>;
  createSalaryStructure(structure: InsertSalaryStructure & { staffId: number; schoolId: number; sessionId: number }): Promise<SalaryStructure>;
  updateSalaryStructure(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSalaryStructure>): Promise<SalaryStructure | undefined>;
  setSalaryStructureActive(id: number, schoolId: number, sessionId: number, isActive: boolean): Promise<SalaryStructure | undefined>;
  getPayroll(schoolId: number, sessionId: number, filters?: { month?: number; year?: number; staffId?: number }): Promise<PayrollRecord[]>;
  getPayrollRecord(id: number, schoolId: number, sessionId: number): Promise<PayrollRecord | undefined>;
  createPayroll(payroll: InsertPayroll & { staffId: number; schoolId: number; sessionId: number; basicAmount?: number }): Promise<PayrollRecord>;
  updatePayroll(id: number, schoolId: number, sessionId: number, updates: Partial<InsertPayroll>): Promise<PayrollRecord | undefined>;
  setPayrollStatus(id: number, schoolId: number, sessionId: number, status: PayrollRecord["status"]): Promise<PayrollRecord | undefined>;

  // Financial management
  getExpenseCategories(schoolId: number): Promise<ExpenseCategory[]>;
  createExpenseCategory(category: InsertExpenseCategory & { schoolId: number }): Promise<ExpenseCategory>;
  updateExpenseCategory(id: number, schoolId: number, updates: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  getExpenses(schoolId: number, sessionId: number, filters?: { from?: string; to?: string; categoryId?: number }): Promise<Expense[]>;
  createExpense(expense: InsertExpense & { schoolId: number; sessionId: number; createdByUserId: number }): Promise<Expense>;
  updateExpense(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number, schoolId: number, sessionId: number): Promise<boolean>;
  setExpenseStatus(id: number, schoolId: number, sessionId: number, status: Expense["status"]): Promise<Expense | undefined>;
  getFinancialFeeIncome(schoolId: number, sessionId: number, filters?: { from?: string; to?: string }): Promise<FeePayment[]>;
  getPaidPayroll(schoolId: number, sessionId: number, filters?: { from?: string; to?: string }): Promise<PayrollRecord[]>;

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

  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.schoolId, schoolId));
  }

  async getDocuments(schoolId: number, sessionId?: number): Promise<Document[]> {
    const conditions = [eq(documents.schoolId, schoolId), eq(documents.isActive, true)];
    if (sessionId !== undefined) conditions.push(eq(documents.sessionId, sessionId));
    return db.select().from(documents).where(and(...conditions));
  }

  async getBackups(schoolId: number): Promise<BackupRecord[]> { return db.select().from(backupRecords).where(and(eq(backupRecords.schoolId, schoolId), sql`${backupRecords.status} <> 'deleted'`)).orderBy(sql`${backupRecords.createdAt} DESC`); }
  async getBackup(id: number, schoolId: number): Promise<BackupRecord | undefined> { const [value] = await db.select().from(backupRecords).where(and(eq(backupRecords.id, id), eq(backupRecords.schoolId, schoolId))); return value; }
  async createBackupRecord(input: Omit<BackupRecord, "id">): Promise<BackupRecord> { const [value] = await db.insert(backupRecords).values(input).returning(); return value; }
  async updateBackupRecord(id: number, schoolId: number, updates: Partial<BackupRecord>): Promise<BackupRecord | undefined> { const [value] = await db.update(backupRecords).set(updates).where(and(eq(backupRecords.id, id), eq(backupRecords.schoolId, schoolId))).returning(); return value; }
  async deleteBackupRecord(id: number, schoolId: number): Promise<boolean> { const result = await db.update(backupRecords).set({ status: "deleted" }).where(and(eq(backupRecords.id, id), eq(backupRecords.schoolId, schoolId))).returning({ id: backupRecords.id }); return result.length > 0; }

  async createDocument(input: Omit<Document, "id" | "uploadedAt">): Promise<Document> {
    const [document] = await db.insert(documents).values(input).returning();
    return document;
  }

  async deactivateDocument(id: number, schoolId: number): Promise<Document | undefined> {
    const [document] = await db.update(documents).set({ isActive: false }).where(and(eq(documents.id, id), eq(documents.schoolId, schoolId))).returning();
    return document;
  }

  async importStudents(schoolId: number, sessionId: number, rows: Array<Record<string, unknown>>) {
    return db.transaction(async (tx) => {
      const created: Student[] = []; const errors: Array<{ row: number; message: string }> = []; const admissions = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]; const admissionNo = String(r.admissionNo ?? "").trim();
        const name = String(r.name ?? "").trim(); const fatherName = String(r.fatherName ?? "").trim(); const className = String(r.class ?? "").trim(); const section = String(r.section ?? "").trim(); const contact = String(r.contact ?? "").trim();
        if (!admissionNo || !name || !fatherName || !className || !section || !contact) { errors.push({ row: i + 2, message: "admissionNo, name, fatherName, class, section and contact are required" }); continue; }
        if (admissions.has(admissionNo)) { errors.push({ row: i + 2, message: "duplicate admissionNo in import" }); continue; }
        const existing = await tx.select({ id: students.id }).from(students).where(and(eq(students.schoolId, schoolId), eq(students.sessionId, sessionId), eq(students.admissionNo, admissionNo))).limit(1);
        if (existing.length) { errors.push({ row: i + 2, message: "admissionNo already exists" }); continue; }
        admissions.add(admissionNo);
        const [student] = await tx.insert(students).values({ admissionNo, name, fatherName, motherName: r.motherName ? String(r.motherName) : null, class: className, section, rollNo: r.rollNo ? String(r.rollNo) : null, category: r.category ? String(r.category) : null, dob: r.dob ? String(r.dob) : null, contact, address: r.address ? String(r.address) : null, schoolId, sessionId }).returning(); created.push(student);
      }
      if (errors.length) throw new Error(JSON.stringify({ importErrors: errors }));
      return { created, errors };
    });
  }

  async importStaff(schoolId: number, rows: Array<Record<string, unknown>>) {
    return db.transaction(async (tx) => {
      const created: Staff[] = []; const errors: Array<{ row: number; message: string }> = [];
      for (let i = 0; i < rows.length; i++) { const r = rows[i]; const name=String(r.name ?? "").trim(); const designation=String(r.designation ?? "").trim(); const contact=String(r.contact ?? "").trim(); const basicSalary=Number(r.basicSalary); if (!name || !designation || !contact || !Number.isInteger(basicSalary) || basicSalary < 0) { errors.push({row:i+2,message:"name, designation, contact and non-negative integer basicSalary are required"}); continue; } const [value]=await tx.insert(staff).values({name,designation,contact,basicSalary,joinDate:r.joinDate ? String(r.joinDate) : null,schoolId}).returning(); created.push(value); }
      if (errors.length) throw new Error(JSON.stringify({ importErrors: errors })); return { created, errors };
    });
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

  async getAcademicSessions(schoolId: number): Promise<AcademicSession[]> {
    return db.select().from(academicSessions).where(eq(academicSessions.schoolId, schoolId)).orderBy(academicSessions.startDate);
  }

  async createAcademicSession(insertSession: InsertAcademicSession & { schoolId: number }): Promise<AcademicSession> {
    const [session] = await db.insert(academicSessions).values(insertSession).returning();
    return session;
  }

  async updateAcademicSession(id: number, schoolId: number, updates: Partial<InsertAcademicSession>): Promise<AcademicSession | undefined> {
    const [session] = await db.update(academicSessions).set({ ...updates, updatedAt: new Date() }).where(and(eq(academicSessions.id, id), eq(academicSessions.schoolId, schoolId))).returning();
    return session;
  }

  async activateAcademicSession(id: number, schoolId: number): Promise<AcademicSession | undefined> {
    return db.transaction(async (tx) => {
      await tx.update(academicSessions).set({ isActive: false, updatedAt: new Date() }).where(eq(academicSessions.schoolId, schoolId));
      const [session] = await tx.update(academicSessions).set({ isActive: true, updatedAt: new Date() }).where(and(eq(academicSessions.id, id), eq(academicSessions.schoolId, schoolId))).returning();
      return session;
    });
  }

  async getClasses(schoolId: number, sessionId: number): Promise<SchoolClass[]> {
    return db.select().from(schoolClasses).where(and(eq(schoolClasses.schoolId, schoolId), eq(schoolClasses.sessionId, sessionId))).orderBy(schoolClasses.displayOrder, schoolClasses.name);
  }
  async createClass(input: InsertClass & { schoolId: number; sessionId: number }): Promise<SchoolClass> {
    const [value] = await db.insert(schoolClasses).values(input).returning(); return value;
  }
  async updateClass(id: number, schoolId: number, sessionId: number, updates: Partial<InsertClass>): Promise<SchoolClass | undefined> {
    const [value] = await db.update(schoolClasses).set(updates).where(and(eq(schoolClasses.id, id), eq(schoolClasses.schoolId, schoolId), eq(schoolClasses.sessionId, sessionId))).returning(); return value;
  }
  async getSections(schoolId: number, sessionId: number, classId?: number): Promise<SchoolSection[]> {
    return db.select().from(schoolSections).where(and(eq(schoolSections.schoolId, schoolId), eq(schoolSections.sessionId, sessionId), ...(classId ? [eq(schoolSections.classId, classId)] : []))).orderBy(schoolSections.displayOrder, schoolSections.name);
  }
  async createSection(input: InsertSection & { schoolId: number; sessionId: number; classId: number }): Promise<SchoolSection> {
    const [value] = await db.insert(schoolSections).values(input).returning(); return value;
  }
  async updateSection(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSection>): Promise<SchoolSection | undefined> {
    const [value] = await db.update(schoolSections).set(updates).where(and(eq(schoolSections.id, id), eq(schoolSections.schoolId, schoolId), eq(schoolSections.sessionId, sessionId))).returning(); return value;
  }

  // === Subjects and assignments ===
  async getSubjects(schoolId: number, sessionId: number): Promise<Subject[]> {
    return db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.sessionId, sessionId)));
  }

  async createSubject(insertSubject: InsertSubject & { schoolId: number; sessionId: number }): Promise<Subject> {
    const [subject] = await db.insert(subjects).values(insertSubject).returning();
    return subject;
  }

  async updateSubject(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSubject>): Promise<Subject | undefined> {
    const [subject] = await db.update(subjects).set({ ...updates, updatedAt: new Date() }).where(and(
      eq(subjects.id, id), eq(subjects.schoolId, schoolId), eq(subjects.sessionId, sessionId),
    )).returning();
    return subject;
  }

  async deleteSubject(id: number, schoolId: number, sessionId: number): Promise<boolean> {
    const assignment = await db.select({ id: teacherSubjectAssignments.id }).from(teacherSubjectAssignments).where(and(
      eq(teacherSubjectAssignments.subjectId, id), eq(teacherSubjectAssignments.schoolId, schoolId), eq(teacherSubjectAssignments.sessionId, sessionId),
    )).limit(1);
    if (assignment.length > 0) return false;
    const deleted = await db.delete(subjects).where(and(
      eq(subjects.id, id), eq(subjects.schoolId, schoolId), eq(subjects.sessionId, sessionId),
    )).returning({ id: subjects.id });
    return deleted.length > 0;
  }

  async getTeacherSubjectAssignments(schoolId: number, sessionId: number, teacherUserId?: number): Promise<TeacherSubjectAssignment[]> {
    const conditions = [eq(teacherSubjectAssignments.schoolId, schoolId), eq(teacherSubjectAssignments.sessionId, sessionId)];
    if (teacherUserId !== undefined) conditions.push(eq(teacherSubjectAssignments.teacherUserId, teacherUserId));
    return db.select().from(teacherSubjectAssignments).where(and(...conditions));
  }

  async createTeacherSubjectAssignment(insertAssignment: InsertTeacherSubjectAssignment & { schoolId: number; sessionId: number }): Promise<TeacherSubjectAssignment | undefined> {
    const [teacher] = await db.select({ id: users.id, role: users.role, schoolId: users.schoolId }).from(users).where(and(
      eq(users.id, insertAssignment.teacherUserId), eq(users.schoolId, insertAssignment.schoolId), eq(users.role, "teacher"),
    ));
    if (!teacher) return undefined;
    const [subject] = await db.select({ id: subjects.id }).from(subjects).where(and(
      eq(subjects.id, insertAssignment.subjectId), eq(subjects.schoolId, insertAssignment.schoolId), eq(subjects.sessionId, insertAssignment.sessionId),
    ));
    if (!subject) return undefined;
    const [assignment] = await db.insert(teacherSubjectAssignments).values(insertAssignment).returning();
    return assignment;
  }

  async deleteTeacherSubjectAssignment(id: number, schoolId: number, sessionId: number): Promise<boolean> {
    const deleted = await db.delete(teacherSubjectAssignments).where(and(
      eq(teacherSubjectAssignments.id, id), eq(teacherSubjectAssignments.schoolId, schoolId), eq(teacherSubjectAssignments.sessionId, sessionId),
    )).returning({ id: teacherSubjectAssignments.id });
    return deleted.length > 0;
  }

  async getTeacherClassAssignments(schoolId: number, sessionId: number, teacherUserId?: number): Promise<TeacherClassAssignment[]> {
    const conditions = [eq(teacherClassAssignments.schoolId, schoolId), eq(teacherClassAssignments.sessionId, sessionId)];
    if (teacherUserId !== undefined) conditions.push(eq(teacherClassAssignments.teacherUserId, teacherUserId));
    return db.select().from(teacherClassAssignments).where(and(...conditions));
  }

  async createTeacherClassAssignment(insertAssignment: InsertTeacherClassAssignment & { schoolId: number; sessionId: number }): Promise<TeacherClassAssignment> {
    const [teacher] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, insertAssignment.teacherUserId), eq(users.schoolId, insertAssignment.schoolId), eq(users.role, "teacher"),
    ));
    if (!teacher) throw new Error("Teacher user not found in this school");
    const [assignment] = await db.insert(teacherClassAssignments).values(insertAssignment).returning();
    return assignment;
  }

  async deleteTeacherClassAssignment(id: number, schoolId: number, sessionId: number): Promise<boolean> {
    const deleted = await db.delete(teacherClassAssignments).where(and(
      eq(teacherClassAssignments.id, id), eq(teacherClassAssignments.schoolId, schoolId), eq(teacherClassAssignments.sessionId, sessionId),
    )).returning({ id: teacherClassAssignments.id });
    return deleted.length > 0;
  }

  async createStudentUserLink(insertLink: InsertStudentUserLink & { schoolId: number; sessionId: number }): Promise<StudentUserLink | undefined> {
    const [student] = await db.select({ id: students.id }).from(students).where(and(
      eq(students.id, insertLink.studentId), eq(students.schoolId, insertLink.schoolId), eq(students.sessionId, insertLink.sessionId),
    ));
    const [user] = await db.select({ id: users.id }).from(users).where(and(
      eq(users.id, insertLink.userId), eq(users.schoolId, insertLink.schoolId), eq(users.role, "student"),
    ));
    if (!student || !user) return undefined;
    const [link] = await db.insert(studentUserLinks).values(insertLink).returning();
    return link;
  }

  async getStudentForUser(userId: number, schoolId: number, sessionId: number): Promise<Student | undefined> {
    const [row] = await db.select({ student: students }).from(studentUserLinks).innerJoin(students, eq(studentUserLinks.studentId, students.id)).where(and(
      eq(studentUserLinks.userId, userId), eq(studentUserLinks.schoolId, schoolId), eq(studentUserLinks.sessionId, sessionId),
      eq(students.schoolId, schoolId), eq(students.sessionId, sessionId), eq(students.isActive, true),
    ));
    return row?.student;
  }

  // === Exams ===
  async getExams(schoolId: number, sessionId: number): Promise<Exam[]> {
    return db.select().from(exams).where(and(eq(exams.schoolId, schoolId), eq(exams.sessionId, sessionId))).orderBy(exams.startDate);
  }

  async getExam(id: number, schoolId: number, sessionId: number): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(and(eq(exams.id, id), eq(exams.schoolId, schoolId), eq(exams.sessionId, sessionId)));
    return exam;
  }

  async getExamScopes(examId: number, schoolId: number, sessionId: number): Promise<ExamClassScope[]> {
    return db.select().from(examClassScopes).where(and(eq(examClassScopes.examId, examId), eq(examClassScopes.schoolId, schoolId), eq(examClassScopes.sessionId, sessionId)));
  }

  async getExamSchedules(examId: number, schoolId: number, sessionId: number): Promise<ExamSchedule[]> {
    return db.select().from(examSchedules).where(and(eq(examSchedules.examId, examId), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId)));
  }

  async createExam(insertExam: InsertExam & { schoolId: number; sessionId: number }, scopes: InsertExamClassScope[]): Promise<{ exam: Exam; scopes: ExamClassScope[] }> {
    if (insertExam.endDate < insertExam.startDate) throw new Error("Exam end date must not precede start date");
    return db.transaction(async (transaction) => {
      const [exam] = await transaction.insert(exams).values(insertExam).returning();
      const createdScopes = await transaction.insert(examClassScopes).values(scopes.map((scope) => ({ ...scope, examId: exam.id, schoolId: insertExam.schoolId, sessionId: insertExam.sessionId }))).returning();
      return { exam, scopes: createdScopes };
    });
  }

  async updateExam(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExam>): Promise<Exam | undefined> {
    const existing = await this.getExam(id, schoolId, sessionId);
    if (!existing) return undefined;
    if (existing.status !== "draft") throw new Error("Only draft exams can be edited");
    const startDate = updates.startDate ?? existing.startDate;
    const endDate = updates.endDate ?? existing.endDate;
    if (endDate < startDate) throw new Error("Exam end date must not precede start date");
    const [updated] = await db.update(exams).set({ ...updates, updatedAt: new Date() }).where(and(eq(exams.id, id), eq(exams.schoolId, schoolId), eq(exams.sessionId, sessionId))).returning();
    return updated;
  }

  async setExamStatus(id: number, schoolId: number, sessionId: number, status: Exam["status"]): Promise<Exam | undefined> {
    const existing = await this.getExam(id, schoolId, sessionId);
    if (!existing) return undefined;
    const allowed: Record<string, string[]> = { draft: ["published", "archived"], published: ["draft", "completed", "archived"], completed: ["archived"], archived: [] };
    if (!allowed[existing.status]?.includes(status)) throw new Error(`Invalid exam status transition from ${existing.status} to ${status}`);
    const [updated] = await db.update(exams).set({ status, isActive: status !== "archived", updatedAt: new Date() }).where(and(eq(exams.id, id), eq(exams.schoolId, schoolId), eq(exams.sessionId, sessionId))).returning();
    return updated;
  }

  async createExamSchedule(insertSchedule: InsertExamSchedule & { examId: number; schoolId: number; sessionId: number }): Promise<ExamSchedule> {
    const exam = await this.getExam(insertSchedule.examId, insertSchedule.schoolId, insertSchedule.sessionId);
    if (!exam) throw new Error("Exam not found");
    if (exam.status !== "draft") throw new Error("Only draft exams can be scheduled");
    if (insertSchedule.examDate < exam.startDate || insertSchedule.examDate > exam.endDate) throw new Error("Exam date must be inside exam date range");
    const scope = await db.select({ id: examClassScopes.id }).from(examClassScopes).where(and(eq(examClassScopes.examId, insertSchedule.examId), eq(examClassScopes.schoolId, insertSchedule.schoolId), eq(examClassScopes.sessionId, insertSchedule.sessionId), eq(examClassScopes.className, insertSchedule.className), eq(examClassScopes.section, insertSchedule.section)));
    if (!scope.length) throw new Error("Class/section is not assigned to this exam");
    const [schedule] = await db.insert(examSchedules).values(insertSchedule).returning();
    return schedule;
  }

  async updateExamSchedule(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExamSchedule>): Promise<ExamSchedule | undefined> {
    const [existing] = await db.select().from(examSchedules).where(and(eq(examSchedules.id, id), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId)));
    if (!existing) return undefined;
    const exam = await this.getExam(existing.examId, schoolId, sessionId);
    if (!exam || exam.status !== "draft") throw new Error("Only draft exam schedules can be edited");
    const examDate = updates.examDate ?? existing.examDate;
    if (examDate < exam.startDate || examDate > exam.endDate) throw new Error("Exam date must be inside exam date range");
    const [updated] = await db.update(examSchedules).set(updates).where(and(eq(examSchedules.id, id), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId))).returning();
    return updated;
  }

  async deleteExamSchedule(id: number, schoolId: number, sessionId: number): Promise<boolean> {
    const [existing] = await db.select().from(examSchedules).where(and(eq(examSchedules.id, id), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId)));
    if (!existing) return false;
    const exam = await this.getExam(existing.examId, schoolId, sessionId);
    if (!exam || exam.status !== "draft") throw new Error("Only draft exam schedules can be removed");
    const deleted = await db.delete(examSchedules).where(and(eq(examSchedules.id, id), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId))).returning({ id: examSchedules.id });
    return deleted.length > 0;
  }

  // === Exam results ===
  async getExamResults(schoolId: number, sessionId: number, filters: { examId?: number; scheduleId?: number; studentId?: number; status?: string } = {}): Promise<ExamResult[]> {
    const conditions = [eq(examResults.schoolId, schoolId), eq(examResults.sessionId, sessionId)];
    if (filters.examId !== undefined) conditions.push(eq(examResults.examId, filters.examId));
    if (filters.scheduleId !== undefined) conditions.push(eq(examResults.scheduleId, filters.scheduleId));
    if (filters.studentId !== undefined) conditions.push(eq(examResults.studentId, filters.studentId));
    if (filters.status) conditions.push(eq(examResults.status, filters.status));
    return db.select().from(examResults).where(and(...conditions)).orderBy(examResults.studentId);
  }

  async getExamResult(id: number, schoolId: number, sessionId: number): Promise<ExamResult | undefined> {
    const [result] = await db.select().from(examResults).where(and(eq(examResults.id, id), eq(examResults.schoolId, schoolId), eq(examResults.sessionId, sessionId)));
    return result;
  }

  async createExamResultsBulk(records: Array<InsertExamResult & { examId: number; scheduleId: number; schoolId: number; sessionId: number; className: string; section: string }>): Promise<ExamResult[]> {
    const keys = new Set<string>();
    for (const record of records) {
      const key = `${record.scheduleId}|${record.studentId}|${record.schoolId}|${record.sessionId}`;
      if (keys.has(key)) throw new Error("Duplicate result in request");
      keys.add(key);
      const [schedule] = await db.select().from(examSchedules).where(and(eq(examSchedules.id, record.scheduleId), eq(examSchedules.examId, record.examId), eq(examSchedules.schoolId, record.schoolId), eq(examSchedules.sessionId, record.sessionId), eq(examSchedules.className, record.className ?? ""), eq(examSchedules.section, record.section ?? "")));
      if (!schedule) throw new Error("Exam schedule is outside the requested scope");
      const exam = await this.getExam(record.examId, record.schoolId, record.sessionId);
      if (!exam || exam.status === "completed" || exam.status === "archived") throw new Error("Exam is not editable");
      const student = await this.getStudent(record.studentId, record.schoolId);
      if (!student || student.sessionId !== record.sessionId || !student.isActive || student.class !== record.className || student.section !== record.section) throw new Error("Student is outside the result scope");
      if (record.isAbsent) { record.obtainedMarks = null; }
      else if (record.obtainedMarks === null || record.obtainedMarks === undefined) throw new Error("Obtained marks are required unless the student is absent");
      else if (record.obtainedMarks > schedule.maxMarks) throw new Error("Obtained marks exceed maximum marks");
    }
    return db.transaction(async (transaction) => {
      const created: ExamResult[] = [];
      for (const record of records) { const { className: _className, section: _section, ...values } = record; const [result] = await transaction.insert(examResults).values(values).returning(); created.push(result); }
      return created;
    });
  }

  async updateExamResult(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExamResult>): Promise<ExamResult | undefined> {
    const existing = await this.getExamResult(id, schoolId, sessionId);
    if (!existing) return undefined;
    if (existing.status !== "draft") throw new Error("Unpublish the result before editing");
    const schedule = await db.select().from(examSchedules).where(and(eq(examSchedules.id, existing.scheduleId), eq(examSchedules.schoolId, schoolId), eq(examSchedules.sessionId, sessionId))).then(rows => rows[0]);
    const exam = await this.getExam(existing.examId, schoolId, sessionId);
    if (!schedule || !exam || exam.status === "completed" || exam.status === "archived") throw new Error("Exam is not editable");
    const absent = updates.isAbsent ?? existing.isAbsent;
    const marks = absent ? null : (updates.obtainedMarks ?? existing.obtainedMarks);
    if (!absent && (marks === null || marks === undefined)) throw new Error("Obtained marks are required unless the student is absent");
    if (marks !== null && marks !== undefined && marks > schedule.maxMarks) throw new Error("Obtained marks exceed maximum marks");
    const [updated] = await db.update(examResults).set({ ...updates, obtainedMarks: marks, isAbsent: absent, updatedAt: new Date() }).where(and(eq(examResults.id, id), eq(examResults.schoolId, schoolId), eq(examResults.sessionId, sessionId))).returning();
    return updated;
  }

  async setExamResultsStatus(examId: number, schoolId: number, sessionId: number, status: ExamResult["status"]): Promise<number> {
    const updated = await db.update(examResults).set({ status, updatedAt: new Date() }).where(and(eq(examResults.examId, examId), eq(examResults.schoolId, schoolId), eq(examResults.sessionId, sessionId))).returning({ id: examResults.id });
    return updated.length;
  }

  // === Attendance ===
  async getAttendance(schoolId: number, sessionId: number, filters: { from?: string; to?: string; date?: string; className?: string; section?: string; subjectId?: number; studentId?: number } = {}): Promise<AttendanceRecord[]> {
    const conditions = [eq(attendanceRecords.schoolId, schoolId), eq(attendanceRecords.sessionId, sessionId)];
    if (filters.from) conditions.push(sql`${attendanceRecords.attendanceDate} >= ${filters.from}`);
    if (filters.to) conditions.push(sql`${attendanceRecords.attendanceDate} <= ${filters.to}`);
    if (filters.date) conditions.push(eq(attendanceRecords.attendanceDate, filters.date));
    if (filters.className && filters.className !== "all") conditions.push(eq(attendanceRecords.className, filters.className));
    if (filters.section && filters.section !== "all") conditions.push(eq(attendanceRecords.section, filters.section));
    if (filters.subjectId !== undefined) conditions.push(eq(attendanceRecords.subjectId, filters.subjectId));
    if (filters.studentId !== undefined) conditions.push(eq(attendanceRecords.studentId, filters.studentId));
    return db.select().from(attendanceRecords).where(and(...conditions)).orderBy(attendanceRecords.attendanceDate, attendanceRecords.studentId);
  }

  async createAttendanceBulk(records: Array<InsertAttendance & { schoolId: number; sessionId: number; markedByUserId: number }>): Promise<AttendanceRecord[]> {
    const keys = new Set<string>();
    for (const record of records) {
      const key = `${record.schoolId}|${record.sessionId}|${record.attendanceDate}|${record.studentId}|${record.subjectId ?? "daily"}`;
      if (keys.has(key)) throw new Error("Duplicate attendance student in request");
      keys.add(key);
      const student = await this.getStudent(record.studentId, record.schoolId);
      if (!student || student.sessionId !== record.sessionId || student.class !== record.className || student.section !== record.section || !student.isActive) {
        throw new Error("Student is outside the attendance scope");
      }
    }
    return db.transaction(async (transaction) => {
      const created: AttendanceRecord[] = [];
      for (const record of records) {
        const [attendance] = await transaction.insert(attendanceRecords).values(record).returning();
        created.push(attendance);
      }
      return created;
    });
  }

  async updateAttendance(id: number, schoolId: number, sessionId: number, status: InsertAttendance["status"]): Promise<AttendanceRecord | undefined> {
    const [updated] = await db.update(attendanceRecords).set({ status, updatedAt: new Date() }).where(and(
      eq(attendanceRecords.id, id), eq(attendanceRecords.schoolId, schoolId), eq(attendanceRecords.sessionId, sessionId),
    )).returning();
    return updated;
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
      .set({ class: targetClass, isPromoted: true, updatedAt: new Date() })
      .where(and(eq(students.schoolId, schoolId), sql`${students.id} IN ${studentIds}`));
  }

  // === Fees ===
  async getStudentDues(schoolId: number, sessionId: number, studentId?: number): Promise<StudentDue[]> { const conditions=[eq(studentDues.schoolId,schoolId),eq(studentDues.sessionId,sessionId)]; if(studentId!==undefined)conditions.push(eq(studentDues.studentId,studentId)); return db.select().from(studentDues).where(and(...conditions)); }
  async createStudentDue(input: Omit<StudentDue, "id" | "createdAt">): Promise<StudentDue> { const [value]=await db.insert(studentDues).values(input).returning(); return value; }
  async updateStudentDue(id:number, schoolId:number, sessionId:number, status:StudentDue["status"]):Promise<StudentDue|undefined>{const [value]=await db.update(studentDues).set({status}).where(and(eq(studentDues.id,id),eq(studentDues.schoolId,schoolId),eq(studentDues.sessionId,sessionId))).returning();return value;}

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

  // === Payroll ===
  async createStaffUserLink(insertLink: InsertStaffUserLink & { schoolId: number }): Promise<StaffUserLink | undefined> {
    const [staffMember] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, insertLink.staffId), eq(staff.schoolId, insertLink.schoolId)));
    const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.id, insertLink.userId), eq(users.schoolId, insertLink.schoolId)));
    if (!staffMember || !user || !["staff", "teacher"].includes(user.role)) return undefined;
    const [link] = await db.insert(staffUserLinks).values(insertLink).returning();
    return link;
  }

  async getStaffForUser(userId: number, schoolId: number): Promise<Staff | undefined> {
    const [row] = await db.select({ staff }).from(staffUserLinks).innerJoin(staff, and(eq(staffUserLinks.staffId, staff.id), eq(staffUserLinks.schoolId, staff.schoolId))).where(and(eq(staffUserLinks.userId, userId), eq(staffUserLinks.schoolId, schoolId)));
    return row?.staff;
  }

  async getSalaryStructures(schoolId: number, sessionId: number, staffId?: number): Promise<SalaryStructure[]> {
    const conditions = [eq(salaryStructures.schoolId, schoolId), eq(salaryStructures.sessionId, sessionId)];
    if (staffId !== undefined) conditions.push(eq(salaryStructures.staffId, staffId));
    return db.select().from(salaryStructures).where(and(...conditions));
  }

  async createSalaryStructure(insertStructure: InsertSalaryStructure & { staffId: number; schoolId: number; sessionId: number }): Promise<SalaryStructure> {
    const [staffMember] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, insertStructure.staffId), eq(staff.schoolId, insertStructure.schoolId)));
    if (!staffMember) throw new Error("Staff member not found in this school");
    const [structure] = await db.insert(salaryStructures).values(insertStructure).returning();
    return structure;
  }

  async updateSalaryStructure(id: number, schoolId: number, sessionId: number, updates: Partial<InsertSalaryStructure>): Promise<SalaryStructure | undefined> {
    const [structure] = await db.update(salaryStructures).set({ ...updates, updatedAt: new Date() }).where(and(eq(salaryStructures.id, id), eq(salaryStructures.schoolId, schoolId), eq(salaryStructures.sessionId, sessionId))).returning();
    return structure;
  }

  async setSalaryStructureActive(id: number, schoolId: number, sessionId: number, isActive: boolean): Promise<SalaryStructure | undefined> {
    const [structure] = await db.update(salaryStructures).set({ isActive, updatedAt: new Date() }).where(and(eq(salaryStructures.id, id), eq(salaryStructures.schoolId, schoolId), eq(salaryStructures.sessionId, sessionId))).returning();
    return structure;
  }

  async getPayroll(schoolId: number, sessionId: number, filters: { month?: number; year?: number; staffId?: number } = {}): Promise<PayrollRecord[]> {
    const conditions = [eq(payrollRecords.schoolId, schoolId), eq(payrollRecords.sessionId, sessionId)];
    if (filters.month !== undefined) conditions.push(eq(payrollRecords.payrollMonth, filters.month));
    if (filters.year !== undefined) conditions.push(eq(payrollRecords.payrollYear, filters.year));
    if (filters.staffId !== undefined) conditions.push(eq(payrollRecords.staffId, filters.staffId));
    return db.select().from(payrollRecords).where(and(...conditions));
  }

  async getPayrollRecord(id: number, schoolId: number, sessionId: number): Promise<PayrollRecord | undefined> {
    const [record] = await db.select().from(payrollRecords).where(and(eq(payrollRecords.id, id), eq(payrollRecords.schoolId, schoolId), eq(payrollRecords.sessionId, sessionId)));
    return record;
  }

  async createPayroll(insertPayroll: InsertPayroll & { staffId: number; schoolId: number; sessionId: number; basicAmount?: number }): Promise<PayrollRecord> {
    const [structure] = await db.select().from(salaryStructures).where(and(eq(salaryStructures.staffId, insertPayroll.staffId), eq(salaryStructures.schoolId, insertPayroll.schoolId), eq(salaryStructures.sessionId, insertPayroll.sessionId), eq(salaryStructures.isActive, true))).orderBy(sql`${salaryStructures.effectiveDate} DESC`).limit(1);
    if (!structure) throw new Error("No active salary structure for staff member");
    if (insertPayroll.advanceDeduction > structure.advanceOutstanding) throw new Error("Advance deduction exceeds outstanding advance");
    const basicAmount = structure.basicSalary;
    const netSalary = basicAmount + insertPayroll.allowances - insertPayroll.deductions - insertPayroll.advanceDeduction;
    if (netSalary < 0) throw new Error("Deductions cannot exceed salary");
    const [record] = await db.insert(payrollRecords).values({ ...insertPayroll, basicAmount, netSalary, status: "draft" }).returning();
    return record;
  }

  async updatePayroll(id: number, schoolId: number, sessionId: number, updates: Partial<InsertPayroll>): Promise<PayrollRecord | undefined> {
    const existing = await this.getPayrollRecord(id, schoolId, sessionId);
    if (!existing) return undefined;
    if (existing.status !== "draft") throw new Error("Only draft payroll can be edited");
    const allowances = updates.allowances ?? existing.allowances;
    const deductions = updates.deductions ?? existing.deductions;
    const advanceDeduction = updates.advanceDeduction ?? existing.advanceDeduction;
    if (allowances < 0 || deductions < 0 || advanceDeduction < 0) throw new Error("Salary amounts cannot be negative");
    const netSalary = existing.basicAmount + allowances - deductions - advanceDeduction;
    if (netSalary < 0) throw new Error("Deductions cannot exceed salary");
    const [updated] = await db.update(payrollRecords).set({ ...updates, basicAmount: existing.basicAmount, netSalary, updatedAt: new Date() }).where(and(eq(payrollRecords.id, id), eq(payrollRecords.schoolId, schoolId), eq(payrollRecords.sessionId, sessionId))).returning();
    return updated;
  }

  async setPayrollStatus(id: number, schoolId: number, sessionId: number, status: PayrollRecord["status"]): Promise<PayrollRecord | undefined> {
    const existing = await this.getPayrollRecord(id, schoolId, sessionId);
    if (!existing) return undefined;
    const allowed: Record<string, string[]> = { draft: ["finalized"], finalized: ["paid"], paid: [] };
    if (!allowed[existing.status]?.includes(status)) throw new Error(`Invalid payroll status transition from ${existing.status} to ${status}`);
    const [updated] = await db.update(payrollRecords).set({ status, paymentDate: status === "paid" ? new Date() : existing.paymentDate, updatedAt: new Date() }).where(and(eq(payrollRecords.id, id), eq(payrollRecords.schoolId, schoolId), eq(payrollRecords.sessionId, sessionId))).returning();
    return updated;
  }

  // === Financial management ===
  async getExpenseCategories(schoolId: number): Promise<ExpenseCategory[]> {
    return db.select().from(expenseCategories).where(eq(expenseCategories.schoolId, schoolId));
  }
  async createExpenseCategory(insertCategory: InsertExpenseCategory & { schoolId: number }): Promise<ExpenseCategory> {
    const [category] = await db.insert(expenseCategories).values(insertCategory).returning(); return category;
  }
  async updateExpenseCategory(id: number, schoolId: number, updates: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const [category] = await db.update(expenseCategories).set(updates).where(and(eq(expenseCategories.id, id), eq(expenseCategories.schoolId, schoolId))).returning(); return category;
  }
  async getExpenses(schoolId: number, sessionId: number, filters: { from?: string; to?: string; categoryId?: number } = {}): Promise<Expense[]> {
    const conditions = [eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId)];
    if (filters.from) conditions.push(sql`${expenses.expenseDate} >= ${filters.from}`);
    if (filters.to) conditions.push(sql`${expenses.expenseDate} <= ${filters.to}`);
    if (filters.categoryId !== undefined) conditions.push(eq(expenses.categoryId, filters.categoryId));
    return db.select().from(expenses).where(and(...conditions)).orderBy(expenses.expenseDate);
  }
  async createExpense(insertExpense: InsertExpense & { schoolId: number; sessionId: number; createdByUserId: number }): Promise<Expense> {
    const [category] = await db.select({ id: expenseCategories.id }).from(expenseCategories).where(and(eq(expenseCategories.id, insertExpense.categoryId), eq(expenseCategories.schoolId, insertExpense.schoolId), eq(expenseCategories.isActive, true)));
    if (!category) throw new Error("Expense category not found in this school");
    const [expense] = await db.insert(expenses).values({ ...insertExpense, status: "draft" }).returning(); return expense;
  }
  async updateExpense(id: number, schoolId: number, sessionId: number, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId)));
    if (!existing) return undefined; if (existing.status !== "draft") throw new Error("Finalized expense cannot be edited");
    if (updates.categoryId !== undefined) { const [category] = await db.select({ id: expenseCategories.id }).from(expenseCategories).where(and(eq(expenseCategories.id, updates.categoryId), eq(expenseCategories.schoolId, schoolId), eq(expenseCategories.isActive, true))); if (!category) throw new Error("Expense category not found in this school"); }
    const [updated] = await db.update(expenses).set({ ...updates, updatedAt: new Date() }).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId))).returning(); return updated;
  }
  async deleteExpense(id: number, schoolId: number, sessionId: number): Promise<boolean> {
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId)));
    if (!existing) return false; if (existing.status !== "draft") throw new Error("Finalized expense cannot be deleted");
    const deleted = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId))).returning({ id: expenses.id }); return deleted.length > 0;
  }
  async setExpenseStatus(id: number, schoolId: number, sessionId: number, status: Expense["status"]): Promise<Expense | undefined> {
    const [existing] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId)));
    if (!existing) return undefined;
    if (existing.status === "finalized" && status !== "finalized") throw new Error("Finalized expense cannot be reopened");
    const [updated] = await db.update(expenses).set({ status, updatedAt: new Date() }).where(and(eq(expenses.id, id), eq(expenses.schoolId, schoolId), eq(expenses.sessionId, sessionId))).returning(); return updated;
  }
  async getFinancialFeeIncome(schoolId: number, sessionId: number, filters: { from?: string; to?: string } = {}): Promise<FeePayment[]> {
    const conditions = [eq(feePayments.schoolId, schoolId), eq(feePayments.sessionId, sessionId)];
    if (filters.from) conditions.push(sql`${feePayments.paymentDate} >= ${filters.from}`);
    if (filters.to) conditions.push(sql`${feePayments.paymentDate} <= ${filters.to}::date + interval '1 day'`);
    return db.select().from(feePayments).where(and(...conditions));
  }
  async getPaidPayroll(schoolId: number, sessionId: number, filters: { from?: string; to?: string } = {}): Promise<PayrollRecord[]> {
    const conditions = [eq(payrollRecords.schoolId, schoolId), eq(payrollRecords.sessionId, sessionId), eq(payrollRecords.status, "paid")];
    if (filters.from) conditions.push(sql`${payrollRecords.paymentDate} >= ${filters.from}`);
    if (filters.to) conditions.push(sql`${payrollRecords.paymentDate} <= ${filters.to}::date + interval '1 day'`);
    return db.select().from(payrollRecords).where(and(...conditions));
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
