import { pgTable, text, serial, integer, boolean, timestamp, date, index, uniqueIndex, check, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// === Schools Profile (For White-labeling) ===
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"),
  contact: text("contact").notNull(),
  boardAffiliation: text("board_affiliation").default("MP Board (MPBSE)").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Academic Sessions ===
export const academicSessions = pgTable("academic_sessions", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idSchoolUnique: uniqueIndex("academic_sessions_id_school_unique").on(table.id, table.schoolId),
  schoolNameUnique: uniqueIndex("academic_sessions_school_name_unique").on(table.schoolId, table.name),
  activeSchoolUnique: uniqueIndex("academic_sessions_one_active_per_school").on(table.schoolId).where(sql`${table.isActive} = true`),
  schoolActiveIndex: index("academic_sessions_school_active_idx").on(table.schoolId, table.isActive),
  dateOrderCheck: check("academic_sessions_date_order_check", sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`),
}));

// === Classes and sections ===
export const schoolClasses = pgTable("school_classes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  nameUnique: uniqueIndex("school_classes_scope_name_unique").on(table.schoolId, table.sessionId, table.name),
  idScopeUnique: uniqueIndex("school_classes_id_scope_unique").on(table.id, table.schoolId, table.sessionId),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "school_classes_session_school_fk" }),
}));

export const schoolSections = pgTable("school_sections", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  nameUnique: uniqueIndex("school_sections_class_name_unique").on(table.classId, table.schoolId, table.sessionId, table.name),
  idScopeUnique: uniqueIndex("school_sections_id_scope_unique").on(table.id, table.classId, table.schoolId, table.sessionId),
  classScopeForeignKey: foreignKey({ columns: [table.classId, table.schoolId, table.sessionId], foreignColumns: [schoolClasses.id, schoolClasses.schoolId, schoolClasses.sessionId], name: "school_sections_class_scope_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "school_sections_session_school_fk" }),
}));

// === Users (Admin/Staff Login) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"),
  name: text("name").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }),
}, (table) => ({
  idSchoolUnique: uniqueIndex("users_id_school_unique").on(table.id, table.schoolId),
}));

// === Subjects ===
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  code: text("code"),
  stream: text("stream").default("All"),
  subjectType: text("subject_type").default("core").notNull(),
  applicableClasses: text("applicable_classes").default("All").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolSessionNameUnique: uniqueIndex("subjects_school_session_name_unique").on(table.schoolId, table.sessionId, table.name),
  schoolSessionCodeUnique: uniqueIndex("subjects_school_session_code_unique").on(table.schoolId, table.sessionId, table.code),
  idSchoolSessionUnique: uniqueIndex("subjects_id_school_session_unique").on(table.id, table.schoolId, table.sessionId),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "subjects_session_school_fk",
  }),
}));

// === Higher Secondary Streams (PCM, PCB, Commerce, Arts, Agriculture, etc.) ===
export const academicStreams = pgTable("academic_streams", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  boardPattern: text("board_pattern").default("MPBSE").notNull(),
  applicableClasses: text("applicable_classes").default("11,12").notNull(),
  compulsorySubjects: text("compulsory_subjects").default("").notNull(),
  coreSubjects: text("core_subjects").default("").notNull(),
  electiveOptions: text("elective_options").default("").notNull(),
  maxElectives: integer("max_electives").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  schoolSessionCodeUnique: uniqueIndex("academic_streams_school_session_code_unique").on(table.schoolId, table.sessionId, table.code),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "academic_streams_session_school_fk",
  }),
}));

// === Transport / Bus Routes ===
export const transportRoutes = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  routeName: text("route_name").notNull(),
  amount: integer("amount").notNull(),
  vehicleNo: text("vehicle_no"),
  driverName: text("driver_name"),
  driverContact: text("driver_contact"),
  stops: text("stops"),
  capacity: integer("capacity").default(40),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolNameUnique: uniqueIndex("transport_routes_school_name_unique").on(table.schoolId, table.routeName),
  idSchoolUnique: uniqueIndex("transport_routes_id_school_unique").on(table.id, table.schoolId),
  schoolActiveIndex: index("transport_routes_school_active_idx").on(table.schoolId, table.isActive),
  amountCheck: check("transport_routes_amount_positive", sql`${table.amount} > 0`),
}));

// === Students Master ===
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  admissionNo: text("admission_no").notNull(),
  name: text("name").notNull(),
  fatherName: text("father_name").notNull(),
  motherName: text("mother_name"),
  class: text("class").notNull(),
  section: text("section").notNull(),
  rollNo: text("roll_no"),
  aadhaar: text("aadhaar"),
  birthCertificateNo: text("birth_certificate_no"),
  previousSchoolName: text("previous_school_name"),
  previousClass: text("previous_class"),
  tcNumber: text("tc_number"),
  tcIssueDate: date("tc_issue_date"),
  tcSubmitted: boolean("tc_submitted").default(false).notNull(),
  reportCardSubmitted: boolean("report_card_submitted").default(false).notNull(),
  category: text("category"),
  dob: date("dob"),
  contact: text("contact").notNull(),
  address: text("address"),
  photo: text("photo"),
  gender: text("gender"),
  bloodGroup: text("blood_group"),
  religion: text("religion"),
  nationality: text("nationality").default("Indian"),
  motherTongue: text("mother_tongue"),
  medium: text("medium").default("Hindi"),
  admissionDate: date("admission_date"),
  admissionType: text("admission_type").default("new"),
  samagraId: text("samagra_id"),
  penNumber: text("pen_number"),
  apaarId: text("apaar_id"),
  fatherOccupation: text("father_occupation"),
  motherOccupation: text("mother_occupation"),
  annualIncome: integer("annual_income"),
  alternateContact: text("alternate_contact"),
  parentEmail: text("parent_email"),
  bankAccountNo: text("bank_account_no"),
  bankIfsc: text("bank_ifsc"),
  bankName: text("bank_name"),
  rteAdmission: boolean("rte_admission").default(false).notNull(),
  cwsnStatus: text("cwsn_status").default("No"),
  previousSchoolUdise: text("previous_school_udise"),
  previousSchoolBoard: text("previous_school_board"),
  previousSchoolAddress: text("previous_school_address"),
  previousSchoolState: text("previous_school_state"),
  previousSchoolDistrict: text("previous_school_district"),
  previousPassingYear: text("previous_passing_year"),
  previousPercentage: text("previous_percentage"),
  migrationCertificateNo: text("migration_certificate_no"),
  migrationIssueDate: date("migration_issue_date"),
  deoCountersigned: boolean("deo_countersigned").default(false).notNull(),
  leavingReason: text("leaving_reason"),
  previousConduct: text("previous_conduct").default("Good"),
  birthCertificateSubmitted: boolean("birth_certificate_submitted").default(false).notNull(),
  aadhaarSubmitted: boolean("aadhaar_submitted").default(false).notNull(),
  casteCertificateSubmitted: boolean("caste_certificate_submitted").default(false).notNull(),
  migrationSubmitted: boolean("migration_submitted").default(false).notNull(),
  photoSubmitted: boolean("photo_submitted").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isPromoted: boolean("is_promoted").default(false).notNull(),
  stream: text("stream"),
  streamId: integer("stream_id"),
  electedSubjects: text("elected_subjects"),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  transportId: integer("transport_id"),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idSchoolUnique: uniqueIndex("students_id_school_unique").on(table.id, table.schoolId),
  admissionUnique: uniqueIndex("students_school_session_admission_unique").on(table.schoolId, table.sessionId, table.admissionNo),
  schoolSessionClassIndex: index("students_school_session_class_idx").on(table.schoolId, table.sessionId, table.class, table.section),
  admissionLookupIndex: index("students_admission_lookup_idx").on(table.schoolId, table.admissionNo),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "students_session_school_fk",
  }),
}));

// === Teacher/Class/Subject assignments ===
export const teacherSubjectAssignments = pgTable("teacher_subject_assignments", {
  id: serial("id").primaryKey(),
  teacherUserId: integer("teacher_user_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  assignmentUnique: uniqueIndex("teacher_subject_assignments_unique").on(table.teacherUserId, table.subjectId, table.schoolId, table.sessionId),
  teacherSchoolForeignKey: foreignKey({
    columns: [table.teacherUserId, table.schoolId],
    foreignColumns: [users.id, users.schoolId],
    name: "teacher_subject_assignments_teacher_school_fk",
  }),
  subjectSchoolSessionForeignKey: foreignKey({
    columns: [table.subjectId, table.schoolId, table.sessionId],
    foreignColumns: [subjects.id, subjects.schoolId, subjects.sessionId],
    name: "teacher_subject_assignments_subject_scope_fk",
  }),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "teacher_subject_assignments_session_school_fk",
  }),
}));

export const teacherClassAssignments = pgTable("teacher_class_assignments", {
  id: serial("id").primaryKey(),
  teacherUserId: integer("teacher_user_id").notNull(),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  assignmentUnique: uniqueIndex("teacher_class_assignments_unique").on(table.teacherUserId, table.className, table.section, table.schoolId, table.sessionId),
  teacherSchoolForeignKey: foreignKey({
    columns: [table.teacherUserId, table.schoolId],
    foreignColumns: [users.id, users.schoolId],
    name: "teacher_class_assignments_teacher_school_fk",
  }),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "teacher_class_assignments_session_school_fk",
  }),
}));

// === Student login ownership ===
export const studentUserLinks = pgTable("student_user_links", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  userId: integer("user_id").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  linkUnique: uniqueIndex("student_user_links_unique").on(table.studentId, table.userId, table.schoolId, table.sessionId),
  studentSchoolForeignKey: foreignKey({
    columns: [table.studentId, table.schoolId],
    foreignColumns: [students.id, students.schoolId],
    name: "student_user_links_student_school_fk",
  }),
  userSchoolForeignKey: foreignKey({
    columns: [table.userId, table.schoolId],
    foreignColumns: [users.id, users.schoolId],
    name: "student_user_links_user_school_fk",
  }),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "student_user_links_session_school_fk",
  }),
}));

// === Attendance ===
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  attendanceDate: date("attendance_date").notNull(),
  subjectId: integer("subject_id"),
  status: text("status").notNull(),
  markedByUserId: integer("marked_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolDateClassIndex: index("attendance_school_date_class_idx").on(table.schoolId, table.sessionId, table.attendanceDate, table.className, table.section),
  studentHistoryIndex: index("attendance_student_history_idx").on(table.schoolId, table.sessionId, table.studentId, table.attendanceDate),
  subjectHistoryIndex: index("attendance_subject_history_idx").on(table.schoolId, table.sessionId, table.subjectId, table.attendanceDate),
  subjectUnique: uniqueIndex("attendance_student_subject_unique").on(table.schoolId, table.sessionId, table.attendanceDate, table.studentId, table.subjectId).where(sql`${table.subjectId} IS NOT NULL`),
  dailyUnique: uniqueIndex("attendance_student_daily_unique").on(table.schoolId, table.sessionId, table.attendanceDate, table.studentId).where(sql`${table.subjectId} IS NULL`),
  statusCheck: check("attendance_status_valid", sql`${table.status} IN ('present', 'absent', 'late', 'leave')`),
  studentScopeForeignKey: foreignKey({
    columns: [table.studentId, table.schoolId],
    foreignColumns: [students.id, students.schoolId],
    name: "attendance_student_school_fk",
  }),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "attendance_session_school_fk",
  }),
  subjectScopeForeignKey: foreignKey({
    columns: [table.subjectId, table.schoolId, table.sessionId],
    foreignColumns: [subjects.id, subjects.schoolId, subjects.sessionId],
    name: "attendance_subject_scope_fk",
  }),
  markerSchoolForeignKey: foreignKey({
    columns: [table.markedByUserId, table.schoolId],
    foreignColumns: [users.id, users.schoolId],
    name: "attendance_marker_school_fk",
  }),
}));

// === Exams ===
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  examType: text("exam_type").notNull().default("general"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("draft"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolSessionNameUnique: uniqueIndex("exams_school_session_name_unique").on(table.schoolId, table.sessionId, table.name),
  idScopeUnique: uniqueIndex("exams_id_scope_unique").on(table.id, table.schoolId, table.sessionId),
  schoolSessionIndex: index("exams_school_session_idx").on(table.schoolId, table.sessionId, table.status, table.startDate),
  dateOrderCheck: check("exams_date_order_valid", sql`${table.endDate} >= ${table.startDate}`),
  statusCheck: check("exams_status_valid", sql`${table.status} IN ('draft', 'published', 'completed', 'archived')`),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "exams_session_school_fk" }),
}));

export const examClassScopes = pgTable("exam_class_scopes", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
}, (table) => ({
  scopeUnique: uniqueIndex("exam_class_scopes_unique").on(table.examId, table.schoolId, table.sessionId, table.className, table.section),
  examScopeForeignKey: foreignKey({ columns: [table.examId, table.schoolId, table.sessionId], foreignColumns: [exams.id, exams.schoolId, exams.sessionId], name: "exam_class_scopes_exam_scope_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "exam_class_scopes_session_school_fk" }),
}));

export const examSchedules = pgTable("exam_schedules", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  subjectId: integer("subject_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  examDate: date("exam_date").notNull(),
  maxMarks: integer("max_marks").notNull(),
  passingMarks: integer("passing_marks").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
}, (table) => ({
  scheduleUnique: uniqueIndex("exam_schedules_unique").on(table.examId, table.subjectId, table.schoolId, table.sessionId, table.className, table.section),
  idScopeUnique: uniqueIndex("exam_schedules_id_scope_unique").on(table.id, table.examId, table.schoolId, table.sessionId),
  marksCheck: check("exam_schedules_marks_valid", sql`${table.maxMarks} > 0 AND ${table.passingMarks} >= 0 AND ${table.passingMarks} <= ${table.maxMarks}`),
  examClassScopeForeignKey: foreignKey({ columns: [table.examId, table.schoolId, table.sessionId, table.className, table.section], foreignColumns: [examClassScopes.examId, examClassScopes.schoolId, examClassScopes.sessionId, examClassScopes.className, examClassScopes.section], name: "exam_schedules_class_scope_fk" }),
  examScopeForeignKey: foreignKey({ columns: [table.examId, table.schoolId, table.sessionId], foreignColumns: [exams.id, exams.schoolId, exams.sessionId], name: "exam_schedules_exam_scope_fk" }),
  subjectScopeForeignKey: foreignKey({ columns: [table.subjectId, table.schoolId, table.sessionId], foreignColumns: [subjects.id, subjects.schoolId, subjects.sessionId], name: "exam_schedules_subject_scope_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "exam_schedules_session_school_fk" }),
}));

// === Exam Results / Marks ===
export const examResults = pgTable("exam_results", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  scheduleId: integer("schedule_id").notNull(),
  studentId: integer("student_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  obtainedMarks: integer("obtained_marks"),
  isAbsent: boolean("is_absent").default(false).notNull(),
  remarks: text("remarks"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  resultUnique: uniqueIndex("exam_results_schedule_student_unique").on(table.scheduleId, table.studentId, table.schoolId, table.sessionId),
  studentIndex: index("exam_results_student_idx").on(table.schoolId, table.sessionId, table.studentId, table.examId),
  examIndex: index("exam_results_exam_idx").on(table.schoolId, table.sessionId, table.examId, table.scheduleId),
  statusCheck: check("exam_results_status_valid", sql`${table.status} IN ('draft', 'published')`),
  marksCheck: check("exam_results_marks_valid", sql`(${table.isAbsent} = true AND ${table.obtainedMarks} IS NULL) OR (${table.isAbsent} = false AND ${table.obtainedMarks} IS NOT NULL AND ${table.obtainedMarks} >= 0)`),
  examScopeForeignKey: foreignKey({ columns: [table.examId, table.schoolId, table.sessionId], foreignColumns: [exams.id, exams.schoolId, exams.sessionId], name: "exam_results_exam_scope_fk" }),
  scheduleScopeForeignKey: foreignKey({ columns: [table.scheduleId, table.examId, table.schoolId, table.sessionId], foreignColumns: [examSchedules.id, examSchedules.examId, examSchedules.schoolId, examSchedules.sessionId], name: "exam_results_schedule_scope_fk" }),
  studentScopeForeignKey: foreignKey({ columns: [table.studentId, table.schoolId], foreignColumns: [students.id, students.schoolId], name: "exam_results_student_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "exam_results_session_school_fk" }),
}));

// === Fee Structure ===
export const feeStructures = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  class: text("class").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  admissionFee: integer("admission_fee").default(0).notNull(),
  examFee: integer("exam_fee").default(0).notNull(),
  otherFee: integer("other_fee").default(0).notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolSessionClassUnique: uniqueIndex("fee_structures_school_session_class_unique").on(table.schoolId, table.sessionId, table.class),
  lookupIndex: index("fee_structures_school_session_class_idx").on(table.schoolId, table.sessionId, table.class),
  amountsCheck: check("fee_structures_amounts_nonnegative", sql`${table.monthlyFee} >= 0 AND ${table.admissionFee} >= 0 AND ${table.examFee} >= 0 AND ${table.otherFee} >= 0`),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "fee_structures_session_school_fk",
  }),
}));

// === Fee Payments ===
export const feePayments = pgTable("fee_payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id, { onDelete: "restrict" }).notNull(),
  amount: integer("amount").notNull(),
  month: text("month"),
  year: integer("year").notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  receiptNo: text("receipt_no").notNull(),
  remarks: text("remarks"),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  receiptUnique: uniqueIndex("fee_payments_school_receipt_unique").on(table.schoolId, table.receiptNo),
  studentPeriodIndex: index("fee_payments_student_period_idx").on(table.studentId, table.sessionId, table.year, table.month),
  schoolPeriodIndex: index("fee_payments_school_period_idx").on(table.schoolId, table.sessionId, table.paymentDate),
  amountCheck: check("fee_payments_amount_positive", sql`${table.amount} > 0`),
  yearCheck: check("fee_payments_year_valid", sql`${table.year} BETWEEN 1900 AND 2200`),
  sessionSchoolForeignKey: foreignKey({
    columns: [table.sessionId, table.schoolId],
    foreignColumns: [academicSessions.id, academicSessions.schoolId],
    name: "fee_payments_session_school_fk",
  }),
  studentSchoolForeignKey: foreignKey({
    columns: [table.studentId, table.schoolId],
    foreignColumns: [students.id, students.schoolId],
    name: "fee_payments_student_school_fk",
  }),
}));

// === Student dues (obligations, not payments) ===
export const studentDues = pgTable("student_dues", {
  id: serial("id").primaryKey(), studentId: integer("student_id").notNull(), schoolId: integer("school_id").notNull(), sessionId: integer("session_id").notNull(), description: text("description").notNull(), amount: integer("amount").notNull(), dueDate: date("due_date"), status: text("status").notNull().default("open"), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  studentSchoolForeignKey: foreignKey({ columns: [table.studentId, table.schoolId], foreignColumns: [students.id, students.schoolId], name: "student_dues_student_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "student_dues_session_school_fk" }),
  scopeIndex: index("student_dues_school_session_student_idx").on(table.schoolId, table.sessionId, table.studentId),
  amountCheck: check("student_dues_amount_positive", sql`${table.amount} > 0`),
  statusCheck: check("student_dues_status_check", sql`${table.status} IN ('open', 'settled', 'void')`),
}));

// === Staff/Teachers ===
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id"),
  name: text("name").notNull(),
  designation: text("designation").notNull(),
  qualification: text("qualification"),
  email: text("email"),
  department: text("department"),
  address: text("address"),
  basicSalary: integer("basic_salary").notNull(),
  advance: integer("advance").notNull().default(0),
  contact: text("contact").notNull(),
  joinDate: date("join_date"),
  isActive: boolean("is_active").notNull().default(true),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  idSchoolUnique: uniqueIndex("staff_id_school_unique").on(table.id, table.schoolId),
  schoolIndex: index("staff_school_idx").on(table.schoolId),
  salaryCheck: check("staff_basic_salary_nonnegative", sql`${table.basicSalary} >= 0`),
}));

// === Staff users and payroll ===
export const staffUserLinks = pgTable("staff_user_links", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  userId: integer("user_id").notNull(),
  schoolId: integer("school_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  staffUnique: uniqueIndex("staff_user_links_staff_unique").on(table.staffId, table.schoolId),
  userUnique: uniqueIndex("staff_user_links_user_unique").on(table.userId, table.schoolId),
  staffSchoolForeignKey: foreignKey({ columns: [table.staffId, table.schoolId], foreignColumns: [staff.id, staff.schoolId], name: "staff_user_links_staff_school_fk" }),
  userSchoolForeignKey: foreignKey({ columns: [table.userId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "staff_user_links_user_school_fk" }),
}));

export const salaryStructures = pgTable("salary_structures", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  basicSalary: integer("basic_salary").notNull(),
  allowances: integer("allowances").notNull().default(0),
  deductions: integer("deductions").notNull().default(0),
  advanceOutstanding: integer("advance_outstanding").notNull().default(0),
  effectiveDate: date("effective_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  staffSessionIndex: index("salary_structures_staff_session_idx").on(table.schoolId, table.sessionId, table.staffId),
  amountsCheck: check("salary_structures_amounts_nonnegative", sql`${table.basicSalary} >= 0 AND ${table.allowances} >= 0 AND ${table.deductions} >= 0 AND ${table.advanceOutstanding} >= 0`),
  staffSchoolForeignKey: foreignKey({ columns: [table.staffId, table.schoolId], foreignColumns: [staff.id, staff.schoolId], name: "salary_structures_staff_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "salary_structures_session_school_fk" }),
}));

export const payrollRecords = pgTable("payroll_records", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  payrollMonth: integer("payroll_month").notNull(),
  payrollYear: integer("payroll_year").notNull(),
  basicAmount: integer("basic_amount").notNull(),
  allowances: integer("allowances").notNull(),
  deductions: integer("deductions").notNull(),
  advanceDeduction: integer("advance_deduction").notNull().default(0),
  netSalary: integer("net_salary").notNull(),
  status: text("status").notNull().default("draft"),
  paymentDate: timestamp("payment_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  staffMonthUnique: uniqueIndex("payroll_staff_month_unique").on(table.staffId, table.schoolId, table.sessionId, table.payrollMonth, table.payrollYear),
  schoolMonthIndex: index("payroll_school_month_idx").on(table.schoolId, table.sessionId, table.payrollYear, table.payrollMonth),
  amountsCheck: check("payroll_amounts_nonnegative", sql`${table.basicAmount} >= 0 AND ${table.allowances} >= 0 AND ${table.deductions} >= 0 AND ${table.advanceDeduction} >= 0 AND ${table.netSalary} >= 0`),
  monthYearCheck: check("payroll_month_year_valid", sql`${table.payrollMonth} BETWEEN 1 AND 12 AND ${table.payrollYear} BETWEEN 1900 AND 2200`),
  statusCheck: check("payroll_status_valid", sql`${table.status} IN ('draft', 'finalized', 'paid')`),
  staffSchoolForeignKey: foreignKey({ columns: [table.staffId, table.schoolId], foreignColumns: [staff.id, staff.schoolId], name: "payroll_staff_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "payroll_session_school_fk" }),
}));

// === Financial management ===
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  schoolNameUnique: uniqueIndex("expense_categories_school_name_unique").on(table.schoolId, table.name),
  idSchoolUnique: uniqueIndex("expense_categories_id_school_unique").on(table.id, table.schoolId),
  schoolForeignKey: foreignKey({ columns: [table.schoolId], foreignColumns: [schools.id], name: "expense_categories_school_fk" }),
}));

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull(),
  sessionId: integer("session_id").notNull(),
  categoryId: integer("category_id").notNull(),
  description: text("description").notNull(),
  amount: integer("amount").notNull(),
  expenseDate: date("expense_date").notNull(),
  paymentReference: text("payment_reference"),
  status: text("status").notNull().default("draft"),
  createdByUserId: integer("created_by_user_id").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  dateIndex: index("expenses_school_session_date_idx").on(table.schoolId, table.sessionId, table.expenseDate),
  categoryIndex: index("expenses_category_idx").on(table.schoolId, table.sessionId, table.categoryId),
  amountCheck: check("expenses_amount_positive", sql`${table.amount} > 0`),
  statusCheck: check("expenses_status_valid", sql`${table.status} IN ('draft', 'finalized')`),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "expenses_session_school_fk" }),
  categorySchoolForeignKey: foreignKey({ columns: [table.categoryId, table.schoolId], foreignColumns: [expenseCategories.id, expenseCategories.schoolId], name: "expenses_category_school_fk" }),
  creatorSchoolForeignKey: foreignKey({ columns: [table.createdByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "expenses_creator_school_fk" }),
}));

// === Documents metadata (binary storage is intentionally abstracted) ===
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }),
  ownerType: text("owner_type").notNull(),
  ownerId: integer("owner_id"),
  documentType: text("document_type").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  fileData: text("file_data"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  remarks: text("remarks"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewedAt: timestamp("reviewed_at"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedByUserId: integer("uploaded_by_user_id").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  schoolOwnerIndex: index("documents_school_owner_idx").on(table.schoolId, table.ownerType, table.ownerId),
  sessionIndex: index("documents_school_session_idx").on(table.schoolId, table.sessionId),
  ownerTypeCheck: check("documents_owner_type_check", sql`${table.ownerType} IN ('student', 'staff', 'school')`),
  sizeCheck: check("documents_size_positive", sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 10485760`),
  uploaderSchoolForeignKey: foreignKey({ columns: [table.uploadedByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "documents_uploader_school_fk" }),
}));

