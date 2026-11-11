import { pgTable, text, serial, integer, boolean, timestamp, date, primaryKey } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const staff = pgTable("staff", {
   id: serial("id").primaryKey(),
   schoolId: integer("school_id").references(() => schools.id),
   name: text("name").notNull(),
   designation: text("designation").notNull(),
   qualification: text("qualification"),
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
