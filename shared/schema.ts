
import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === Schools Profile (For White-labeling) ===
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  logo: text("logo"), // URL or base64
  contact: text("contact").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === Users (Admin/Staff Login) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // 'admin', 'staff'
  name: text("name").notNull(),
  schoolId: integer("school_id").references(() => schools.id),
});

// === Students Master ===
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  admissionNo: text("admission_no").notNull(),
  name: text("name").notNull(),
  fatherName: text("father_name").notNull(),
  motherName: text("mother_name"),
  class: text("class").notNull(), // LKG, UKG, 1, 2...
  section: text("section").notNull(),
  rollNo: text("roll_no"),
  aadhaar: text("aadhaar"),
  category: text("category"), // General, OBC, SC/ST
  dob: date("dob"),
  contact: text("contact").notNull(),
  address: text("address"),
  isActive: boolean("is_active").default(true), // For promoting/failing
  schoolId: integer("school_id").references(() => schools.id).notNull(),
});

// === Fee Structure ===
export const feeStructures = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  class: text("class").notNull(),
  monthlyFee: integer("monthly_fee").notNull(),
  admissionFee: integer("admission_fee").default(0),
  examFee: integer("exam_fee").default(0),
  otherFee: integer("other_fee").default(0),
  schoolId: integer("school_id").references(() => schools.id).notNull(),
});

// === Fee Payments ===
export const feePayments = pgTable("fee_payments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id).notNull(),
  amount: integer("amount").notNull(),
  month: text("month"), // January, February...
  year: integer("year").notNull(),
  paymentDate: timestamp("payment_date").defaultNow(),
  receiptNo: text("receipt_no").notNull(),
  remarks: text("remarks"),
  schoolId: integer("school_id").references(() => schools.id).notNull(),
});

// === Staff/Teachers ===
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  designation: text("designation").notNull(), // Teacher, Peon, Clerk
  basicSalary: integer("basic_salary").notNull(),
  contact: text("contact").notNull(),
  joinDate: date("join_date"),
  schoolId: integer("school_id").references(() => schools.id).notNull(),
});

// === Relations ===
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  students: many(students),
  staff: many(staff),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  payments: many(feePayments),
}));

export const feePaymentsRelations = relations(feePayments, ({ one }) => ({
  student: one(students, { fields: [feePayments.studentId], references: [students.id] }),
}));

// === Zod Schemas ===
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, isActive: true });
export const insertFeeStructureSchema = createInsertSchema(feeStructures).omit({ id: true });
export const insertFeePaymentSchema = createInsertSchema(feePayments).omit({ id: true, paymentDate: true });
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });

// === Types ===
export type School = typeof schools.$inferSelect;
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type FeeStructure = typeof feeStructures.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type Staff = typeof staff.$inferSelect;

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
