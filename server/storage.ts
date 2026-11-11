import { 
    users, schools, students, feeStructures, feePayments, staff, studentDues,
    parentStudents,
    exams, marks, attendance, transportRoutes, additionalFees, salaryPayments, expenses,
    studentDocuments, staffDocuments, notices,
    type User, type InsertUser, type School, type InsertSchool,
    type Student, type InsertStudent, type FeeStructure, type InsertFeeStructure,
    type FeePayment, type InsertFeePayment, type Staff, type InsertStaff,
    type StudentDues, type InsertStudentDues,
    type ParentStudent, type InsertParentStudent,
    type Exam, type InsertExam, type Mark, type InsertMark,
    type Attendance, type InsertAttendance,
    type TransportRoute, type InsertTransportRoute,
    type AdditionalFee, type InsertAdditionalFee,
    type SalaryPayment, type InsertSalaryPayment,
    type Expense, type InsertExpense,
    type StudentDocument, type InsertStudentDocument,
    type StaffDocument, type InsertStaffDocument,
    type Notice, type InsertNotice
 } from "@shared/schema";
import { eq, ilike, and, or } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

// ---------------------------------------------------------------------------
// Phase 3 Batch A fix — payment breakdown helpers (getStudentStatus ke liye).
//
// Fees page ek bill ki EK payment banata hai: remarks me saari items ki
// string jati hai aur item-wise hisaab `breakdown` (JSON text) me:
//   { extras: [{ name, amount, type, month }] }
// type ke asal values Fees.tsx se hain: "Tuition" (name "Tuition: April"),
// "Transport Fee" (name "Bus: April"), "Admission Fee", "Due".
// Item ka `month` ek mahine ka naam hota hai ("April"); payment ki apni
// `month` field comma-judi ho sakti hai ("April,May") ya "Misc".
//
// Purana getStudentStatus mahine ko "paid" sirf tab manta tha jab remarks
// bilkul "TUITION_FEE"/"TRANSPORT_FEE"/"ADMISSION_FEE" ho — page ki lambi
// remarks string isse kabhi match nahi karti thi, isliye fees bharne ke
// baad bhi mahina "due" dikhta tha. Neeche wala helper pehle breakdown
// dekhta hai, aur jahan breakdown na ho wahan purana remarks-equality
// raasta bilkul pehle jaisa chalta hai.
//
// Saara parsing defensive hai: kharab JSON / ajeeb shape par null ya
// skip — crash kabhi nahi.
// ---------------------------------------------------------------------------

type PaymentBreakdownItem = {
  name?: unknown;
  amount?: unknown;
  type?: unknown;
  month?: unknown;
};

type ParsedPaymentBreakdown = {
  extras: PaymentBreakdownItem[];
  isAdmission: boolean;
};

function parsePaymentBreakdown(
  raw: string | null | undefined,
): ParsedPaymentBreakdown | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const extras = Array.isArray((parsed as { extras?: unknown }).extras)
      ? ((parsed as { extras: PaymentBreakdownItem[] }).extras)
      : [];
    return {
      extras,
      isAdmission: (parsed as { isAdmission?: unknown }).isAdmission === true,
    };
  } catch {
    return null;
  }
}

type StatusMonth = {
  name: string;
  tuitionStatus: "paid" | "due" | "future";
  transportStatus: "paid" | "due" | "future";
  extras?: Array<{
    name: string;
    amount: number;
    status: "paid" | "due" | "future";
  }>;
};

const STATUS_MONTH_NAMES = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

// Ek student ke saal bhar ke payments se do cheezein nikalta hai:
// mahino ki tuition/transport paid halat, aur admission me kul jama
// rakam. DatabaseStorage aur MockStorage dono yahi istemal karte hain
// taaki dono ki status hamesha ek jaisi rahe.
function summarizePaymentsForStatus(
  payments: Array<{
    amount: number;
    month: string;
    remarks: string | null;
    breakdown?: string | null;
  }>,
): { months: StatusMonth[]; admissionPaidSoFar: number } {
  const months: StatusMonth[] = STATUS_MONTH_NAMES.map((name) => ({
    name,
    tuitionStatus: "due",
    transportStatus: "due",
  }));
  let admissionPaidSoFar = 0;

  // Item ka apna month pehle; na ho to payment ki month string
  // (comma-judi ho sakti hai) ke saare mahine.
  const targetMonths = (
    itemMonth: unknown,
    paymentMonth: string,
  ): StatusMonth[] => {
    const names =
      typeof itemMonth === "string" && itemMonth
        ? [itemMonth]
        : paymentMonth
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
    return names
      .map((name) => months.find((m) => m.name === name))
      .filter((m): m is StatusMonth => m != null);
  };

  for (const payment of payments) {
    const bd = parsePaymentBreakdown(payment.breakdown);

    if (bd && bd.extras.length > 0) {
      let sawAdmissionItem = false;
      for (const item of bd.extras) {
        const amount =
          typeof item.amount === "number" && Number.isFinite(item.amount)
            ? item.amount
            : 0;

        if (item.type === "Admission Fee") {
          // Admission ka paisa mahine se nahi judta — seedha balance
          // kam karta hai.
          sawAdmissionItem = true;
          admissionPaidSoFar += amount;
          continue;
        }

        const targets = targetMonths(item.month, payment.month);
        if (item.type === "Tuition") {
          targets.forEach((m) => {
            m.tuitionStatus = "paid";
          });
        } else if (item.type === "Transport Fee") {
          targets.forEach((m) => {
            m.transportStatus = "paid";
          });
        } else if (targets[0]) {
          // "Due" ya koi aur item — purane extras wale raaste ki tarah
          // pehle matching mahine par paid extra ke roop me dikhao.
          if (!targets[0].extras) targets[0].extras = [];
          targets[0].extras.push({
            name:
              typeof item.name === "string" && item.name
                ? item.name
                : payment.remarks || "Other Fee",
            amount,
            status: "paid",
          });
        }
      }
      // Breakdown me admission item na ho lekin payload par isAdmission
      // flag mehfooz ho (routes use breakdown JSON me rakhta hai) to
      // pura amount admission me gino.
      if (!sawAdmissionItem && bd.isAdmission) {
        admissionPaidSoFar += payment.amount ?? 0;
      }
      continue;
    }

    if (bd && bd.isAdmission) {
      admissionPaidSoFar += payment.amount ?? 0;
      continue;
    }

    // Purana raasta — remarks equality, bilkul pehle jaisa behaviour.
    if (payment.remarks === "ADMISSION_FEE") {
      admissionPaidSoFar += payment.amount ?? 0;
      continue;
    }
    const month = months.find((m) => m.name === payment.month);
    if (month) {
      if (payment.remarks === "TUITION_FEE") {
        month.tuitionStatus = "paid";
      } else if (payment.remarks === "TRANSPORT_FEE") {
        month.transportStatus = "paid";
      } else {
        if (!month.extras) month.extras = [];
        month.extras.push({
          name: payment.remarks || "Other Fee",
          amount: payment.amount ?? 0,
          status: "paid",
        });
      }
    }
  }

  return { months, admissionPaidSoFar };
}