// === Database backups ===
export const backupRecords = pgTable("backup_records", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  backupType: text("backup_type").notNull().default("postgres-custom"),
  status: text("status").notNull().default("pending"),
  sizeBytes: integer("size_bytes"),
  storageKey: text("storage_key").notNull(),
  restoreStatus: text("restore_status"),
  restoreStartedAt: timestamp("restore_started_at"),
  restoreCompletedAt: timestamp("restore_completed_at"),
  errorMessage: text("error_message"),
}, (table) => ({
  schoolCreatedIndex: index("backup_records_school_created_idx").on(table.schoolId, table.createdAt),
  creatorSchoolForeignKey: foreignKey({ columns: [table.createdByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "backup_records_creator_school_fk" }),
  typeCheck: check("backup_records_type_check", sql`${table.backupType} = 'postgres-custom'`),
  statusCheck: check("backup_records_status_check", sql`${table.status} IN ('pending', 'completed', 'failed', 'deleted')`),
}));

// === Security audit events ===
export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(), schoolId: integer("school_id"), sessionId: integer("session_id"), actorUserId: integer("actor_user_id"), actorRole: text("actor_role"), action: text("action").notNull(), targetType: text("target_type"), targetId: integer("target_id"), metadata: text("metadata"), createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  schoolCreatedIndex: index("audit_events_school_created_idx").on(table.schoolId, table.createdAt),
  actorIndex: index("audit_events_actor_idx").on(table.actorUserId, table.createdAt),
  actionIndex: index("audit_events_action_idx").on(table.schoolId, table.action, table.createdAt),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "audit_events_session_school_fk" }),
  actorSchoolForeignKey: foreignKey({ columns: [table.actorUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "audit_events_actor_school_fk" }),
}));

