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

// === Users (Admin/Staff Login) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"),
  name: text("name").notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }),
});

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
  category: text("category"),
  dob: date("dob"),
  contact: text("contact").notNull(),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
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

// === Staff/Teachers ===
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  designation: text("designation").notNull(),
  basicSalary: integer("basic_salary").notNull(),
  contact: text("contact").notNull(),
  joinDate: date("join_date"),
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "restrict" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  schoolIndex: index("staff_school_idx").on(table.schoolId),
  salaryCheck: check("staff_basic_salary_nonnegative", sql`${table.basicSalary} >= 0`),
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
  payments: many(feePayments),
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
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true, schoolId: true, createdAt: true, updatedAt: true }).extend({
  basicSalary: z.number().int().nonnegative(),
  name: z.string().trim().min(1),
});

// === Types ===
export type School = typeof schools.$inferSelect;
export type AcademicSession = typeof academicSessions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Student = typeof students.$inferSelect;
export type FeeStructure = typeof feeStructures.$inferSelect;
export type FeePayment = typeof feePayments.$inferSelect;
export type Staff = typeof staff.$inferSelect;

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type InsertStaff = z.infer<typeof insertStaffSchema>;

// Server-side insert types retain tenant columns; client input schemas intentionally omit them.
export type StoredStudentInsert = typeof students.$inferInsert;
export type StoredFeeStructureInsert = typeof feeStructures.$inferInsert;
export type StoredFeePaymentInsert = typeof feePayments.$inferInsert;
export type StoredStaffInsert = typeof staff.$inferInsert;