// 1. Interface Definition
// ---------------------------------------------------------------------------
// Attendance summary helper (v1.5) — DatabaseStorage aur MockStorage dono
// yahi istemal karte hain taaki hisaab har jagah ek jaisa rahe.
// Percentage ka niyam: present = 1, late = 1 (der se aaya par aaya),
// half_day = 0.5, absent = 0. totalMarked = 0 ho to percentage 0.
// ---------------------------------------------------------------------------
export function summarizeAttendance(
  month: string,
  rows: Attendance[],
): {
  month: string;
  totalMarked: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  percentage: number;
} {
  const present = rows.filter((row) => row.status === "present").length;
  const absent = rows.filter((row) => row.status === "absent").length;
  const late = rows.filter((row) => row.status === "late").length;
  const halfDay = rows.filter((row) => row.status === "half_day").length;
  const totalMarked = rows.length;
  const counted = present + late + halfDay * 0.5;
  const percentage =
    totalMarked > 0 ? Math.round((counted / totalMarked) * 1000) / 10 : 0;
  return { month, totalMarked, present, absent, late, halfDay, percentage };
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Phase 2 batch 2 — auth/provisioning helpers (§2, §5.2, §5.3)
  getUsers(): Promise<User[]>;
  getUsersBySchool(schoolId: number): Promise<User[]>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  updateUserPassword(id: number, passwordHash: string): Promise<User>;
  setMustChangePassword(id: number, value: number): Promise<void>;
  updateLastLogin(id: number): Promise<void>;
  linkParentStudent(link: InsertParentStudent): Promise<ParentStudent>;
  getParentStudentLinks(parentUserId: number): Promise<ParentStudent[]>;
  replaceParentStudentLinks(parentUserId: number, studentIds: number[], relation?: string | null): Promise<ParentStudent[]>;

  getSchools(): Promise<School[]>;
  getSchool(id: number): Promise<School | undefined>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: number, school: Partial<InsertSchool>): Promise<School>;

  getStudent(id: number): Promise<Student | undefined>;
  getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student>;
  promoteStudents(studentIds: number[], targetClass: string): Promise<void>;

  getFeeStructures(schoolId: number): Promise<FeeStructure[]>;
  createFeeStructure(structure: InsertFeeStructure): Promise<FeeStructure>;

  getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]>;
  createFeePayment(payment: InsertFeePayment): Promise<FeePayment>;
  
  getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]> ;
  
  // Default: sirf active staff (salary/pending aur dashboard stats isi
  // par nirbhar hain). Staff page ki list ke liye includeInactive: true
  // bhejo — wahan status filters ko inactive staff bhi chahiye.
  getStaff(schoolId: number, options?: { includeInactive?: boolean }): Promise<Staff[]>;
  createStaff(staff: InsertStaff): Promise<Staff>;
  
  getStudentStatus(studentId: number, classStr: string, year: number): Promise<{
    admissionPaid: boolean;
    admissionBalance: number;
    admissionPaidSoFar: number;
    admissionTotal: number;
    monthStatus: Array<{
      name: string;
      tuitionStatus: 'paid' | 'due' | 'future';
      transportStatus: 'paid' | 'due' | 'future';
      extras?: Array<{ name: string; amount: number; status: 'paid' | 'due' | 'future' }>;
    }>;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    monthlyFee: number;
  }>;

  // ---------------------------------------------------------------------
  // Phase 2 parity (rollout steps 7–8, §5.4–§5.8) — batch 2c additions.
  // Har list/get schoolId-scoped hai; routes object-level par bhi school
  // check karti hain (dusri school ka record = 404, §3.1.4).
  // ---------------------------------------------------------------------

  // Students parity (§5.4)
  getStudentByAdmissionNo(schoolId: number, admissionNo: string): Promise<Student | undefined>;
  getNextAdmissionNo(schoolId: number): Promise<string>;
  getNextReceiptNo(schoolId: number): Promise<string>;

  // Student documents (§5.4 #28–29) — sirf metadata, file storage Phase 3.
  getStudentDocuments(studentId: number): Promise<StudentDocument[]>;
  getStudentDocument(id: number): Promise<StudentDocument | undefined>;
  createStudentDocument(doc: InsertStudentDocument): Promise<StudentDocument>;
  deleteStudentDocument(id: number): Promise<void>;

  // Fee structures / payments ke bache hue writes (§5.5 #32–33, #36)
  updateFeeStructure(id: number, structure: Partial<InsertFeeStructure>): Promise<FeeStructure>;
  deleteFeeStructure(id: number): Promise<void>;
  deleteFeePayment(id: number): Promise<void>;

  // Dues (§5.5 #39–41)
  getStudentDues(studentId: number): Promise<StudentDues[]>;
  getStudentDue(id: number): Promise<StudentDues | undefined>;
  createStudentDue(due: InsertStudentDues): Promise<StudentDues>;
  // Dues-fix batch: due ko paid mark karna / partial payment par rakam
  // ghatana — pehle iske liye koi method hi nahi tha, isliye Fees page
  // ka paisa jud jane ke baad bhi due pending reh jata tha.
  updateStudentDue(id: number, due: Partial<InsertStudentDues>): Promise<StudentDues | undefined>;
  deleteStudentDue(id: number): Promise<void>;

  // Additional fees (§5.5 #42–44)
  getAdditionalFees(schoolId: number): Promise<AdditionalFee[]>;
  getAdditionalFee(id: number): Promise<AdditionalFee | undefined>;
  createAdditionalFee(fee: InsertAdditionalFee): Promise<AdditionalFee>;
  deleteAdditionalFee(id: number): Promise<void>;

  // Transport (§5.5 #45–47)
  getTransportRoutes(schoolId: number): Promise<TransportRoute[]>;
  createTransportRoute(route: InsertTransportRoute): Promise<TransportRoute>;
  deleteTransportRoute(id: number): Promise<void>;

  // Staff parity (§5.6 #51–53) — getStaff upar pehle se hai.
  getStaffMember(id: number): Promise<Staff | undefined>;
  updateStaff(id: number, staffUpdate: Partial<InsertStaff>): Promise<Staff>;

  // Staff documents (Phase 3 Batch C) — student documents wali hi
  // approach; file content fileData (base64) me rehta hai.
  getStaffDocuments(staffId: number): Promise<StaffDocument[]>;
  getStaffDocument(id: number): Promise<StaffDocument | undefined>;
  createStaffDocument(doc: InsertStaffDocument): Promise<StaffDocument>;
  deleteStaffDocument(id: number): Promise<void>;

  // Salary (§5.6 #54–57)
  getStaffSalaryHistory(staffId: number): Promise<SalaryPayment[]>;
  getSalaryPayments(schoolId: number, month?: string, year?: number): Promise<SalaryPayment[]>;
  createSalaryPayment(payment: InsertSalaryPayment): Promise<SalaryPayment>;
  deleteSalaryPayment(id: number): Promise<void>;

  // Expenses (§5.7 #58–60)
  getExpenses(schoolId: number): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  // Exams + marks (§5.8 #64–69)
  getExams(schoolId: number): Promise<Exam[]>;
  getExam(id: number): Promise<Exam | undefined>;
  createExam(exam: InsertExam): Promise<Exam>;
  deleteExam(id: number): Promise<void>;
  getExamMarks(examId: number): Promise<Mark[]>;
  getMarksForStudents(examId: number, studentIds: number[]): Promise<Mark[]>;
  saveExamMarks(examId: number, schoolId: number, entries: Array<{ studentId: number; marksObtained: number | null; remarks?: string | null }>): Promise<Mark[]>;
  getStudentMarks(studentId: number): Promise<Mark[]>;

  // Attendance (v1.5) — bulk mark/upsert saveExamMarks wale hi pattern
  // par: (student_id, date) par maujood row update, warna nayi row.
  markAttendanceBulk(schoolId: number, markedBy: number, date: string, entries: Array<{ studentId: number; status: string; remarks?: string | null }>): Promise<Attendance[]>;
  getAttendanceForStudents(studentIds: number[], date: string): Promise<Attendance[]>;
  getStudentAttendance(studentId: number, monthPrefix?: string): Promise<Attendance[]>;
  getStudentAttendanceSummary(studentId: number, monthPrefix: string): Promise<{
    month: string;
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    percentage: number;
  }>;

  // Notices (§5.8 #70–72)
  getNotices(schoolId: number): Promise<Notice[]>;
  getNotice(id: number): Promise<Notice | undefined>;
  createNotice(notice: InsertNotice): Promise<Notice>;
  updateNotice(id: number, notice: Partial<InsertNotice>): Promise<Notice>;
  deleteNotice(id: number): Promise<void>;

  // Reports (§5.7 #61–62 + #63 dashboard)
  getPendingDuesTotal(schoolId: number): Promise<number>;
  getFinancialSummary(schoolId: number): Promise<{
    totalFeesCollected: number;
    totalSalaryPaid: number;
    totalExpenses: number;
    balance: number;
    pendingDuesTotal: number;
  }>;
  getFinancialTrend(schoolId: number): Promise<Array<{
    month: string;
    year: number;
    feesCollected: number;
    salaryPaid: number;
    expenses: number;
  }>>;
  getDashboardStats(schoolId: number): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalStaff: number;
    todayCollection: number;
    monthCollection: number;
    pendingDuesTotal: number;
  }>;
} // <-- interface yahan band hona chahiye tha