// === Notice Board & Circulars ===
export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").references(() => academicSessions.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  targetAudience: text("target_audience").notNull().default("all"),
  targetClass: text("target_class"),
  targetSection: text("target_section"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  publishDate: date("publish_date").notNull(),
  createdByUserId: integer("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  schoolActiveIdx: index("notices_school_active_idx").on(table.schoolId, table.isActive, table.isPinned, table.publishDate),
  categoryCheck: check("notices_category_check", sql`${table.category} IN ('general', 'academic', 'exam', 'holiday', 'event', 'emergency')`),
  audienceCheck: check("notices_audience_check", sql`${table.targetAudience} IN ('all', 'students', 'teachers', 'staff', 'class')`),
  creatorSchoolForeignKey: foreignKey({ columns: [table.createdByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "notices_creator_school_fk" }),
}));

// === Homework & Daily Class Diary ===
export const homeworkAssignments = pgTable("homework_assignments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  subjectId: integer("subject_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  assignedDate: date("assigned_date").notNull(),
  dueDate: date("due_date").notNull(),
  assignedByUserId: integer("assigned_by_user_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  classDueIdx: index("homework_class_due_idx").on(table.schoolId, table.sessionId, table.className, table.section, table.dueDate),
  statusCheck: check("homework_status_check", sql`${table.status} IN ('active', 'archived')`),
  dateCheck: check("homework_date_order_check", sql`${table.dueDate} >= ${table.assignedDate}`),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "homework_session_school_fk" }),
  subjectScopeForeignKey: foreignKey({ columns: [table.subjectId, table.schoolId, table.sessionId], foreignColumns: [subjects.id, subjects.schoolId, subjects.sessionId], name: "homework_subject_scope_fk" }),
  teacherSchoolForeignKey: foreignKey({ columns: [table.assignedByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "homework_teacher_school_fk" }),
}));

