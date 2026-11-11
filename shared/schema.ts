import { pgTable, text, serial, integer, boolean, timestamp, date, real, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  primaryColor: text("primary_color").default("#1976D2"),
  secondaryColor: text("secondary_color").default("#FF9800"),
  // School settings (Phase 2 §6): academic session + admission-number style,
  // Postgres roop of Electron school_info ke adm_prefix/adm_year/adm_start.
  session: text("session"),
  admissionPrefix: text("admission_prefix").default("SCHOOL"),
  admissionYear: text("admission_year"),
  admissionStart: integer("admission_start").default(1),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fixed user roles (Phase 2 §3). DB column text hi hai; valid values
// code me is enum se enforce honge.
export const USER_ROLES = [
  "super_admin",
  "principal",
  "accountant",
  "teacher",
  "staff",
  "parent",
] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  username: text("username").notNull().unique(),
  // Is column me ab sirf scrypt hash jayega: "scrypt:<salt>:<hash>"
  // (Phase 2 §2.1). Plain-text password store karna kabhi nahi hai.
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"),
  name: text("name").notNull(),
  phone: text("phone"),
  mustChangePassword: integer("must_change_password").default(0),
  lastLoginAt: timestamp("last_login_at"),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),

  admissionNo: text("admission_no").notNull().unique(),

  name: text("name").notNull(),
  fatherName: text("father_name").notNull(),
  motherName: text("mother_name"),

  class: text("class").notNull(),
  section: text("section").notNull(),
  rollNo: text("roll_no"),

  aadhaar: text("aadhaar"),

  // ✅ NEW: Birth Certificate No.
  birthCertificateNo: text("birth_certificate_no"),

  // ✅ NEW: Previous School Details (Transfer Student)
  previousSchoolName: text("previous_school_name"),
  previousClass: text("previous_class"),
  tcNumber: text("tc_number"),
  tcIssueDate: text("tc_issue_date"),

  // NOTE: Switch values ko safe rakhne ke liye integer 0/1
  tcSubmitted: integer("tc_submitted").default(0),
  reportCardSubmitted: integer("report_card_submitted").default(0),

  category: text("category"),

  // Transport route link (Phase 2 §6.11) — Electron students table me
  // pehle se tha, Postgres me missing tha. transport_routes neeche
  // define hai; reference lazy callback se hai, isliye order chalega.
  transportId: integer("transport_id").references(() => transportRoutes.id),

  dob: text("dob"), // text for simple date string

  contact: text("contact").notNull(),
  address: text("address"),

  photo: text("photo"),

  isActive: integer("is_active").default(1),
  isPromoted: integer("is_promoted").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feeStructures = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  class: text("class").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  admissionFee: integer("admission_fee").default(0),
  examFee: integer("exam_fee").default(0),
  otherFee: integer("other_fee").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feePayments = pgTable("fee_payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id),
  schoolId: integer("school_id").references(() => schools.id),
  amount: integer("amount").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  paymentDate: timestamp("payment_date").defaultNow(),
  receiptNo: text("receipt_no").notNull().unique(),
  paymentMethod: text("payment_method"),
  remarks: text("remarks"),
  // Phase 3 Batch A fix: Fees page ek bill ki ek payment banata hai aur
  // item-wise hisaab breakdown me bhejta hai — { extras: [{ name, amount,
  // type, month }] } JSON string ke roop me yahi save hoga. Isi se
  // getStudentStatus mahino ki paid halat aur admission balance nikalta
  // hai, aur purani receipt dobara khulne par item list milti hai.
  breakdown: text("breakdown"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const staff = pgTable("staff", {
   id: serial("id").primaryKey(),
   schoolId: integer("school_id").references(() => schools.id),
   // Parity columns (Phase 2 §6.16) — Electron staff table me pehle se hain.
   employeeId: text("employee_id").unique(),
   name: text("name").notNull(),
   // Phase 3 Batch A fix: Staff page ke Add/Edit form me father name ka
   // field pehle se tha, lekin Postgres staff table me column hi nahi
   // tha — value kahin save nahi hoti thi. Ab column hai.
   fatherName: text("father_name"),
   designation: text("designation").notNull(),
   department: text("department"),
   qualification: text("qualification"),
   experience: text("experience"),
   address: text("address"),
   contact: text("contact").notNull(),
   email: text("email"),
   basicSalary: integer("basic_salary").notNull(),
   advanceGiven: integer("advance_given").default(0),
   joinDate: text("join_date"),
   isActive: integer("is_active").default(1),
   createdAt: timestamp("created_at").defaultNow(),
   updatedAt: timestamp("updated_at").defaultNow(),
 });

export const studentDues = pgTable("student_dues", {
   id: serial("id").primaryKey(),
   studentId: integer("student_id").references(() => students.id),
   feeName: text("fee_name").notNull(),
   amount: integer("amount").notNull(),
   dueDate: timestamp("due_date").notNull(),
   isPaid: integer("is_paid").default(0),
   createdAt: timestamp("created_at").defaultNow(),
   updatedAt: timestamp("updated_at").defaultNow(),
 });

// ---------------------------------------------------------------------------
// Feature-parity tables (Phase 2 §6.10–§6.15) — ye features abhi tak sirf
// Electron ke local SQLite me the; bina inke server API adhoora rehta aur
// phone app me ye gayab ho jate. Har table me school_id + created_at /
// updated_at hai (§6.9 — Phase 3 ka offline sync inhi par chalega).
// ---------------------------------------------------------------------------

// §6.10 — Exams aur unke marks.
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  examName: text("exam_name").notNull(),
  examType: text("exam_type"),
  class: text("class").notNull(),
  section: text("section"),
  subject: text("subject"),
  maxMarks: integer("max_marks").default(100),
  passingMarks: integer("passing_marks"),
  // Baaki tables ki tarah date text string me hai ("2026-09-15").
  examDate: text("exam_date"),
  session: text("session"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marks = pgTable("marks", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  examId: integer("exam_id").notNull().references(() => exams.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  // real: aadhe marks (jaise 12.5) bhi aam hain. NULL = marks abhi nahi bhare.
  marksObtained: real("marks_obtained"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Attendance status ki valid values (v1.5) — USER_ROLES/NOTICE_AUDIENCES
// wala hi pattern: DB me text, code me is enum se enforce.
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "half_day"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

// §6.10b — Roz ki attendance (v1.5). Ek student ki ek din ki ek hi row —
// (student_id, date) par unique bandhan; dobara mark karna = usi row ka
// update (storage bulk-upsert yahi karta hai). date baaki tables ki tarah
// text string hai ("2026-11-11") taaki mahina-summary sirf prefix se
// nikal jaye. school_id har parity table ki tarah hai; asal pehchan
// student se bhi bandhi hai.
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  date: text("date").notNull(),
  status: text("status").notNull().default("present"),
  markedBy: integer("marked_by").references(() => users.id),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("attendance_student_date_unique").on(table.studentId, table.date),
]);

// §6.11 — Transport routes (students.transport_id isi ko point karta hai).
export const transportRoutes = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  routeName: text("route_name").notNull(),
  amount: integer("amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.12 — Class-wise extra fees (transport ke alawa wali one-off fees).
export const additionalFees = pgTable("additional_fees", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  class: text("class").notNull(),
  feeName: text("fee_name").notNull(),
  amount: integer("amount").notNull(),
  dueMonth: text("due_month"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.13 — Staff salary payments aur school expenses.
export const salaryPayments = pgTable("salary_payments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  amount: integer("amount").notNull(),
  // Phase 3 Batch C (GAP-B1) — salary ka breakup. `amount` hi net rakam
  // hai (client jo net bheje wahi sach); ye columns sirf hisaab ki
  // tafseel ke liye hain. Purani rows/clients ke liye sab optional/default.
  baseSalary: integer("base_salary"),
  bonus: integer("bonus").notNull().default(0),
  deduction: integer("deduction").notNull().default(0),
  paymentMode: text("payment_mode"),
  paymentDate: text("payment_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  title: text("title").notNull(),
  category: text("category"),
  amount: integer("amount").notNull(),
  expenseDate: text("expense_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.14 — Student documents: Phase 2 me sirf metadata. Asli file storage
// (disk/object store) Phase 3 ka faisla hai; file_path me jo URL/path
// client dega wahi save hoga.
export const studentDocuments = pgTable("student_documents", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  docType: text("doc_type"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  // Phase 3 Batch C — asli file content (base64), v1 ka storage yahi hai
  // (route par ~2MB ki limit hai). Phase 2 ki metadata-only rows me ye
  // null rahega — unke liye file download uplabdh nahi hai.
  fileData: text("file_data"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.14b — Staff documents (Phase 3 Batch C). Electron duniya me ye
// staff.documents JSON column + local disk par the; REST me student
// documents wali hi table-approach hai — file content base64 me
// file_data column me (route par ~2MB limit).
export const staffDocuments = pgTable("staff_documents", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  staffId: integer("staff_id").notNull().references(() => staff.id),
  docType: text("doc_type"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path"),
  fileData: text("file_data"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.15 — Notices. audience: all | teachers | parents (code me zod se
// validate hoga; DB me text hi hai).
export const notices = pgTable("notices", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  title: text("title").notNull(),
  body: text("body"),
  audience: text("audience").default("all"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notice audience ki valid values (Phase 2 §6.15).
export const NOTICE_AUDIENCES = ["all", "teachers", "parents"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];
export const noticeAudienceSchema = z.enum(NOTICE_AUDIENCES);

// Parent <-> student link (Phase 2 §6). Ek parent ke kai bacche,
// ek bacche ke kai parents ho sakte hain.
export const parentStudents = pgTable("parent_students", {
  parentUserId: integer("parent_user_id").notNull().references(() => users.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  relation: text("relation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.parentUserId, table.studentId] }),
]);

// Refresh tokens (Phase 2 §2.2). Sirf token ka hash store hota hai;
// raw token sirf client ke paas rehta hai. Revoke = logout / password
// change / deactivate par turant access band.
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: integer("revoked").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for Validation
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  // Role sirf fixed values me se ek hoga (Phase 2 §3).
  role: userRoleSchema.default("staff"),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
});

export const insertFeeStructureSchema = createInsertSchema(feeStructures).omit({
  id: true,
  createdAt: true,
});

export const insertFeePaymentSchema = createInsertSchema(feePayments).omit({
  id: true,
  createdAt: true,
});

export const insertStaffSchema = createInsertSchema(staff).omit({
   id: true,
   createdAt: true,
 });

export const insertStudentDuesSchema = createInsertSchema(studentDues).omit({
   id: true,
   createdAt: true,
 });

export const insertParentStudentSchema = createInsertSchema(parentStudents).omit({
  createdAt: true,
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

// Parity tables ke insert schemas (Phase 2 §6.10–§6.15) — style upar
// walon jaisa hi: id/createdAt client nahi bhejega.
export const insertExamSchema = createInsertSchema(exams).omit({
  id: true,
  createdAt: true,
});

export const insertMarkSchema = createInsertSchema(marks).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
}).extend({
  // Status sirf chaar fixed values me se ek (v1.5).
  status: attendanceStatusSchema.default("present"),
});

export const insertTransportRouteSchema = createInsertSchema(transportRoutes).omit({
  id: true,
  createdAt: true,
});

export const insertAdditionalFeeSchema = createInsertSchema(additionalFees).omit({
  id: true,
  createdAt: true,
});

export const insertSalaryPaymentSchema = createInsertSchema(salaryPayments).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

export const insertStudentDocumentSchema = createInsertSchema(studentDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertStaffDocumentSchema = createInsertSchema(staffDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertNoticeSchema = createInsertSchema(notices).omit({
  id: true,
  createdAt: true,
}).extend({
  // Audience sirf teen fixed values me se ek (§6.15).
  audience: noticeAudienceSchema.default("all"),
});

// Types
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type FeeStructure = typeof feeStructures.$inferSelect;
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;

export type FeePayment = typeof feePayments.$inferSelect;
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

export type StudentDues = typeof studentDues.$inferSelect;
export type InsertStudentDues = z.infer<typeof insertStudentDuesSchema>;

export type ParentStudent = typeof parentStudents.$inferSelect;
export type InsertParentStudent = z.infer<typeof insertParentStudentSchema>;

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;

export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;

export type Mark = typeof marks.$inferSelect;
export type InsertMark = z.infer<typeof insertMarkSchema>;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type TransportRoute = typeof transportRoutes.$inferSelect;
export type InsertTransportRoute = z.infer<typeof insertTransportRouteSchema>;

export type AdditionalFee = typeof additionalFees.$inferSelect;
export type InsertAdditionalFee = z.infer<typeof insertAdditionalFeeSchema>;

export type SalaryPayment = typeof salaryPayments.$inferSelect;
export type InsertSalaryPayment = z.infer<typeof insertSalaryPaymentSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type StudentDocument = typeof studentDocuments.$inferSelect;
export type InsertStudentDocument = z.infer<typeof insertStudentDocumentSchema>;

export type StaffDocument = typeof staffDocuments.$inferSelect;
export type InsertStaffDocument = z.infer<typeof insertStaffDocumentSchema>;

export type Notice = typeof notices.$inferSelect;
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
