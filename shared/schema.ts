import { pgTable, text, serial, integer, boolean, timestamp, date, real, numeric, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
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
  // School Code (v2.2): har school ki chhoti, insaanon ke liye aasan
  // pehchan (6–8 akshar/ank, jaise "DEM482" ya demo ka "DEMO01"). Parent
  // App ke login par parent yehi code dalta hai — server usi se school
  // pehchanta hai aur parent ko SIRF usi school ke data tak rakhta hai
  // (data-mix rokne ki pehli chaabi). Super Admin school banate samay
  // server khud bana deta hai (storage.generateUniqueSchoolCode); Master
  // App ki Schools list me dikhta hai. Column live DB me v2.2 ke Neon
  // SQL se aayega (NOTES dekho) — unique index bhi wahin hai.
  code: text("code").unique(),
  // School settings (Phase 2 §6): academic session + admission-number style,
  // Postgres roop of Electron school_info ke adm_prefix/adm_year/adm_start.
  session: text("session"),
  admissionPrefix: text("admission_prefix").default("SCHOOL"),
  admissionYear: text("admission_year"),
  admissionStart: integer("admission_start").default(1),
  // Plans/License (v1.7, NICHOD #15): plan sirf ek label hai is batch me —
  // module-gating (plan-wise features band) abhi NAHI hai. licenseExpiry
  // text "YYYY-MM-DD" hai (baaki dates wali parampara: examDate/dob bhi
  // text hain) — is tareekh ke BAAD school ke data-API 403 denge
  // (routes.ts ka license guard). null = koi expiry nahi (hamesha chaalu).
  plan: text("plan").default("Basic"),
  licenseExpiry: text("license_expiry"),
  // UPI payment jaankari (v3.3): Razorpay jaisa gateway setup jab tak
  // na ho, school apna UPI ID + QR code Settings me daal sakta hai —
  // wahi Parents App ke fees hisse me dikhta hai, parent UPI app se
  // fees bhej kar screenshot proof bhej sakta hai (payment_proofs).
  // upiQr = QR image ka base64 (client chhoti image bhejta hai).
  upiId: text("upi_id"),
  upiQr: text("upi_qr"),
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

  // v3.3 naye khaane: APAAR ID (rashtriya student pehchan — sarkari
  // reporting/UDISE ke liye), Class 11-12 ki stream (Science/Commerce/
  // Arts — saada text, chhoti classes ke liye khaali), aur transfer
  // admission par TC asal me MILA ya nahi + kab (upar wale tcNumber/
  // tcIssueDate pichhle school ki TC ki jaankari hain; ye dono is
  // school ke daftar ki raseed hain). tcReceived integer 0/1 (baaki
  // switches wali hi parampara), tcReceivedDate text "YYYY-MM-DD".
  apaarId: text("apaar_id"),
  stream: text("stream"),
  tcReceived: integer("tc_received").default(0),
  tcReceivedDate: text("tc_received_date"),

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
   // Login account se pakka link (v3.3): Principal kisi staff record
   // ko uske user account se jod sakta hai (POST /api/staff/:id/
   // link-user). Leave wali pehchan pehle isi link se hoti hai —
   // contact-match sirf purana fallback hai. Null = link nahi hua.
   userId: integer("user_id").references(() => users.id),
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
  // Result approval (v1.7, Skuul se seekha): 'draft' = marks bhare
  // gaye hain par parent ko abhi NAHI dikhenge; 'approved' = parent
  // dekh sakta hai. Column ka DEFAULT 'approved' jaan-bujh kar hai:
  // live DB ke purane exams (jo pehle se parent ko dikh rahe hain)
  // is column ke judte hi 'approved' bhare jayenge — unka result
  // achanak gayab nahi hoga. NAYE exam ke liye 'draft' route
  // (POST /api/exams) khud likhta hai, default par nahi chhodta.
  resultsStatus: text("results_status").default("approved"),
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

// Result approval ki valid values (v1.7) — ATTENDANCE_STATUSES wala hi
// pattern: DB me text, code me is enum se enforce.
export const RESULT_STATUSES = ["draft", "approved"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
export const resultStatusSchema = z.enum(RESULT_STATUSES);

// §6.10c — Timetable (v1.7, saada haath-se-bana wala; auto-scheduler
// NICHOD me saaf mana hai). Ek class ke ek din ke ek period ki EK hi
// entry — (school_id, class_name, day_of_week, period_no) par unique
// bandhan, attendance wale (student_id, date) bandhan jaisa hi; dobara
// save karna = usi entry ka update (storage upsert yahi karta hai).
// day_of_week: 1 = Monday .. 6 = Saturday (route par zod se bandha).
// teacher_id staff table ko point karta hai — salary_payments.staff_id
// wala hi pattern (teacher ek staff record hi hota hai); khaali period
// ke liye null. subject saada text hai (fee/other naam ki tarah).
export const timetableEntries = pgTable("timetable_entries", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  className: text("class_name").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  periodNo: integer("period_no").notNull(),
  subject: text("subject").notNull(),
  teacherId: integer("teacher_id").references(() => staff.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("timetable_school_class_day_period_unique").on(table.schoolId, table.className, table.dayOfWeek, table.periodNo),
]);

// §6.11 — Transport routes (students.transport_id isi ko point karta hai).
export const transportRoutes = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  routeName: text("route_name").notNull(),
  amount: integer("amount").notNull().default(0),
  // v3.3 (client workstream ki khoj): route ke saath gaadi + driver
  // ki jaankari — Transport page par dikhegi, parent ko pata rahe
  // baccha kis gaadi/driver ke saath aata-jata hai.
  vehicleNo: text("vehicle_no"),
  driverName: text("driver_name"),
  driverContact: text("driver_contact"),
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

// Document approve/reject ki valid values (v2.3, Arena port #8) —
// ATTENDANCE_STATUSES wala hi pattern: DB me text, code me is enum se
// enforce. Upload hote hi document 'pending' rehta hai; Principal
// use 'approved'/'rejected' karta hai (PATCH .../documents/:docId/status).
export const DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

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
  // Approve/reject (v2.3): naya document hamesha 'pending'; purani rows
  // ko bhi live DB me column ka DEFAULT 'pending' hi milega (v2.3 SQL).
  status: text("status").default("pending"),
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
  // Approve/reject (v2.3) — student documents wala hi niyam.
  status: text("status").default("pending"),
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

// School plans ki valid values (v1.7, NICHOD #15) — USER_ROLES wala hi
// pattern: DB me text, code me is enum se enforce. Is batch me plan sirf
// Super Admin ki screen par dikhta/badalt hai; kaunse modules kis plan
// me milenge (entitlement) abhi tay NAHI hai — wo agla kadam hai.
export const SCHOOL_PLANS = ["Basic", "Pro"] as const;
export type SchoolPlan = (typeof SCHOOL_PLANS)[number];
export const schoolPlanSchema = z.enum(SCHOOL_PLANS);

// §6.16 — Library (v1.7, NICHOD #12): saada catalog + issue/return.
// Attendance table ki shaili: school_id + timestamps har table me;
// tareekhein text ("YYYY-MM-DD") taaki overdue ki tulna seedhi string
// se ho jaye. Uplabdh copies koi column NAHI hai — hamesha
// copies_total − (returned_at null wale issues) se banti hai (routes
// jawab me availableCopies jod kar dete hain).
export const libraryBooks = pgTable("library_books", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  title: text("title").notNull(),
  author: text("author"),
  copiesTotal: integer("copies_total").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const libraryIssues = pgTable("library_issues", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  bookId: integer("book_id").notNull().references(() => libraryBooks.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  // issue/due tareekhein text hain (attendance.date wali parampara);
  // returned_at asal timestamp hai — null = kitab abhi bahar hai.
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  returnedAt: timestamp("returned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// §6.17 — Homework (v2.3, Arena port #2): teacher/principal ek class
// ko homework deta hai; wahi homework us class ke baccho ke parents ko
// Parent App me dikhta hai (parent overview ka homework hissa).
//  - class_name timetable_entries wali hi parampara (saada text).
//  - section NULL = poori class ke liye; section bhara ho to sirf usi
//    section ke baccho ke liye (overview yahi niyam lagata hai).
//  - due_date baaki dates ki tarah text "YYYY-MM-DD" — overdue ki
//    jaanch seedhi string tulna se ho jati hai.
export const homework = pgTable("homework", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  className: text("class_name").notNull(),
  section: text("section"),
  subject: text("subject").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leave (chhutti) ki do jaat — ek hi table/system dono ke liye hai
// (Arena wala hi model): 'student' ki arzi par student_id bhara hoga,
// 'staff' ki arzi par staff_id. applicant_user_id = jis login se arzi
// aayi (parent / khud staff / office) — ownership ki jaanch isi aur
// parent_students link se hoti hai (routes dekho).
export const LEAVE_KINDS = ["student", "staff"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const leaveKindSchema = z.enum(LEAVE_KINDS);

// Leave ki haalat: arzi 'pending' se shuru; Principal ka faisla
// 'approved' ya 'rejected' (decided_by me usi ka user id).
export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const leaveStatusSchema = z.enum(LEAVE_STATUSES);

// §6.18 — Leave requests (v2.3, Arena port #3): student + staff dono
// ki chhutti ki arziyan. from/to tareekhein text "YYYY-MM-DD" hain.
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  kind: text("kind").notNull().default("student"),
  studentId: integer("student_id").references(() => students.id),
  staffId: integer("staff_id").references(() => staff.id),
  applicantUserId: integer("applicant_user_id").references(() => users.id),
  fromDate: text("from_date").notNull(),
  toDate: text("to_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  decidedBy: integer("decided_by").references(() => users.id),
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

export const insertTimetableEntrySchema = createInsertSchema(timetableEntries).omit({
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

// Library insert schemas (v1.7) — style upar walon jaisa hi.
export const insertLibraryBookSchema = createInsertSchema(libraryBooks).omit({
  id: true,
  createdAt: true,
});

export const insertLibraryIssueSchema = createInsertSchema(libraryIssues).omit({
  id: true,
  createdAt: true,
});

// Homework + Leave insert schemas (v2.3) — style upar walon jaisa hi;
// kind/status par enum bandhan bhi yahin hai.
export const insertHomeworkSchema = createInsertSchema(homework).omit({
  id: true,
  createdAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
}).extend({
  kind: leaveKindSchema.default("student"),
  status: leaveStatusSchema.default("pending"),
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

export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type InsertTimetableEntry = z.infer<typeof insertTimetableEntrySchema>;

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

export type LibraryBook = typeof libraryBooks.$inferSelect;
export type InsertLibraryBook = z.infer<typeof insertLibraryBookSchema>;

export type LibraryIssue = typeof libraryIssues.$inferSelect;
export type InsertLibraryIssue = z.infer<typeof insertLibraryIssueSchema>;

export type Homework = typeof homework.$inferSelect;
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

// ---------------------------------------------------------------------
// 6.18 App Versions (v3.0) — Master App se teeno apps ke update ki
// ghoshna. SIRF version ki jaankari (naam/code/APK link/notes) — is
// table me KISI school ka data kabhi nahi jata; update sab apps ko
// jata hai, data har school ka alag hi rehta hai.
// stage: 'testing' = sirf Master ke paas (user pehle khud check
// karta hai), 'released' = sab ko gaya. School/Parent apps ko row
// tabhi dikhta hai jab stage = 'released' ho; Master app apni row
// hamesha dekhta hai.
// ---------------------------------------------------------------------

export const appVersions = pgTable("app_versions", {
  app: text("app").primaryKey(), // 'school' | 'parent' | 'master'
  versionName: text("version_name").notNull(),
  versionCode: integer("version_code").notNull(),
  apkUrl: text("apk_url").notNull(),
  notes: text("notes"),
  mandatory: integer("mandatory").default(0),
  stage: text("stage").default("testing"), // 'testing' | 'released'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const APP_VERSION_APPS = ["school", "parent", "master"] as const;
export const APP_VERSION_STAGES = ["testing", "released"] as const;
export const appVersionStageSchema = z.enum(APP_VERSION_STAGES);

export type AppVersion = typeof appVersions.$inferSelect;

// ---------------------------------------------------------------------
// v3.3 — UPI payment proofs, certificates register, audit log,
// teacher assignments.
//
// Payment proofs: Razorpay setup jab tak na ho, parent school ke
// UPI ID/QR par fees bhej kar screenshot bhej sakta hai. Proof
// 'pending' se shuru hota hai; Principal/Accountant ke approve par
// hi ASAL fee payment banta hai (fee_payments me) — bina faisle ke
// proof sirf ek arzi hai, paisa "jama" nahi ginna jata. amount
// NUMERIC hai (paise wala hisaab; asal payment integer me badal
// kar banta hai). image = screenshot ka base64 (2MB limit routes
// par hai, documents wali hi parampara).
// ---------------------------------------------------------------------

export const PAYMENT_PROOF_STATUSES = ["pending", "approved", "rejected"] as const;
export type PaymentProofStatus = (typeof PAYMENT_PROOF_STATUSES)[number];
export const paymentProofStatusSchema = z.enum(PAYMENT_PROOF_STATUSES);

export const paymentProofs = pgTable("payment_proofs", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  studentId: integer("student_id").references(() => students.id),
  parentUserId: integer("parent_user_id").references(() => users.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  txnRef: text("txn_ref"),
  image: text("image"),
  status: text("status").notNull().default("pending"),
  decidedBy: integer("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at"),
  // Approve hone par bani asal fee_payments row ki pehchan.
  paymentId: integer("payment_id").references(() => feePayments.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPaymentProofSchema = createInsertSchema(paymentProofs).omit({
  id: true,
  createdAt: true,
}).extend({
  status: paymentProofStatusSchema.default("pending"),
});

export type PaymentProof = typeof paymentProofs.$inferSelect;
export type InsertPaymentProof = z.infer<typeof insertPaymentProofSchema>;

// Certificates register (v3.3): certificate PRINT hona ek baat hai,
// daftar ke paas uska record hona dusri. Har print par ek row —
// kab, kisko, konsa, kisne diya. studentName/className print ke
// samay ki snapshot hain (baad me student ka naam/class badal jaye
// to bhi register purani sachhi entry dikhata hai).
export const issuedCertificates = pgTable("issued_certificates", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  studentId: integer("student_id").references(() => students.id),
  type: text("type").notNull(),
  studentName: text("student_name").notNull(),
  className: text("class_name"),
  issuedBy: integer("issued_by").references(() => users.id),
  issuedAt: timestamp("issued_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertIssuedCertificateSchema = createInsertSchema(issuedCertificates).omit({
  id: true,
  createdAt: true,
});

export type IssuedCertificate = typeof issuedCertificates.$inferSelect;
export type InsertIssuedCertificate = z.infer<typeof insertIssuedCertificateSchema>;

// Audit log (v3.3): "kisne kab kya badla" ka halka record — sirf
// bade kaam (paisa, admission, accounts, settings, faisle). Helper
// (routes ka logAudit) fail-safe hai: audit likhna fail ho to asal
// kaam kabhi nahi rukta. detail = chhota manaviy varnan (JSON nahi).
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  userId: integer("user_id").references(() => users.id),
  userName: text("user_name"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: integer("entity_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Teacher assignments (v3.3): konsa teacher konsi class/section me
// konsa subject padhata hai + class-teacher hai ya nahi. user_id
// users table ka hai (login account) — staff record se alag cheez
// hai; assignment padhane wale account par lagta hai.
export const teacherAssignments = pgTable("teacher_assignments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").references(() => schools.id),
  userId: integer("user_id").references(() => users.id),
  className: text("class_name").notNull(),
  section: text("section"),
  subject: text("subject"),
  isClassTeacher: integer("is_class_teacher").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTeacherAssignmentSchema = createInsertSchema(teacherAssignments).omit({
  id: true,
  createdAt: true,
});

export type TeacherAssignment = typeof teacherAssignments.$inferSelect;
export type InsertTeacherAssignment = z.infer<typeof insertTeacherAssignmentSchema>;