// 2. Database Implementation
export class DatabaseStorage implements IStorage {
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

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.schoolId, schoolId));
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(userUpdate).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<User> {
    const [user] = await db.update(users).set({ password: passwordHash }).where(eq(users.id, id)).returning();
    return user;
  }

  async setMustChangePassword(id: number, value: number): Promise<void> {
    await db.update(users).set({ mustChangePassword: value }).where(eq(users.id, id));
  }

  async updateLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  async linkParentStudent(link: InsertParentStudent): Promise<ParentStudent> {
    const [created] = await db.insert(parentStudents).values(link).onConflictDoNothing().returning();
    if (created) return created;
    const [existing] = await db.select().from(parentStudents)
      .where(and(eq(parentStudents.parentUserId, link.parentUserId), eq(parentStudents.studentId, link.studentId)));
    return existing;
  }

  async getParentStudentLinks(parentUserId: number): Promise<ParentStudent[]> {
    return await db.select().from(parentStudents).where(eq(parentStudents.parentUserId, parentUserId));
  }

  async replaceParentStudentLinks(parentUserId: number, studentIds: number[], relation?: string | null): Promise<ParentStudent[]> {
    await db.delete(parentStudents).where(eq(parentStudents.parentUserId, parentUserId));
    for (const studentId of studentIds) {
      await this.linkParentStudent({ parentUserId, studentId, relation: relation ?? null });
    }
    return await this.getParentStudentLinks(parentUserId);
  }

  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async getSchool(id: number): Promise<School | undefined> {
    const [school] = await db.select().from(schools).where(eq(schools.id, id));
    return school;
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: number, schoolUpdate: Partial<InsertSchool>): Promise<School> {
    const [school] = await db.update(schools).set(schoolUpdate).where(eq(schools.id, id)).returning();
    return school;
  }

  async getStudent(id: number): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudents(schoolId: number, filters?: { class?: string, section?: string, search?: string }): Promise<Student[]> {
    let conditions = [eq(students.schoolId, schoolId), eq(students.isActive, 1)];
    
    if (filters?.class && filters.class !== 'all') conditions.push(eq(students.class, filters.class));
    if (filters?.section && filters.section !== 'all') conditions.push(eq(students.section, filters.section));
    // Search sirf naam par thi — page "Name, Adm No, Mobile..." wadha
    // karta hai. Ab admission no aur contact (students table ka ekmatra
    // mobile column) par bhi khoj hoti hai.
    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(students.name, term),
          ilike(students.admissionNo, term),
          ilike(students.contact, term),
        )!,
      );
    }

    return await db.select().from(students).where(and(...conditions));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, studentUpdate: Partial<InsertStudent>): Promise<Student> {
    const [student] = await db.update(students).set(studentUpdate).where(eq(students.id, id)).returning();
    return student;
  }

  async promoteStudents(studentIds: number[], targetClass: string): Promise<void> {
    for (const id of studentIds) {
      await db.update(students).set({ class: targetClass, isPromoted: 1 }).where(eq(students.id, id));
    }
  }

  async getFeeStructures(schoolId: number): Promise<FeeStructure[]> {
    return await db.select().from(feeStructures).where(eq(feeStructures.schoolId, schoolId));
  }

  async createFeeStructure(insertStructure: InsertFeeStructure): Promise<FeeStructure> {
    const [structure] = await db.insert(feeStructures).values(insertStructure).returning();
    return structure;
  }

  async getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]> {
    if (studentId) {
      return await db.select().from(feePayments).where(eq(feePayments.studentId, studentId));
    }
    return await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
  }

  async createFeePayment(insertPayment: InsertFeePayment): Promise<FeePayment> {
    const [payment] = await db.insert(feePayments).values(insertPayment).returning();
    return payment;
  }

  async getDefaulters(schoolId: number, classStr?: string, month?: string): Promise<{ studentId: number, name: string, amountPending: number }[]> {
    return [];
  }

  async getStaff(schoolId: number, options?: { includeInactive?: boolean }): Promise<Staff[]> {
    if (options?.includeInactive) {
      return await db.select().from(staff).where(eq(staff.schoolId, schoolId));
    }
    return await db.select().from(staff).where(and(eq(staff.schoolId, schoolId), eq(staff.isActive, 1)));
  }

  async createStaff(insertStaff: InsertStaff): Promise<Staff> {
    const [newStaff] = await db.insert(staff).values(insertStaff).returning();
    return newStaff;
  }

  async getStudentStatus(studentId: number, classStr: string, year: number): Promise<{
    admissionPaid: boolean;
    admissionBalance: number;
    admissionPaidSoFar: number;
    admissionTotal: number;
    monthStatus: Array<{
      name: string;
      tuitionStatus: 'paid' | 'due' | 'future';
      transportStatus: 'paid' | 'due' | 'future';
      extras?: Array<{ name: string; amount: number; status: 'paid' | 'due' | 'future' }>;
    }>;
    pendingDues: Array<{
      id: number;
      fee_name: string;
      due_date: string;
      amount: number;
    }>;
    monthlyFee: number;
  }> {
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    if (!student) throw new Error("Student not found");

    const [feeStructure] = await db.select().from(feeStructures)
      .where(and(eq(feeStructures.schoolId, student.schoolId ?? 0), eq(feeStructures.class, classStr)));
    
    if (!feeStructure) {
        return {
            admissionPaid: false,
            admissionBalance: 0,
            admissionPaidSoFar: 0,
            admissionTotal: 0,
            monthStatus: [],
            pendingDues: [],
            monthlyFee: 0
        };
    }

    const payments = await db.select().from(feePayments)
      .where(and(eq(feePayments.studentId, studentId), eq(feePayments.year, year)));

    // Phase 3 Batch A fix: hisaab ab shared helper se — helper pehle
    // payment ke breakdown (JSON) ko dekhta hai, isliye Fees page ki
    // ek-bill-ek-payment wali receipts se bhi mahine "paid" honge aur
    // admission balance ghatega. Bina breakdown wali purani payments
    // ke liye remarks-equality wala purana raasta helper ke andar
    // bilkul pehle jaisa chalta hai.
    const { months, admissionPaidSoFar } = summarizePaymentsForStatus(payments);
    const admissionTotal = feeStructure.admissionFee ?? 0;
    const admissionBalance = Math.max(0, admissionTotal - admissionPaidSoFar);
    const admissionPaid = admissionBalance === 0;

     // Fetch pending dues from student_dues table
     const pendingDuesList = await db.select()
       .from(schema.studentDues)
       .where(and(eq(schema.studentDues.studentId, studentId), eq(schema.studentDues.isPaid, 0)));

     return {
       admissionPaid,
       admissionBalance,
       admissionPaidSoFar,
       admissionTotal,
       monthStatus: months,
      pendingDues: pendingDuesList.map(due => ({
        id: due.id,
        fee_name: due.feeName,
        due_date: due.dueDate.toISOString(),
        amount: due.amount
      })),
       monthlyFee: feeStructure.monthlyFee ?? 0
     };
  }

  // -------------------------------------------------------------------
  // Phase 2 parity implementations (batch 2c) — DatabaseStorage
  // -------------------------------------------------------------------

  async getStudentByAdmissionNo(schoolId: number, admissionNo: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.admissionNo, admissionNo)));
    return student;
  }

  // Agla admission number school ki settings se banta hai (§6.7):
  // "PREFIX[/YEAR]/NNNN". School ke maujooda numbers me sabse bade
  // numeric hisse se agla number; koi student na ho to admission_start.
  async getNextAdmissionNo(schoolId: number): Promise<string> {
    const school = await this.getSchool(schoolId);
    const prefix = school?.admissionPrefix ?? "SCHOOL";
    const yearPart = school?.admissionYear ? `/${school.admissionYear}` : "";
    const start = school?.admissionStart ?? 1;
    const rows = await db.select().from(students).where(eq(students.schoolId, schoolId));
    let max = start - 1;
    for (const row of rows) {
      const lastPart = row.admissionNo.split("/").pop() ?? "";
      const n = parseInt(lastPart, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    const next = Math.max(start, max + 1);
    return `${prefix}${yearPart}/${String(next).padStart(4, "0")}`;
  }

  // Receipt number ka format "RCP-NNNNN" — school ke maujooda receipts
  // ke sabse bade number se agla (delete ke baad bhi duplicate nahi).
  async getNextReceiptNo(schoolId: number): Promise<string> {
    const rows = await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
    let max = 0;
    for (const row of rows) {
      const match = /(\d+)\s*$/.exec(row.receiptNo);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return `RCP-${String(max + 1).padStart(5, "0")}`;
  }

  async getStudentDocuments(studentId: number): Promise<StudentDocument[]> {
    return await db.select().from(studentDocuments).where(eq(studentDocuments.studentId, studentId));
  }

  async getStudentDocument(id: number): Promise<StudentDocument | undefined> {
    const [doc] = await db.select().from(studentDocuments).where(eq(studentDocuments.id, id));
    return doc;
  }

  async createStudentDocument(doc: InsertStudentDocument): Promise<StudentDocument> {
    const [created] = await db.insert(studentDocuments).values(doc).returning();
    return created;
  }

  async deleteStudentDocument(id: number): Promise<void> {
    await db.delete(studentDocuments).where(eq(studentDocuments.id, id));
  }

  async getStaffDocuments(staffId: number): Promise<StaffDocument[]> {
    return await db.select().from(staffDocuments).where(eq(staffDocuments.staffId, staffId));
  }

  async getStaffDocument(id: number): Promise<StaffDocument | undefined> {
    const [doc] = await db.select().from(staffDocuments).where(eq(staffDocuments.id, id));
    return doc;
  }

  async createStaffDocument(doc: InsertStaffDocument): Promise<StaffDocument> {
    const [created] = await db.insert(staffDocuments).values(doc).returning();
    return created;
  }

  async deleteStaffDocument(id: number): Promise<void> {
    await db.delete(staffDocuments).where(eq(staffDocuments.id, id));
  }

  async updateFeeStructure(id: number, structureUpdate: Partial<InsertFeeStructure>): Promise<FeeStructure> {
    const [structure] = await db.update(feeStructures).set(structureUpdate).where(eq(feeStructures.id, id)).returning();
    return structure;
  }

  async deleteFeeStructure(id: number): Promise<void> {
    await db.delete(feeStructures).where(eq(feeStructures.id, id));
  }

  async deleteFeePayment(id: number): Promise<void> {
    await db.delete(feePayments).where(eq(feePayments.id, id));
  }

  async getStudentDues(studentId: number): Promise<StudentDues[]> {
    return await db.select().from(studentDues).where(eq(studentDues.studentId, studentId));
  }

  async getStudentDue(id: number): Promise<StudentDues | undefined> {
    const [due] = await db.select().from(studentDues).where(eq(studentDues.id, id));
    return due;
  }

  async createStudentDue(due: InsertStudentDues): Promise<StudentDues> {
    const [created] = await db.insert(studentDues).values(due).returning();
    return created;
  }

  async updateStudentDue(id: number, dueUpdate: Partial<InsertStudentDues>): Promise<StudentDues | undefined> {
    const [updated] = await db.update(studentDues).set(dueUpdate).where(eq(studentDues.id, id)).returning();
    return updated;
  }

  async deleteStudentDue(id: number): Promise<void> {
    await db.delete(studentDues).where(eq(studentDues.id, id));
  }

  async getAdditionalFees(schoolId: number): Promise<AdditionalFee[]> {
    return await db.select().from(additionalFees).where(eq(additionalFees.schoolId, schoolId));
  }

  async getAdditionalFee(id: number): Promise<AdditionalFee | undefined> {
    const [fee] = await db.select().from(additionalFees).where(eq(additionalFees.id, id));
    return fee;
  }

  async createAdditionalFee(fee: InsertAdditionalFee): Promise<AdditionalFee> {
    const [created] = await db.insert(additionalFees).values(fee).returning();
    return created;
  }

  async deleteAdditionalFee(id: number): Promise<void> {
    await db.delete(additionalFees).where(eq(additionalFees.id, id));
  }

  async getTransportRoutes(schoolId: number): Promise<TransportRoute[]> {
    return await db.select().from(transportRoutes).where(eq(transportRoutes.schoolId, schoolId));
  }

  async createTransportRoute(route: InsertTransportRoute): Promise<TransportRoute> {
    const [created] = await db.insert(transportRoutes).values(route).returning();
    return created;
  }

  async deleteTransportRoute(id: number): Promise<void> {
    await db.delete(transportRoutes).where(eq(transportRoutes.id, id));
  }

  async getStaffMember(id: number): Promise<Staff | undefined> {
    const [member] = await db.select().from(staff).where(eq(staff.id, id));
    return member;
  }

  async updateStaff(id: number, staffUpdate: Partial<InsertStaff>): Promise<Staff> {
    const [member] = await db.update(staff).set(staffUpdate).where(eq(staff.id, id)).returning();
    return member;
  }

  async getStaffSalaryHistory(staffId: number): Promise<SalaryPayment[]> {
    return await db.select().from(salaryPayments).where(eq(salaryPayments.staffId, staffId));
  }

  async getSalaryPayments(schoolId: number, month?: string, year?: number): Promise<SalaryPayment[]> {
    const conditions = [eq(salaryPayments.schoolId, schoolId)];
    if (month) conditions.push(eq(salaryPayments.month, month));
    if (year != null) conditions.push(eq(salaryPayments.year, year));
    return await db.select().from(salaryPayments).where(and(...conditions));
  }

  async createSalaryPayment(payment: InsertSalaryPayment): Promise<SalaryPayment> {
    const [created] = await db.insert(salaryPayments).values(payment).returning();
    return created;
  }

  async deleteSalaryPayment(id: number): Promise<void> {
    await db.delete(salaryPayments).where(eq(salaryPayments.id, id));
  }

  async getExpenses(schoolId: number): Promise<Expense[]> {
    return await db.select().from(expenses).where(eq(expenses.schoolId, schoolId));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getExams(schoolId: number): Promise<Exam[]> {
    return await db.select().from(exams).where(eq(exams.schoolId, schoolId));
  }

  async getExam(id: number): Promise<Exam | undefined> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, id));
    return exam;
  }

  async createExam(exam: InsertExam): Promise<Exam> {
    const [created] = await db.insert(exams).values(exam).returning();
    return created;
  }

  async deleteExam(id: number): Promise<void> {
    // Pehle us exam ke marks, phir exam — warna orphan marks reh jayenge.
    await db.delete(marks).where(eq(marks.examId, id));
    await db.delete(exams).where(eq(exams.id, id));
  }

  async getExamMarks(examId: number): Promise<Mark[]> {
    return await db.select().from(marks).where(eq(marks.examId, examId));
  }

  async getMarksForStudents(examId: number, studentIds: number[]): Promise<Mark[]> {
    const rows = await this.getExamMarks(examId);
    const wanted = new Set(studentIds);
    return rows.filter((row) => wanted.has(row.studentId));
  }

  // Bulk save (§5.8 #68): ek exam ke kai students ke marks ek saath.
  // (exam_id, student_id) par upsert jaisa behaviour — maujood row
  // update, warna nayi row. (Schema me is pair par unique constraint
  // nahi hai, isliye pehle select karke check karte hain.)
  async saveExamMarks(examId: number, schoolId: number, entries: Array<{ studentId: number; marksObtained: number | null; remarks?: string | null }>): Promise<Mark[]> {
    const saved: Mark[] = [];
    for (const entry of entries) {
      const [existing] = await db.select().from(marks)
        .where(and(eq(marks.examId, examId), eq(marks.studentId, entry.studentId)));
      if (existing) {
        const [updated] = await db.update(marks)
          .set({ marksObtained: entry.marksObtained, remarks: entry.remarks ?? null, updatedAt: new Date() })
          .where(eq(marks.id, existing.id))
          .returning();
        saved.push(updated);
      } else {
        const [created] = await db.insert(marks)
          .values({ schoolId, examId, studentId: entry.studentId, marksObtained: entry.marksObtained, remarks: entry.remarks ?? null })
          .returning();
        saved.push(created);
      }
    }
    return saved;
  }

  async getStudentMarks(studentId: number): Promise<Mark[]> {
    return await db.select().from(marks).where(eq(marks.studentId, studentId));
  }

  // Attendance bulk mark (v1.5) — saveExamMarks wala hi upsert pattern:
  // (student_id, date) par pehle select, maujood ho to update warna
  // insert. (Schema me is pair par unique index bhi hai — dohra record
  // DB star par bhi nahi ban sakta.)
  async markAttendanceBulk(schoolId: number, markedBy: number, date: string, entries: Array<{ studentId: number; status: string; remarks?: string | null }>): Promise<Attendance[]> {
    const saved: Attendance[] = [];
    for (const entry of entries) {
      const [existing] = await db.select().from(attendance)
        .where(and(eq(attendance.studentId, entry.studentId), eq(attendance.date, date)));
      if (existing) {
        const [updated] = await db.update(attendance)
          .set({ status: entry.status, markedBy, remarks: entry.remarks ?? null, updatedAt: new Date() })
          .where(eq(attendance.id, existing.id))
          .returning();
        saved.push(updated);
      } else {
        const [created] = await db.insert(attendance)
          .values({ schoolId, studentId: entry.studentId, date, status: entry.status, markedBy, remarks: entry.remarks ?? null })
          .returning();
        saved.push(created);
      }
    }
    return saved;
  }

  async getAttendanceForStudents(studentIds: number[], date: string): Promise<Attendance[]> {
    if (studentIds.length === 0) return [];
    const rows = await db.select().from(attendance).where(eq(attendance.date, date));
    const wanted = new Set(studentIds);
    return rows.filter((row) => wanted.has(row.studentId));
  }

  async getStudentAttendance(studentId: number, monthPrefix?: string): Promise<Attendance[]> {
    const rows = await db.select().from(attendance).where(eq(attendance.studentId, studentId));
    const filtered = monthPrefix
      ? rows.filter((row) => row.date.startsWith(monthPrefix))
      : rows;
    // Nayi tareekh pehle (history list ke liye).
    return filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  async getStudentAttendanceSummary(studentId: number, monthPrefix: string): Promise<{
    month: string;
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    percentage: number;
  }> {
    const rows = await this.getStudentAttendance(studentId, monthPrefix);
    return summarizeAttendance(monthPrefix, rows);
  }

  async getNotices(schoolId: number): Promise<Notice[]> {
    return await db.select().from(notices).where(eq(notices.schoolId, schoolId));
  }

  async getNotice(id: number): Promise<Notice | undefined> {
    const [notice] = await db.select().from(notices).where(eq(notices.id, id));
    return notice;
  }

  async createNotice(notice: InsertNotice): Promise<Notice> {
    const [created] = await db.insert(notices).values(notice).returning();
    return created;
  }

  async updateNotice(id: number, noticeUpdate: Partial<InsertNotice>): Promise<Notice> {
    const [notice] = await db.update(notices).set(noticeUpdate).where(eq(notices.id, id)).returning();
    return notice;
  }

  async deleteNotice(id: number): Promise<void> {
    await db.delete(notices).where(eq(notices.id, id));
  }

  // student_dues table me school_id column NAHI hai — dues student se
  // link hain, isliye school ke students ke unpaid dues jode jate hain.
  async getPendingDuesTotal(schoolId: number): Promise<number> {
    const schoolStudents = await db.select().from(students).where(eq(students.schoolId, schoolId));
    const studentIds = new Set(schoolStudents.map((s) => s.id));
    if (studentIds.size === 0) return 0;
    const unpaid = await db.select().from(studentDues).where(eq(studentDues.isPaid, 0));
    return unpaid
      .filter((due) => studentIds.has(due.studentId))
      .reduce((sum, due) => sum + (due.amount ?? 0), 0);
  }

  async getFinancialSummary(schoolId: number): Promise<{
    totalFeesCollected: number;
    totalSalaryPaid: number;
    totalExpenses: number;
    balance: number;
    pendingDuesTotal: number;
  }> {
    const payments = await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
    const totalFeesCollected = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const salaries = await db.select().from(salaryPayments).where(eq(salaryPayments.schoolId, schoolId));
    const totalSalaryPaid = salaries.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const expenseRows = await db.select().from(expenses).where(eq(expenses.schoolId, schoolId));
    const totalExpenses = expenseRows.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    const pendingDuesTotal = await this.getPendingDuesTotal(schoolId);
    return {
      totalFeesCollected,
      totalSalaryPaid,
      totalExpenses,
      balance: totalFeesCollected - totalSalaryPaid - totalExpenses,
      pendingDuesTotal,
    };
  }

  async getFinancialTrend(schoolId: number): Promise<Array<{
    month: string;
    year: number;
    feesCollected: number;
    salaryPaid: number;
    expenses: number;
  }>> {
    const MONTH_ORDER = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const monthIndex = (name: string) => MONTH_ORDER.indexOf(name);
    const byKey = new Map<string, { month: string; year: number; feesCollected: number; salaryPaid: number; expenses: number }>();
    const bucket = (month: string, year: number) => {
      const key = `${year}|${month}`;
      let row = byKey.get(key);
      if (!row) {
        row = { month, year, feesCollected: 0, salaryPaid: 0, expenses: 0 };
        byKey.set(key, row);
      }
      return row;
    };

    const payments = await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
    for (const p of payments) bucket(p.month, p.year).feesCollected += p.amount ?? 0;

    const salaries = await db.select().from(salaryPayments).where(eq(salaryPayments.schoolId, schoolId));
    for (const s of salaries) bucket(s.month, s.year).salaryPaid += s.amount ?? 0;

    // Expenses ki date text hai ("2026-09-15") — month/year wahi se.
    const CALENDAR_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const expenseRows = await db.select().from(expenses).where(eq(expenses.schoolId, schoolId));
    for (const e of expenseRows) {
      if (!e.expenseDate) continue;
      const parsed = new Date(e.expenseDate);
      if (Number.isNaN(parsed.getTime())) continue;
      bucket(CALENDAR_MONTHS[parsed.getMonth()], parsed.getFullYear()).expenses += e.amount ?? 0;
    }

    return [...byKey.values()].sort(
      (a, b) => a.year - b.year || monthIndex(a.month) - monthIndex(b.month),
    );
  }

  async getDashboardStats(schoolId: number): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalStaff: number;
    todayCollection: number;
    monthCollection: number;
    pendingDuesTotal: number;
  }> {
    const allStudents = await db.select().from(students).where(eq(students.schoolId, schoolId));
    const activeStudents = allStudents.filter((s) => s.isActive === 1).length;
    const staffRows = await this.getStaff(schoolId);
    const payments = await db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId));
    const now = new Date();
    const sameDay = (d: Date | null) =>
      d != null &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const todayCollection = payments
      .filter((p) => sameDay(p.paymentDate))
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const CALENDAR_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = CALENDAR_MONTHS[now.getMonth()];
    const monthCollection = payments
      .filter((p) => p.month === currentMonth && p.year === now.getFullYear())
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const pendingDuesTotal = await this.getPendingDuesTotal(schoolId);
    return {
      totalStudents: allStudents.length,
      activeStudents,
      totalStaff: staffRows.length,
      todayCollection,
      monthCollection,
      pendingDuesTotal,
    };
  }
}