// === Class Timetable / Routine ===
export const timetableEntries = pgTable("timetable_entries", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  className: text("class_name").notNull(),
  section: text("section").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  periodNo: integer("period_no").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  subjectId: integer("subject_id").notNull(),
  teacherUserId: integer("teacher_user_id"),
  roomNo: text("room_no"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slotUnique: uniqueIndex("timetable_class_slot_unique").on(table.schoolId, table.sessionId, table.className, table.section, table.dayOfWeek, table.periodNo),
  dayCheck: check("timetable_day_check", sql`${table.dayOfWeek} IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')`),
  periodCheck: check("timetable_period_check", sql`${table.periodNo} BETWEEN 1 AND 12`),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "timetable_session_school_fk" }),
  subjectScopeForeignKey: foreignKey({ columns: [table.subjectId, table.schoolId, table.sessionId], foreignColumns: [subjects.id, subjects.schoolId, subjects.sessionId], name: "timetable_subject_scope_fk" }),
}));

// === Leave Requests (Student & Staff) ===
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  applicantType: text("applicant_type").notNull(),
  studentId: integer("student_id"),
  userId: integer("user_id").notNull(),
  applicantName: text("applicant_name").notNull(),
  className: text("class_name"),
  section: text("section"),
  leaveType: text("leave_type").notNull().default("sick"),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  reviewRemarks: text("review_remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolSessionIdx: index("leave_requests_school_session_idx").on(table.schoolId, table.sessionId, table.status, table.fromDate),
  applicantTypeCheck: check("leave_requests_applicant_type_check", sql`${table.applicantType} IN ('student', 'staff')`),
  statusCheck: check("leave_requests_status_check", sql`${table.status} IN ('pending', 'approved', 'rejected')`),
  dateCheck: check("leave_requests_date_order_check", sql`${table.toDate} >= ${table.fromDate}`),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "leave_requests_session_school_fk" }),
  userSchoolForeignKey: foreignKey({ columns: [table.userId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "leave_requests_user_school_fk" }),
}));

