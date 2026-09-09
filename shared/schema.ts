import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
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
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"),
  name: text("name").notNull(),
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
 });

export const studentDues = pgTable("student_dues", {
   id: serial("id").primaryKey(),
   studentId: integer("student_id").references(() => students.id),
   feeName: text("fee_name").notNull(),
   amount: integer("amount").notNull(),
   dueDate: timestamp("due_date").notNull(),
   isPaid: integer("is_paid").default(0),
   createdAt: timestamp("created_at").defaultNow(),
 });

// Zod Schemas for Validation
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
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
