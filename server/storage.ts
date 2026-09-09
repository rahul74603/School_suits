
import { 
  users, schools, academicSessions, students, subjects, teacherSubjectAssignments, teacherClassAssignments, studentUserLinks, attendanceRecords, exams, examClassScopes, examSchedules, examResults, feeStructures, feePayments, staff,
  type User, type InsertUser, type School, type InsertSchool,
  type AcademicSession, type InsertAcademicSession, type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
  type FeePayment, type InsertFeePayment, type Staff, type InsertStaff, type Subject, type TeacherSubjectAssignment, type TeacherClassAssignment, type StudentUserLink, type AttendanceRecord, type Exam, type ExamClassScope, type ExamSchedule,
  type InsertSubject, type InsertTeacherSubjectAssignment, type InsertTeacherClassAssignment, type InsertStudentUserLink, type InsertAttendance, type InsertExam, type InsertExamClassScope, type InsertExamSchedule, type ExamResult, type InsertExamResult,
  type StoredStudentInsert, type StoredFeeStructureInsert, type StoredFeePaymentInsert, type StoredStaffInsert
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