// === Certificates (Transfer Certificate / Bonafide / Character) ===
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  studentId: integer("student_id").notNull(),
  certificateType: text("certificate_type").notNull(),
  certificateNo: text("certificate_no").notNull(),
  issueDate: date("issue_date").notNull(),
  reason: text("reason"),
  conduct: text("conduct").default("Good"),
  remarks: text("remarks"),
  promotedToClass: text("promoted_to_class"),
  duesStatus: text("dues_status").default("No Dues Pending"),
  lastAttendanceDate: date("last_attendance_date"),
  customBody: text("custom_body"),
  issuedByUserId: integer("issued_by_user_id").notNull(),
  status: text("status").notNull().default("issued"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  certNoUnique: uniqueIndex("certificates_school_cert_no_unique").on(table.schoolId, table.certificateNo),
  studentIdx: index("certificates_school_student_idx").on(table.schoolId, table.sessionId, table.studentId),
  typeCheck: check("certificates_type_check", sql`${table.certificateType} IN ('transfer', 'bonafide', 'character', 'fee', 'dob', 'migration', 'passing', 'sports')`),
  statusCheck: check("certificates_status_check", sql`${table.status} IN ('issued', 'revoked')`),
  studentSchoolForeignKey: foreignKey({ columns: [table.studentId, table.schoolId], foreignColumns: [students.id, students.schoolId], name: "certificates_student_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "certificates_session_school_fk" }),
  issuerSchoolForeignKey: foreignKey({ columns: [table.issuedByUserId, table.schoolId], foreignColumns: [users.id, users.schoolId], name: "certificates_issuer_school_fk" }),
}));

