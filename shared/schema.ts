import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
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

export const academicSessions = pgTable(
  "academic_sessions",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .references(() => schools.id, { onDelete: "restrict" })
      .notNull(),
    name: text("name").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idSchoolUnique: uniqueIndex("academic_sessions_id_school_unique").on(
      table.id,
      table.schoolId,
    ),
    schoolNameUnique: uniqueIndex(
      "academic_sessions_school_name_unique",
    ).on(table.schoolId, table.name),
    activeSchoolUnique: uniqueIndex(
      "academic_sessions_one_active_per_school",
    )
      .on(table.schoolId)
      .where(sql`${table.isActive} = true`),
    schoolActiveIndex: index("academic_sessions_school_active_idx").on(
      table.schoolId,
      table.isActive,
    ),
    dateOrderCheck: check(
      "academic_sessions_date_order_check",
      sql`${table.endDate} IS NULL OR ${table.startDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  }),
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id, {
    onDelete: "restrict",
  }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"),
  name: text("name").notNull(),
  isActive: integer("is_active").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .references(() => schools.id, { onDelete: "restrict" })
      .notNull(),

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
    tcIssueDate: text("tc_issue_date"),

    tcSubmitted: integer("tc_submitted").default(0),
    reportCardSubmitted: integer("report_card_submitted").default(0),

    category: text("category"),
    dob: text("dob"),

    contact: text("contact").notNull(),
    address: text("address"),
    photo: text("photo"),

    isActive: integer("is_active").default(1),
    isPromoted: integer("is_promoted").default(0),

    sessionId: integer("session_id")
      .references(() => academicSessions.id, { onDelete: "restrict" })
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idSchoolUnique: uniqueIndex("students_id_school_unique").on(
      table.id,
      table.schoolId,
    ),
    admissionUnique: uniqueIndex(
      "students_school_session_admission_unique",
    ).on(table.schoolId, table.sessionId, table.admissionNo),
    schoolSessionClassIndex: index(
      "students_school_session_class_idx",
    ).on(table.schoolId, table.sessionId, table.class, table.section),
    admissionLookupIndex: index("students_admission_lookup_idx").on(
      table.schoolId,
      table.admissionNo,
    ),
    sessionSchoolForeignKey: foreignKey({
      columns: [table.sessionId, table.schoolId],
      foreignColumns: [academicSessions.id, academicSessions.schoolId],
      name: "students_session_school_fk",
    }),
  }),
);

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .references(() => schools.id, { onDelete: "restrict" })
      .notNull(),
    sessionId: integer("session_id")
      .references(() => academicSessions.id, { onDelete: "restrict" })
      .notNull(),

    class: text("class").notNull(),
    monthlyFee: integer("monthly_fee").notNull(),
    admissionFee: integer("admission_fee").default(0).notNull(),
    examFee: integer("exam_fee").default(0).notNull(),
    otherFee: integer("other_fee").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    schoolSessionClassUnique: uniqueIndex(
      "fee_structures_school_session_class_unique",
    ).on(table.schoolId, table.sessionId, table.class),
    lookupIndex: index("fee_structures_school_session_class_idx").on(
      table.schoolId,
      table.sessionId,
      table.class,
    ),
    amountsCheck: check(
      "fee_structures_amounts_nonnegative",
      sql`${table.monthlyFee} >= 0 AND ${table.admissionFee} >= 0 AND ${table.examFee} >= 0 AND ${table.otherFee} >= 0`,
    ),
    sessionSchoolForeignKey: foreignKey({
      columns: [table.sessionId, table.schoolId],
      foreignColumns: [academicSessions.id, academicSessions.schoolId],
      name: "fee_structures_session_school_fk",
    }),
  }),
);

export const feePayments = pgTable(
  "fee_payments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .references(() => students.id, { onDelete: "restrict" })
      .notNull(),

    schoolId: integer("school_id")
      .references(() => schools.id, { onDelete: "restrict" })
      .notNull(),

    sessionId: integer("session_id")
      .references(() => academicSessions.id, { onDelete: "restrict" })
      .notNull(),

    amount: integer("amount").notNull(),
    month: text("month").notNull(),
    year: integer("year").notNull(),
    paymentDate: timestamp("payment_date").defaultNow().notNull(),
    receiptNo: text("receipt_no").notNull(),
    paymentMethod: text("payment_method"),
    remarks: text("remarks"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    receiptUnique: uniqueIndex("fee_payments_school_receipt_unique").on(
      table.schoolId,
      table.receiptNo,
    ),
    studentPeriodIndex: index("fee_payments_student_period_idx").on(
      table.studentId,
      table.sessionId,
      table.year,
      table.month,
    ),
    schoolPeriodIndex: index("fee_payments_school_period_idx").on(
      table.schoolId,
      table.sessionId,
      table.paymentDate,
    ),
    amountCheck: check(
      "fee_payments_amount_positive",
      sql`${table.amount} > 0`,
    ),
    yearCheck: check(
      "fee_payments_year_valid",
      sql`${table.year} BETWEEN 1900 AND 2200`,
    ),
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
  }),
);

export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .references(() => schools.id, { onDelete: "restrict" })
      .notNull(),
    name: text("name").notNull(),
    designation: text("designation").notNull(),
    qualification: text("qualification"),
    contact: text("contact").notNull(),
    email: text("email"),
    basicSalary: integer("basic_salary").notNull(),
    advanceGiven: integer("advance_given").default(0),
    joinDate: text("join_date"),
    isActive: integer("is_active").default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    schoolIndex: index("staff_school_idx").on(table.schoolId),
    salaryCheck: check(
      "staff_basic_salary_nonnegative",
      sql`${table.basicSalary} >= 0`,
    ),
  }),
);

export const studentDues = pgTable("student_dues", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").references(() => students.id),
  feeName: text("fee_name").notNull(),
  amount: integer("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  isPaid: integer("is_paid").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  sessions: many(academicSessions),
  students: many(students),
  staff: many(staff),
}));

export const academicSessionsRelations = relations(
  academicSessions,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [academicSessions.schoolId],
      references: [schools.id],
    }),
    students: many(students),
    feeStructures: many(feeStructures),
    payments: many(feePayments),
  }),
);

export const studentsRelations = relations(
  students,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [students.schoolId],
      references: [schools.id],
    }),
    session: one(academicSessions, {
      fields: [students.sessionId],
      references: [academicSessions.id],
    }),
    payments: many(feePayments),
  }),
);

export const feeStructuresRelations = relations(
  feeStructures,
  ({ one }) => ({
    school: one(schools, {
      fields: [feeStructures.schoolId],
      references: [schools.id],
    }),
    session: one(academicSessions, {
      fields: [feeStructures.sessionId],
      references: [academicSessions.id],
    }),
  }),
);

export const feePaymentsRelations = relations(
  feePayments,
  ({ one }) => ({
    student: one(students, {
      fields: [feePayments.studentId],
      references: [students.id],
    }),
    school: one(schools, {
      fields: [feePayments.schoolId],
      references: [schools.id],
    }),
    session: one(academicSessions, {
      fields: [feePayments.sessionId],
      references: [academicSessions.id],
    }),
  }),
);

// Zod Schemas
export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertAcademicSessionSchema = createInsertSchema(
  academicSessions,
)
  .omit({
    id: true,
    schoolId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().trim().min(1).max(100),
  });

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students)
  .omit({
    id: true,
    schoolId: true,
    sessionId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    admissionNo: z.string().trim().max(100).optional(),
    name: z.string().trim().min(1),
    fatherName: z.string().trim().min(1),
  });

export const insertFeeStructureSchema = createInsertSchema(
  feeStructures,
)
  .omit({
    id: true,
    schoolId: true,
    sessionId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    monthlyFee: z.number().int().nonnegative(),
    admissionFee: z.number().int().nonnegative().optional(),
    examFee: z.number().int().nonnegative().optional(),
    otherFee: z.number().int().nonnegative().optional(),
  });

export const insertFeePaymentSchema = createInsertSchema(
  feePayments,
)
  .omit({
    id: true,
    schoolId: true,
    sessionId: true,
    paymentDate: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    amount: z.number().int().positive(),
    month: z.string().trim().min(1),
    year: z.number().int().min(1900).max(2200),
    receiptNo: z.string().trim().min(1).max(100),
  });

export const insertStaffSchema = createInsertSchema(staff)
  .omit({
    id: true,
    schoolId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    basicSalary: z.number().int().nonnegative(),
    name: z.string().trim().min(1),
  });

export const insertStudentDuesSchema = createInsertSchema(
  studentDues,
).omit({
  id: true,
  createdAt: true,
});

// Types
export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

export type AcademicSession = typeof academicSessions.$inferSelect;
export type InsertAcademicSession = z.infer<typeof insertAcademicSessionSchema>;

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

export type StoredStudentInsert = typeof students.$inferInsert;
export type StoredFeeStructureInsert = typeof feeStructures.$inferInsert;
export type StoredFeePaymentInsert = typeof feePayments.$inferInsert;
export type StoredStaffInsert = typeof staff.$inferInsert;