// 3. Mock Storage
export class MockStorage implements IStorage {
  private usersData: User[] = [];
  private parentStudentsData: ParentStudent[] = [];
  private schoolsData: School[] = [
    {
      id: 1,
      name: "Offline Demo School",
      logo: null,
      address: "Local Development",
      phone: "",
      email: null,
      primaryColor: "#1976D2",
      secondaryColor: "#FF9800",
      session: null,
      admissionPrefix: "SCHOOL",
      admissionYear: null,
      admissionStart: 1,
      isActive: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  private studentsData: Student[] = [];
  private feeStructuresData: FeeStructure[] = [];
  private feePaymentsData: FeePayment[] = [];
  private staffData: Staff[] = [];
  // Phase 2 parity (batch 2c) — mock bhi DatabaseStorage ke saare
  // naye methods implement karega, warna USE_MOCK_STORAGE=1 dev mode
  // me parity endpoints chalenge hi nahi.
  private studentDuesData: StudentDues[] = [];
  private examsData: Exam[] = [];
  private marksData: Mark[] = [];
  private attendanceData: Attendance[] = [];
  private transportRoutesData: TransportRoute[] = [];
  private additionalFeesData: AdditionalFee[] = [];
  private salaryPaymentsData: SalaryPayment[] = [];
  private expensesData: Expense[] = [];
  private studentDocumentsData: StudentDocument[] = [];
  private staffDocumentsData: StaffDocument[] = [];
  private noticesData: Notice[] = [];

  private nextUserId = 1;
  private nextSchoolId = 2;
  private nextStudentId = 1;
  private nextFeeStructureId = 1;
  private nextFeePaymentId = 1;
  private nextStaffId = 1;
  private nextStudentDueId = 1;
  private nextExamId = 1;
  private nextMarkId = 1;
  private nextAttendanceId = 1;
  private nextTransportRouteId = 1;
  private nextAdditionalFeeId = 1;
  private nextSalaryPaymentId = 1;
  private nextExpenseId = 1;
  private nextStudentDocumentId = 1;
  private nextStaffDocumentId = 1;
  private nextNoticeId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.find((item) => item.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersData.find((item) => item.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const created: User = {
      id: this.nextUserId++,
      schoolId: user.schoolId ?? null,
      username: user.username,
      password: user.password,
      role: user.role ?? "staff",
      name: user.name,
      phone: user.phone ?? null,
      mustChangePassword: user.mustChangePassword ?? 0,
      lastLoginAt: null,
      isActive: user.isActive ?? 1,
      createdAt: new Date(),
    };
    this.usersData.push(created);
    return created;
  }

  async getUsers(): Promise<User[]> {
    return [...this.usersData];
  }

  async getUsersBySchool(schoolId: number): Promise<User[]> {
    return this.usersData.filter((item) => item.schoolId === schoolId);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return this.usersData.find((item) => item.phone === phone);
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const index = this.usersData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("User not found");
    const updated: User = { ...this.usersData[index], ...user };
    this.usersData[index] = updated;
    return updated;
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<User> {
    return this.updateUser(id, { password: passwordHash });
  }

  async setMustChangePassword(id: number, value: number): Promise<void> {
    const user = this.usersData.find((item) => item.id === id);
    if (user) user.mustChangePassword = value;
  }

  async updateLastLogin(id: number): Promise<void> {
    const user = this.usersData.find((item) => item.id === id);
    if (user) user.lastLoginAt = new Date();
  }

  async linkParentStudent(link: InsertParentStudent): Promise<ParentStudent> {
    const existing = this.parentStudentsData.find(
      (item) => item.parentUserId === link.parentUserId && item.studentId === link.studentId
    );
    if (existing) return existing;
    const created: ParentStudent = {
      parentUserId: link.parentUserId,
      studentId: link.studentId,
      relation: link.relation ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.parentStudentsData.push(created);
    return created;
  }

  async getParentStudentLinks(parentUserId: number): Promise<ParentStudent[]> {
    return this.parentStudentsData.filter((item) => item.parentUserId === parentUserId);
  }

  async replaceParentStudentLinks(parentUserId: number, studentIds: number[], relation?: string | null): Promise<ParentStudent[]> {
    this.parentStudentsData = this.parentStudentsData.filter((item) => item.parentUserId !== parentUserId);
    for (const studentId of studentIds) {
      await this.linkParentStudent({ parentUserId, studentId, relation: relation ?? null });
    }
    return this.getParentStudentLinks(parentUserId);
  }

  async getSchools(): Promise<School[]> {
    return [...this.schoolsData];
  }

  async getSchool(id: number): Promise<School | undefined> {
    return this.schoolsData.find((item) => item.id === id);
  }

  async createSchool(school: InsertSchool): Promise<School> {
    const created: School = {
      id: this.nextSchoolId++,
      name: school.name,
      logo: school.logo ?? null,
      address: school.address,
      phone: school.phone,
      email: school.email ?? null,
      primaryColor: school.primaryColor ?? "#1976D2",
      secondaryColor: school.secondaryColor ?? "#FF9800",
      session: school.session ?? null,
      admissionPrefix: school.admissionPrefix ?? "SCHOOL",
      admissionYear: school.admissionYear ?? null,
      admissionStart: school.admissionStart ?? 1,
      isActive: school.isActive ?? 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.schoolsData.push(created);
    return created;
  }

  async updateSchool(id: number, school: Partial<InsertSchool>): Promise<School> {
    const index = this.schoolsData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("School not found");
    const updated: School = { ...this.schoolsData[index], ...school };
    this.schoolsData[index] = updated;
    return updated;
  }

  async getStudent(id: number): Promise<Student | undefined> {
    return this.studentsData.find((item) => item.id === id);
  }

  async getStudents(schoolId: number, filters?: { class?: string; section?: string; search?: string }): Promise<Student[]> {
    let rows = this.studentsData.filter((item) => item.schoolId === schoolId && item.isActive === 1);
    if (filters?.class && filters.class !== "all") rows = rows.filter((item) => item.class === filters.class);
    if (filters?.section && filters.section !== "all") rows = rows.filter((item) => item.section === filters.section);
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      // Naam + admission no ke saath contact (mobile) bhi — DatabaseStorage
      // wali search se parity ke liye.
      rows = rows.filter((item) => item.name.toLowerCase().includes(search) || item.admissionNo.toLowerCase().includes(search) || (item.contact ?? "").toLowerCase().includes(search));
    }
    return rows;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const created: Student = {
      id: this.nextStudentId++, schoolId: student.schoolId ?? 1, admissionNo: student.admissionNo,
      name: student.name, fatherName: student.fatherName, motherName: student.motherName ?? null,
      class: student.class, section: student.section, rollNo: student.rollNo ?? null,
      aadhaar: student.aadhaar ?? null, birthCertificateNo: student.birthCertificateNo ?? null,
      previousSchoolName: student.previousSchoolName ?? null, previousClass: student.previousClass ?? null,
      tcNumber: student.tcNumber ?? null, tcIssueDate: student.tcIssueDate ?? null,
      tcSubmitted: student.tcSubmitted ?? 0, reportCardSubmitted: student.reportCardSubmitted ?? 0,
      category: student.category ?? null, transportId: student.transportId ?? null,
      dob: student.dob ?? null, contact: student.contact,
      address: student.address ?? null, photo: student.photo ?? null, isActive: student.isActive ?? 1,
      isPromoted: student.isPromoted ?? 0, createdAt: new Date(), updatedAt: new Date(),
    };
    this.studentsData.push(created);
    return created;
  }

  async updateStudent(id: number, student: Partial<InsertStudent>): Promise<Student> {
    const index = this.studentsData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Student not found");
    const updated: Student = { ...this.studentsData[index], ...student };
    this.studentsData[index] = updated;
    return updated;
  }

  async promoteStudents(studentIds: number[], targetClass: string): Promise<void> {
    this.studentsData = this.studentsData.map((item) => studentIds.includes(item.id) ? { ...item, class: targetClass, isPromoted: 1 } : item);
  }

  async getFeeStructures(schoolId: number): Promise<FeeStructure[]> {
    return this.feeStructuresData.filter((item) => item.schoolId === schoolId);
  }

  async createFeeStructure(structure: InsertFeeStructure): Promise<FeeStructure> {
    const created: FeeStructure = { id: this.nextFeeStructureId++, schoolId: structure.schoolId ?? 1, class: structure.class, monthlyFee: structure.monthlyFee, admissionFee: structure.admissionFee ?? 0, examFee: structure.examFee ?? 0, otherFee: structure.otherFee ?? 0, createdAt: new Date() };
    this.feeStructuresData.push(created);
    return created;
  }

  async getFeePayments(schoolId: number, studentId?: number): Promise<FeePayment[]> {
    return studentId ? this.feePaymentsData.filter(i => i.studentId === studentId) : this.feePaymentsData.filter(i => i.schoolId === schoolId);
  }

  async createFeePayment(payment: InsertFeePayment): Promise<FeePayment> {
    const created: FeePayment = { id: this.nextFeePaymentId++, studentId: payment.studentId ?? null, schoolId: payment.schoolId ?? 1, amount: payment.amount, month: payment.month, year: payment.year, paymentDate: new Date(), receiptNo: payment.receiptNo, paymentMethod: payment.paymentMethod ?? "Cash", remarks: payment.remarks ?? null, breakdown: payment.breakdown ?? null, createdAt: new Date() };
    this.feePaymentsData.push(created);
    return created;
  }

  async getDefaulters(schoolId: number, classStr?: string): Promise<{ studentId: number; name: string; amountPending: number }[]> { return []; }

  async getStaff(schoolId: number, options?: { includeInactive?: boolean }): Promise<Staff[]> {
    if (options?.includeInactive) {
      return this.staffData.filter((item) => item.schoolId === schoolId);
    }
    return this.staffData.filter((item) => item.schoolId === schoolId && item.isActive === 1);
  }

  async createStaff(staffMember: InsertStaff): Promise<Staff> {
    const created: Staff = { id: this.nextStaffId++, schoolId: staffMember.schoolId ?? 1, employeeId: staffMember.employeeId ?? null, name: staffMember.name, fatherName: staffMember.fatherName ?? null, designation: staffMember.designation, department: staffMember.department ?? null, qualification: staffMember.qualification ?? null, experience: staffMember.experience ?? null, address: staffMember.address ?? null, contact: staffMember.contact, email: staffMember.email ?? null, basicSalary: staffMember.basicSalary, advanceGiven: staffMember.advanceGiven ?? 0, joinDate: staffMember.joinDate ?? null, isActive: staffMember.isActive ?? 1, createdAt: new Date(), updatedAt: new Date() };
    this.staffData.push(created);
    return created;
  }

  async getStudentStatus(studentId: number, classStr: string, year: number) {
     // Phase 3 Batch A fix: pehle ye sirf ek stub tha (hamesha
     // admissionPaid: true, khali months). Ab DatabaseStorage wala hi
     // hisaab in-memory data par chalta hai — wahi shared helper
     // (breakdown + remarks dono raaste), wahi return shape.
     const student = this.studentsData.find(i => i.id === studentId);
     if (!student) throw new Error("Student not found");
     const feeStructure = this.feeStructuresData.find(i => i.schoolId === student.schoolId && i.class === classStr);
     if (!feeStructure) {
       return { admissionPaid: false, admissionBalance: 0, admissionPaidSoFar: 0, admissionTotal: 0, monthStatus: [], pendingDues: [], monthlyFee: 0 };
     }
     const payments = this.feePaymentsData.filter(i => i.studentId === studentId && i.year === year);
     const { months, admissionPaidSoFar } = summarizePaymentsForStatus(payments);
     const admissionTotal = feeStructure.admissionFee ?? 0;
     const admissionBalance = Math.max(0, admissionTotal - admissionPaidSoFar);
     const pendingDues = this.studentDuesData
       .filter(d => d.studentId === studentId && d.isPaid === 0)
       .map(d => ({
         id: d.id,
         fee_name: d.feeName,
         due_date: d.dueDate instanceof Date ? d.dueDate.toISOString() : String(d.dueDate),
         amount: d.amount,
       }));
     return { admissionPaid: admissionBalance === 0, admissionBalance, admissionPaidSoFar, admissionTotal, monthStatus: months, pendingDues, monthlyFee: feeStructure.monthlyFee ?? 0 };
  }

  // -------------------------------------------------------------------
  // Phase 2 parity implementations (batch 2c) — MockStorage
  // (DatabaseStorage wale hi semantics, in-memory arrays par.)
  // -------------------------------------------------------------------

  async getStudentByAdmissionNo(schoolId: number, admissionNo: string): Promise<Student | undefined> {
    return this.studentsData.find((item) => item.schoolId === schoolId && item.admissionNo === admissionNo);
  }

  async getNextAdmissionNo(schoolId: number): Promise<string> {
    const school = this.schoolsData.find((item) => item.id === schoolId);
    const prefix = school?.admissionPrefix ?? "SCHOOL";
    const yearPart = school?.admissionYear ? `/${school.admissionYear}` : "";
    const start = school?.admissionStart ?? 1;
    let max = start - 1;
    for (const row of this.studentsData.filter((item) => item.schoolId === schoolId)) {
      const lastPart = row.admissionNo.split("/").pop() ?? "";
      const n = parseInt(lastPart, 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    const next = Math.max(start, max + 1);
    return `${prefix}${yearPart}/${String(next).padStart(4, "0")}`;
  }

  async getNextReceiptNo(schoolId: number): Promise<string> {
    let max = 0;
    for (const row of this.feePaymentsData.filter((item) => item.schoolId === schoolId)) {
      const match = /(\d+)\s*$/.exec(row.receiptNo);
      if (match) {
        const n = parseInt(match[1], 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
    }
    return `RCP-${String(max + 1).padStart(5, "0")}`;
  }

  async getStudentDocuments(studentId: number): Promise<StudentDocument[]> {
    return this.studentDocumentsData.filter((item) => item.studentId === studentId);
  }

  async getStudentDocument(id: number): Promise<StudentDocument | undefined> {
    return this.studentDocumentsData.find((item) => item.id === id);
  }

  async createStudentDocument(doc: InsertStudentDocument): Promise<StudentDocument> {
    const created: StudentDocument = {
      id: this.nextStudentDocumentId++, schoolId: doc.schoolId ?? null,
      studentId: doc.studentId, docType: doc.docType ?? null,
      fileName: doc.fileName, filePath: doc.filePath ?? null,
      fileData: doc.fileData ?? null, mimeType: doc.mimeType ?? null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    this.studentDocumentsData.push(created);
    return created;
  }

  async deleteStudentDocument(id: number): Promise<void> {
    this.studentDocumentsData = this.studentDocumentsData.filter((item) => item.id !== id);
  }

  async getStaffDocuments(staffId: number): Promise<StaffDocument[]> {
    return this.staffDocumentsData.filter((item) => item.staffId === staffId);
  }

  async getStaffDocument(id: number): Promise<StaffDocument | undefined> {
    return this.staffDocumentsData.find((item) => item.id === id);
  }

  async createStaffDocument(doc: InsertStaffDocument): Promise<StaffDocument> {
    const created: StaffDocument = {
      id: this.nextStaffDocumentId++, schoolId: doc.schoolId ?? null,
      staffId: doc.staffId, docType: doc.docType ?? null,
      fileName: doc.fileName, filePath: doc.filePath ?? null,
      fileData: doc.fileData ?? null, mimeType: doc.mimeType ?? null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    this.staffDocumentsData.push(created);
    return created;
  }

  async deleteStaffDocument(id: number): Promise<void> {
    this.staffDocumentsData = this.staffDocumentsData.filter((item) => item.id !== id);
  }

  async updateFeeStructure(id: number, structure: Partial<InsertFeeStructure>): Promise<FeeStructure> {
    const index = this.feeStructuresData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Fee structure not found");
    const updated: FeeStructure = { ...this.feeStructuresData[index], ...structure };
    this.feeStructuresData[index] = updated;
    return updated;
  }

  async deleteFeeStructure(id: number): Promise<void> {
    this.feeStructuresData = this.feeStructuresData.filter((item) => item.id !== id);
  }

  async deleteFeePayment(id: number): Promise<void> {
    this.feePaymentsData = this.feePaymentsData.filter((item) => item.id !== id);
  }

  async getStudentDues(studentId: number): Promise<StudentDues[]> {
    return this.studentDuesData.filter((item) => item.studentId === studentId);
  }

  async getStudentDue(id: number): Promise<StudentDues | undefined> {
    return this.studentDuesData.find((item) => item.id === id);
  }

  async createStudentDue(due: InsertStudentDues): Promise<StudentDues> {
    const created: StudentDues = {
      id: this.nextStudentDueId++, studentId: due.studentId,
      feeName: due.feeName, amount: due.amount, dueDate: due.dueDate,
      isPaid: due.isPaid ?? 0, createdAt: new Date(), updatedAt: new Date(),
    };
    this.studentDuesData.push(created);
    return created;
  }

  async updateStudentDue(id: number, dueUpdate: Partial<InsertStudentDues>): Promise<StudentDues | undefined> {
    const index = this.studentDuesData.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    const updated: StudentDues = { ...this.studentDuesData[index], ...dueUpdate };
    this.studentDuesData[index] = updated;
    return updated;
  }

  async deleteStudentDue(id: number): Promise<void> {
    this.studentDuesData = this.studentDuesData.filter((item) => item.id !== id);
  }

  async getAdditionalFees(schoolId: number): Promise<AdditionalFee[]> {
    return this.additionalFeesData.filter((item) => item.schoolId === schoolId);
  }

  async getAdditionalFee(id: number): Promise<AdditionalFee | undefined> {
    return this.additionalFeesData.find((item) => item.id === id);
  }

  async createAdditionalFee(fee: InsertAdditionalFee): Promise<AdditionalFee> {
    const created: AdditionalFee = {
      id: this.nextAdditionalFeeId++, schoolId: fee.schoolId ?? null,
      class: fee.class, feeName: fee.feeName, amount: fee.amount,
      dueMonth: fee.dueMonth ?? null, createdAt: new Date(), updatedAt: new Date(),
    };
    this.additionalFeesData.push(created);
    return created;
  }

  async deleteAdditionalFee(id: number): Promise<void> {
    this.additionalFeesData = this.additionalFeesData.filter((item) => item.id !== id);
  }

  async getTransportRoutes(schoolId: number): Promise<TransportRoute[]> {
    return this.transportRoutesData.filter((item) => item.schoolId === schoolId);
  }

  async createTransportRoute(route: InsertTransportRoute): Promise<TransportRoute> {
    const created: TransportRoute = {
      id: this.nextTransportRouteId++, schoolId: route.schoolId ?? null,
      routeName: route.routeName, amount: route.amount ?? 0,
      createdAt: new Date(), updatedAt: new Date(),
    };
    this.transportRoutesData.push(created);
    return created;
  }

  async deleteTransportRoute(id: number): Promise<void> {
    this.transportRoutesData = this.transportRoutesData.filter((item) => item.id !== id);
  }

  async getStaffMember(id: number): Promise<Staff | undefined> {
    return this.staffData.find((item) => item.id === id);
  }

  async updateStaff(id: number, staffUpdate: Partial<InsertStaff>): Promise<Staff> {
    const index = this.staffData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Staff not found");
    const updated: Staff = { ...this.staffData[index], ...staffUpdate };
    this.staffData[index] = updated;
    return updated;
  }

  async getStaffSalaryHistory(staffId: number): Promise<SalaryPayment[]> {
    return this.salaryPaymentsData.filter((item) => item.staffId === staffId);
  }

  async getSalaryPayments(schoolId: number, month?: string, year?: number): Promise<SalaryPayment[]> {
    let rows = this.salaryPaymentsData.filter((item) => item.schoolId === schoolId);
    if (month) rows = rows.filter((item) => item.month === month);
    if (year != null) rows = rows.filter((item) => item.year === year);
    return rows;
  }

  async createSalaryPayment(payment: InsertSalaryPayment): Promise<SalaryPayment> {
    const created: SalaryPayment = {
      id: this.nextSalaryPaymentId++, schoolId: payment.schoolId ?? null,
      staffId: payment.staffId, month: payment.month, year: payment.year,
      amount: payment.amount,
      baseSalary: payment.baseSalary ?? null,
      bonus: payment.bonus ?? 0,
      deduction: payment.deduction ?? 0,
      paymentMode: payment.paymentMode ?? null,
      paymentDate: payment.paymentDate ?? null,
      remarks: payment.remarks ?? null, createdAt: new Date(), updatedAt: new Date(),
    };
    this.salaryPaymentsData.push(created);
    return created;
  }

  async deleteSalaryPayment(id: number): Promise<void> {
    this.salaryPaymentsData = this.salaryPaymentsData.filter((item) => item.id !== id);
  }

  async getExpenses(schoolId: number): Promise<Expense[]> {
    return this.expensesData.filter((item) => item.schoolId === schoolId);
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    return this.expensesData.find((item) => item.id === id);
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const created: Expense = {
      id: this.nextExpenseId++, schoolId: expense.schoolId ?? null,
      title: expense.title, category: expense.category ?? null,
      amount: expense.amount, expenseDate: expense.expenseDate ?? null,
      remarks: expense.remarks ?? null, createdAt: new Date(), updatedAt: new Date(),
    };
    this.expensesData.push(created);
    return created;
  }

  async deleteExpense(id: number): Promise<void> {
    this.expensesData = this.expensesData.filter((item) => item.id !== id);
  }

  async getExams(schoolId: number): Promise<Exam[]> {
    return this.examsData.filter((item) => item.schoolId === schoolId);
  }

  async getExam(id: number): Promise<Exam | undefined> {
    return this.examsData.find((item) => item.id === id);
  }

  async createExam(exam: InsertExam): Promise<Exam> {
    const created: Exam = {
      id: this.nextExamId++, schoolId: exam.schoolId ?? null,
      examName: exam.examName, examType: exam.examType ?? null,
      class: exam.class, section: exam.section ?? null,
      subject: exam.subject ?? null, maxMarks: exam.maxMarks ?? 100,
      passingMarks: exam.passingMarks ?? null, examDate: exam.examDate ?? null,
      session: exam.session ?? null, createdAt: new Date(), updatedAt: new Date(),
    };
    this.examsData.push(created);
    return created;
  }

  async deleteExam(id: number): Promise<void> {
    this.marksData = this.marksData.filter((item) => item.examId !== id);
    this.examsData = this.examsData.filter((item) => item.id !== id);
  }

  async getExamMarks(examId: number): Promise<Mark[]> {
    return this.marksData.filter((item) => item.examId === examId);
  }

  async getMarksForStudents(examId: number, studentIds: number[]): Promise<Mark[]> {
    return this.marksData.filter((item) => item.examId === examId && studentIds.includes(item.studentId));
  }

  async saveExamMarks(examId: number, schoolId: number, entries: Array<{ studentId: number; marksObtained: number | null; remarks?: string | null }>): Promise<Mark[]> {
    const saved: Mark[] = [];
    for (const entry of entries) {
      const existing = this.marksData.find((item) => item.examId === examId && item.studentId === entry.studentId);
      if (existing) {
        existing.marksObtained = entry.marksObtained;
        existing.remarks = entry.remarks ?? null;
        existing.updatedAt = new Date();
        saved.push(existing);
      } else {
        const created: Mark = {
          id: this.nextMarkId++, schoolId, examId, studentId: entry.studentId,
          marksObtained: entry.marksObtained, remarks: entry.remarks ?? null,
          createdAt: new Date(), updatedAt: new Date(),
        };
        this.marksData.push(created);
        saved.push(created);
      }
    }
    return saved;
  }

  async getStudentMarks(studentId: number): Promise<Mark[]> {
    return this.marksData.filter((item) => item.studentId === studentId);
  }

  async markAttendanceBulk(schoolId: number, markedBy: number, date: string, entries: Array<{ studentId: number; status: string; remarks?: string | null }>): Promise<Attendance[]> {
    const saved: Attendance[] = [];
    for (const entry of entries) {
      const existing = this.attendanceData.find(
        (item) => item.studentId === entry.studentId && item.date === date,
      );
      if (existing) {
        existing.status = entry.status;
        existing.markedBy = markedBy;
        existing.remarks = entry.remarks ?? null;
        existing.updatedAt = new Date();
        saved.push(existing);
      } else {
        const created: Attendance = {
          id: this.nextAttendanceId++, schoolId, studentId: entry.studentId,
          date, status: entry.status, markedBy, remarks: entry.remarks ?? null,
          createdAt: new Date(), updatedAt: new Date(),
        };
        this.attendanceData.push(created);
        saved.push(created);
      }
    }
    return saved;
  }

  async getAttendanceForStudents(studentIds: number[], date: string): Promise<Attendance[]> {
    return this.attendanceData.filter(
      (item) => item.date === date && studentIds.includes(item.studentId),
    );
  }

  async getStudentAttendance(studentId: number, monthPrefix?: string): Promise<Attendance[]> {
    return this.attendanceData
      .filter(
        (item) =>
          item.studentId === studentId &&
          (!monthPrefix || item.date.startsWith(monthPrefix)),
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  async getStudentAttendanceSummary(studentId: number, monthPrefix: string): Promise<{
    month: string;
    totalMarked: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    percentage: number;
  }> {
    const rows = await this.getStudentAttendance(studentId, monthPrefix);
    return summarizeAttendance(monthPrefix, rows);
  }

  async getNotices(schoolId: number): Promise<Notice[]> {
    return this.noticesData.filter((item) => item.schoolId === schoolId);
  }

  async getNotice(id: number): Promise<Notice | undefined> {
    return this.noticesData.find((item) => item.id === id);
  }

  async createNotice(notice: InsertNotice): Promise<Notice> {
    const created: Notice = {
      id: this.nextNoticeId++, schoolId: notice.schoolId ?? null,
      title: notice.title, body: notice.body ?? null,
      audience: notice.audience ?? "all", createdBy: notice.createdBy ?? null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    this.noticesData.push(created);
    return created;
  }

  async updateNotice(id: number, noticeUpdate: Partial<InsertNotice>): Promise<Notice> {
    const index = this.noticesData.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("Notice not found");
    const updated: Notice = { ...this.noticesData[index], ...noticeUpdate };
    this.noticesData[index] = updated;
    return updated;
  }

  async deleteNotice(id: number): Promise<void> {
    this.noticesData = this.noticesData.filter((item) => item.id !== id);
  }

  async getPendingDuesTotal(schoolId: number): Promise<number> {
    const studentIds = new Set(
      this.studentsData.filter((item) => item.schoolId === schoolId).map((item) => item.id),
    );
    return this.studentDuesData
      .filter((item) => item.isPaid === 0 && studentIds.has(item.studentId))
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }

  async getFinancialSummary(schoolId: number): Promise<{
    totalFeesCollected: number;
    totalSalaryPaid: number;
    totalExpenses: number;
    balance: number;
    pendingDuesTotal: number;
  }> {
    const totalFeesCollected = this.feePaymentsData
      .filter((item) => item.schoolId === schoolId)
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const totalSalaryPaid = this.salaryPaymentsData
      .filter((item) => item.schoolId === schoolId)
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const totalExpenses = this.expensesData
      .filter((item) => item.schoolId === schoolId)
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const pendingDuesTotal = await this.getPendingDuesTotal(schoolId);
    return {
      totalFeesCollected,
      totalSalaryPaid,
      totalExpenses,
      balance: totalFeesCollected - totalSalaryPaid - totalExpenses,
      pendingDuesTotal,
    };
  }

  async getFinancialTrend(schoolId: number): Promise<Array<{
    month: string;
    year: number;
    feesCollected: number;
    salaryPaid: number;
    expenses: number;
  }>> {
    const MONTH_ORDER = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const CALENDAR_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const byKey = new Map<string, { month: string; year: number; feesCollected: number; salaryPaid: number; expenses: number }>();
    const bucket = (month: string, year: number) => {
      const key = `${year}|${month}`;
      let row = byKey.get(key);
      if (!row) {
        row = { month, year, feesCollected: 0, salaryPaid: 0, expenses: 0 };
        byKey.set(key, row);
      }
      return row;
    };
    for (const p of this.feePaymentsData.filter((item) => item.schoolId === schoolId)) {
      bucket(p.month, p.year).feesCollected += p.amount ?? 0;
    }
    for (const s of this.salaryPaymentsData.filter((item) => item.schoolId === schoolId)) {
      bucket(s.month, s.year).salaryPaid += s.amount ?? 0;
    }
    for (const e of this.expensesData.filter((item) => item.schoolId === schoolId)) {
      if (!e.expenseDate) continue;
      const parsed = new Date(e.expenseDate);
      if (Number.isNaN(parsed.getTime())) continue;
      bucket(CALENDAR_MONTHS[parsed.getMonth()], parsed.getFullYear()).expenses += e.amount ?? 0;
    }
    return [...byKey.values()].sort(
      (a, b) => a.year - b.year || MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month),
    );
  }

  async getDashboardStats(schoolId: number): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalStaff: number;
    todayCollection: number;
    monthCollection: number;
    pendingDuesTotal: number;
  }> {
    const allStudents = this.studentsData.filter((item) => item.schoolId === schoolId);
    const activeStudents = allStudents.filter((item) => item.isActive === 1).length;
    const totalStaff = this.staffData.filter((item) => item.schoolId === schoolId && item.isActive === 1).length;
    const now = new Date();
    const sameDay = (d: Date | null) =>
      d != null &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const schoolPayments = this.feePaymentsData.filter((item) => item.schoolId === schoolId);
    const todayCollection = schoolPayments
      .filter((item) => sameDay(item.paymentDate))
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const CALENDAR_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = CALENDAR_MONTHS[now.getMonth()];
    const monthCollection = schoolPayments
      .filter((item) => item.month === currentMonth && item.year === now.getFullYear())
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const pendingDuesTotal = await this.getPendingDuesTotal(schoolId);
    return {
      totalStudents: allStudents.length,
      activeStudents,
      totalStaff,
      todayCollection,
      monthCollection,
      pendingDuesTotal,
    };
  }
}

// 4. Export Instance
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
// MockStorage is ONLY for explicit local development (USE_MOCK_STORAGE=1).
// It must never be selected silently: its data is in-memory and is lost on
// restart, which would silently discard a school's real records.
const useMockStorage = process.env.USE_MOCK_STORAGE === "1";
if (!useMockStorage && !hasDatabaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Set it, or set USE_MOCK_STORAGE=1 for throwaway local development."
  );
}
export const storage: IStorage = useMockStorage ? new MockStorage() : new DatabaseStorage();