// === Student Transport Allocations ===
export const studentTransportAllocations = pgTable("student_transport_allocations", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  sessionId: integer("session_id").notNull().references(() => academicSessions.id, { onDelete: "restrict" }),
  studentId: integer("student_id").notNull(),
  routeId: integer("route_id").notNull(),
  stopName: text("stop_name").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  studentActiveUnique: uniqueIndex("student_transport_student_session_unique").on(table.schoolId, table.sessionId, table.studentId),
  routeForeignKey: foreignKey({ columns: [table.routeId, table.schoolId], foreignColumns: [transportRoutes.id, transportRoutes.schoolId], name: "student_transport_route_school_fk" }),
  studentSchoolForeignKey: foreignKey({ columns: [table.studentId, table.schoolId], foreignColumns: [students.id, students.schoolId], name: "student_transport_student_school_fk" }),
  sessionSchoolForeignKey: foreignKey({ columns: [table.sessionId, table.schoolId], foreignColumns: [academicSessions.id, academicSessions.schoolId], name: "student_transport_session_school_fk" }),
}));

// === Relations ===
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  sessions: many(academicSessions),
  students: many(students),
  staff: many(staff),
}));

export const academicSessionsRelations = relations(academicSessions, ({ one, many }) => ({
  school: one(schools, { fields: [academicSessions.schoolId], references: [schools.id] }),
  students: many(students),
  feeStructures: many(feeStructures),
  payments: many(feePayments),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  session: one(academicSessions, { fields: [students.sessionId], references: [academicSessions.id] }),
  transport: one(transportRoutes, { fields: [students.transportId, students.schoolId], references: [transportRoutes.id, transportRoutes.schoolId] }),
  payments: many(feePayments),
}));

export const transportRoutesRelations = relations(transportRoutes, ({ one, many }) => ({
  school: one(schools, { fields: [transportRoutes.schoolId], references: [schools.id] }),
  students: many(students),
}));

export const feeStructuresRelations = relations(feeStructures, ({ one }) => ({
  school: one(schools, { fields: [feeStructures.schoolId], references: [schools.id] }),
  session: one(academicSessions, { fields: [feeStructures.sessionId], references: [academicSessions.id] }),
}));

export const feePaymentsRelations = relations(feePayments, ({ one }) => ({
  student: one(students, { fields: [feePayments.studentId], references: [students.id] }),
  school: one(schools, { fields: [feePayments.schoolId], references: [schools.id] }),
  session: one(academicSessions, { fields: [feePayments.sessionId], references: [academicSessions.id] }),
}));

// === Zod Schemas ===
export const insertClassSchema = createInsertSchema(schoolClasses).omit({ id: true, schoolId: true, sessionId: true }).extend({ name: z.string().trim().min(1).max(100), displayOrder: z.number().int().optional() });
export const insertSectionSchema = createInsertSchema(schoolSections).omit({ id: true, classId: true, schoolId: true, sessionId: true }).extend({ name: z.string().trim().min(1).max(50), displayOrder: z.number().int().optional() });
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true });
export const insertAcademicSessionSchema = createInsertSchema(academicSessions).omit({ id: true, createdAt: true, updatedAt: true, schoolId: true }).extend({
  name: z.string().trim().min(1).max(100),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, isActive: true, sessionId: true, schoolId: true, createdAt: true, updatedAt: true }).extend({
  admissionNo: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1),
  fatherName: z.string().trim().min(1),
});
export const insertTransportRouteSchema = createInsertSchema(transportRoutes).omit({
  id: true,
  schoolId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  routeName: z.string().trim().min(1).max(150),
  amount: z.number().int().positive().optional(),
  monthlyFee: z.number().int().nonnegative().optional(),
  vehicleNo: z.string().trim().max(50).nullable().optional(),
  driverName: z.string().trim().max(120).nullable().optional(),
  driverContact: z.string().trim().max(30).nullable().optional(),
  stops: z.string().trim().max(1000).nullable().optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const insertFeeStructureSchema = createInsertSchema(feeStructures).omit({ id: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  monthlyFee: z.number().int().nonnegative(),
  admissionFee: z.number().int().nonnegative().optional(),
  examFee: z.number().int().nonnegative().optional(),
  otherFee: z.number().int().nonnegative().optional(),
});
export const insertFeePaymentSchema = createInsertSchema(feePayments).omit({ id: true, paymentDate: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  amount: z.number().int().positive(),
  year: z.number().int().min(1900).max(2200),
  receiptNo: z.string().trim().min(1).max(100),
});
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true, schoolId: true, createdAt: true }).extend({ name: z.string().trim().min(1).max(100) });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, schoolId: true, sessionId: true, createdByUserId: true, status: true, createdAt: true, updatedAt: true }).extend({ description: z.string().trim().min(1).max(200), amount: z.number().int().positive(), expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), remarks: z.string().max(500).nullable().optional(), paymentReference: z.string().max(100).nullable().optional() });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, schoolId: true, createdAt: true, updatedAt: true }).extend({
  basicSalary: z.number().int().nonnegative(),
  name: z.string().trim().min(1),
});
export const insertStaffUserLinkSchema = createInsertSchema(staffUserLinks).omit({ id: true, schoolId: true, createdAt: true });
export const insertSalaryStructureSchema = createInsertSchema(salaryStructures).omit({ id: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  basicSalary: z.number().int().nonnegative(), allowances: z.number().int().nonnegative(), deductions: z.number().int().nonnegative(), advanceOutstanding: z.number().int().nonnegative(),
});
export const insertPayrollSchema = createInsertSchema(payrollRecords).omit({ id: true, schoolId: true, sessionId: true, basicAmount: true, netSalary: true, status: true, paymentDate: true, createdAt: true, updatedAt: true }).extend({
  payrollMonth: z.number().int().min(1).max(12), payrollYear: z.number().int().min(1900).max(2200), allowances: z.number().int().nonnegative(), deductions: z.number().int().nonnegative(), advanceDeduction: z.number().int().nonnegative(), remarks: z.string().max(500).nullable().optional(),
});
export const attendanceStatusSchema = z.enum(["present", "absent", "late", "leave"]);
export const examStatusSchema = z.enum(["draft", "published", "completed", "archived"]);
export const examDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const insertExamSchema = createInsertSchema(exams).omit({ id: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  name: z.string().trim().min(1).max(150),
  examType: z.string().trim().min(1).max(80),
  startDate: examDateSchema,
  endDate: examDateSchema,
  status: examStatusSchema.optional(),
});
export const insertExamClassScopeSchema = createInsertSchema(examClassScopes).omit({ id: true, examId: true, schoolId: true, sessionId: true }).extend({ className: z.string().trim().min(1).max(100), section: z.string().trim().min(1).max(50) });
export const insertExamScheduleSchema = createInsertSchema(examSchedules).omit({ id: true, examId: true, schoolId: true, sessionId: true }).extend({
  examDate: examDateSchema,
  maxMarks: z.number().int().positive(),
  passingMarks: z.number().int().nonnegative(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
});
export const examResultStatusSchema = z.enum(["draft", "published"]);
export const insertExamResultSchema = createInsertSchema(examResults).omit({ id: true, examId: true, scheduleId: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  studentId: z.number().int().positive(),
  obtainedMarks: z.number().int().nonnegative().nullable().optional(),
  isAbsent: z.boolean().optional(),
  status: examResultStatusSchema.optional(),
  remarks: z.string().max(500).nullable().optional(),
});
export const attendanceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true, schoolId: true, sessionId: true, markedByUserId: true, createdAt: true, updatedAt: true }).extend({
  attendanceDate: attendanceDateSchema,
  status: attendanceStatusSchema,
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
});
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, schoolId: true, sessionId: true, createdAt: true, updatedAt: true }).extend({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).optional(),
  stream: z.string().trim().max(80).optional(),
  subjectType: z.enum(["compulsory_language", "core", "elective", "vocational"]).optional(),
  applicableClasses: z.string().trim().max(50).optional(),
});
export const insertAcademicStreamSchema = createInsertSchema(academicStreams).omit({ id: true, schoolId: true, sessionId: true, createdAt: true }).extend({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  boardPattern: z.string().trim().max(50).optional(),
  applicableClasses: z.string().trim().max(50).optional(),
  compulsorySubjects: z.string().max(1000).optional(),
  coreSubjects: z.string().max(1000).optional(),
  electiveOptions: z.string().max(1500).optional(),
  maxElectives: z.number().int().nonnegative().optional(),
});
export const insertTeacherSubjectAssignmentSchema = createInsertSchema(teacherSubjectAssignments).omit({ id: true, schoolId: true, sessionId: true, createdAt: true });
export const insertTeacherClassAssignmentSchema = createInsertSchema(teacherClassAssignments).omit({ id: true, schoolId: true, sessionId: true, createdAt: true }).extend({
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
});
export const insertStudentUserLinkSchema = createInsertSchema(studentUserLinks).omit({ id: true, schoolId: true, sessionId: true, createdAt: true });

export const insertNoticeSchema = createInsertSchema(notices).omit({ id: true, schoolId: true, sessionId: true, createdByUserId: true, createdAt: true }).extend({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(4000),
  category: z.enum(["general", "academic", "exam", "holiday", "event", "emergency"]).optional(),
  targetAudience: z.enum(["all", "students", "teachers", "staff", "class"]).optional(),
  publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const insertHomeworkSchema = createInsertSchema(homeworkAssignments).omit({ id: true, schoolId: true, sessionId: true, assignedByUserId: true, createdAt: true, updatedAt: true }).extend({
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
  subjectId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  assignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["active", "archived"]).optional(),
});

export const insertTimetableEntrySchema = createInsertSchema(timetableEntries).omit({ id: true, schoolId: true, sessionId: true, createdAt: true }).extend({
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
  dayOfWeek: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]),
  periodNo: z.number().int().min(1).max(12),
  startTime: z.string().trim().min(1).max(20),
  endTime: z.string().trim().min(1).max(20),
  subjectId: z.number().int().positive(),
  teacherUserId: z.number().int().positive().nullable().optional(),
  roomNo: z.string().trim().max(50).nullable().optional(),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, schoolId: true, sessionId: true, userId: true, applicantName: true, status: true, reviewedByUserId: true, reviewRemarks: true, createdAt: true, updatedAt: true }).extend({
  applicantType: z.enum(["student", "staff"]).optional(),
  leaveType: z.enum(["sick", "casual", "personal", "medical", "emergency"]).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(1000),
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({ id: true, schoolId: true, sessionId: true, issuedByUserId: true, status: true, createdAt: true }).extend({
  studentId: z.number().int().positive(),
  certificateType: z.enum(["transfer", "bonafide", "character", "fee", "dob", "migration", "passing", "sports"]),
  certificateNo: z.string().trim().max(100).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).nullable().optional(),
  conduct: z.string().max(100).nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
  promotedToClass: z.string().max(100).nullable().optional(),
  duesStatus: z.string().max(200).nullable().optional(),
  lastAttendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  customBody: z.string().max(4000).nullable().optional(),
});

export const insertStudentTransportAllocationSchema = createInsertSchema(studentTransportAllocations).omit({ id: true, schoolId: true, sessionId: true, createdAt: true }).extend({
  studentId: z.number().int().positive(),
  routeId: z.number().int().positive(),
  stopName: z.string().trim().min(1).max(150),
  monthlyFee: z.number().int().nonnegative(),
});

// === Types ===
export type Notice = typeof notices.$inferSelect;
export type HomeworkAssignment = typeof homeworkAssignments.$inferSelect;
export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type StudentTransportAllocation = typeof studentTransportAllocations.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type BackupRecord = typeof backupRecords.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type SchoolClass = typeof schoolClasses.$inferSelect;
export type SchoolSection = typeof schoolSections.$inferSelect;
export type School = typeof schools.$inferSelect;
export type AcademicSession = typeof academicSessions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type TransportRoute = typeof transportRoutes.$inferSelect;
export type FeeStructure = typeof feeStructures.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type StudentDue = typeof studentDues.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type StaffUserLink = typeof staffUserLinks.$inferSelect;
export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type AcademicStream = typeof academicStreams.$inferSelect;
export type TeacherSubjectAssignment = typeof teacherSubjectAssignments.$inferSelect;
export type TeacherClassAssignment = typeof teacherClassAssignments.$inferSelect;
export type StudentUserLink = typeof studentUserLinks.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamClassScope = typeof examClassScopes.$inferSelect;
export type ExamSchedule = typeof examSchedules.$inferSelect;
export type ExamResult = typeof examResults.$inferSelect;

export type InsertClass = z.infer<typeof insertClassSchema>;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertTransportRoute = z.infer<typeof insertTransportRouteSchema>;
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type InsertStaffUserLink = z.infer<typeof insertStaffUserLinkSchema>;
export type InsertSalaryStructure = z.infer<typeof insertSalaryStructureSchema>;
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type InsertAcademicStream = z.infer<typeof insertAcademicStreamSchema>;
export type InsertTeacherSubjectAssignment = z.infer<typeof insertTeacherSubjectAssignmentSchema>;
export type InsertTeacherClassAssignment = z.infer<typeof insertTeacherClassAssignmentSchema>;
export type InsertStudentUserLink = z.infer<typeof insertStudentUserLinkSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type InsertExamClassScope = z.infer<typeof insertExamClassScopeSchema>;
export type InsertExamSchedule = z.infer<typeof insertExamScheduleSchema>;
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type InsertTimetableEntry = z.infer<typeof insertTimetableEntrySchema>;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type InsertStudentTransportAllocation = z.infer<typeof insertStudentTransportAllocationSchema>;

// Server-side insert types retain tenant columns; client input schemas intentionally omit them.
export type StoredStudentInsert = typeof students.$inferInsert;
export type StoredTransportRouteInsert = typeof transportRoutes.$inferInsert;
export type StoredFeeStructureInsert = typeof feeStructures.$inferInsert;
export type StoredFeePaymentInsert = typeof feePayments.$inferInsert;
export type StoredStaffInsert = typeof staff.$inferInsert;
