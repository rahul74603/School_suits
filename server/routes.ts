import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  storage,
  generateUniqueSchoolCode,
  normalizeSchoolCode,
  type SchoolExportData,
} from "./storage";
import {
  insertSchoolSchema,
  insertStudentSchema,
  insertFeeStructureSchema,
  insertFeePaymentSchema,
  insertStaffSchema,
  userRoleSchema,
  noticeAudienceSchema,
  attendanceStatusSchema,
  resultStatusSchema,
  schoolPlanSchema,
  type User,
  type UserRole,
  type Student,
  type Staff,
  type StudentDues,
  type LeaveRequest,
  type PaymentProof,
} from "@shared/schema";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  requireAuth,
  requireRole,
  verifyAccessToken,
} from "./auth";

// ---------------------------------------------------------------------------
// Phase 2 batch 2 — auth routes (§5.1), provisioning (§5.2/§5.3, rollout
// steps 4 + 6) aur purane 12 routes ki hifazat (rollout step 5).
//
// Sabse important niyam (§3.1): schoolId hamesha login token se aayega.
// Client jo schoolId bheje wo IGNORE hoga — sirf Super Admin (jiska khud
// ka koi school nahi hota) ke liye query/body wala schoolId mana jayega.
// Password hash kisi bhi response me kabhi nahi jayega (serializeUser).
// ---------------------------------------------------------------------------

// User serializer — users table ki row se sirf safe fields.
// `password` (scrypt hash) is list me jaan-bujh kar NAHI hai (§6).
function serializeUser(user: User) {
  return {
    id: user.id,
    schoolId: user.schoolId,
    username: user.username,
    role: user.role,
    name: user.name,
    phone: user.phone,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

// Staff serializer (§3 footnote ‡): salary wali fields (basicSalary,
// advanceGiven) sirf principal/accountant ko dikhengi. Teacher/staff
// (aur koi bhi aur role) ko ye fields response me MILENGI HI NAHI —
// value chhupana kaafi nahi, field hi gayab rahegi.
function serializeStaffFor(member: Staff, role: string | undefined) {
  if (role === "principal" || role === "accountant") return member;
  const { basicSalary, advanceGiven, ...safe } = member;
  return safe;
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  // School Code (v2.2): Parent App hamesha bhejta hai — server usi
  // school se user ka milan pakka karta hai (galat code = wahi generic
  // 401, kuch leak nahi). School/Master app NAHI bhejte — unke liye
  // bartav bilkul pehle jaisa.
  schoolCode: z.string().min(1).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// §5.2: school ke saath uska pehla Principal bhi banta hai.
const createSchoolWithPrincipalSchema = insertSchoolSchema.extend({
  principal: z.object({
    username: z.string().min(3),
    name: z.string().min(1),
    phone: z.string().min(5).optional(),
    temporaryPassword: z.string().min(8),
  }),
});

const updateSchoolSchema = insertSchoolSchema.partial();

// §5.3: naya account. `temporaryPassword` plain aata hai, server use
// scrypt hash karke store karta hai; schoolId principal ke liye token se
// zabardasti lagega, sirf super_admin body wala schoolId de sakta hai.
const createUserSchema = z.object({
  username: z.string().min(3),
  name: z.string().min(1),
  role: userRoleSchema,
  phone: z.string().min(5).optional(),
  temporaryPassword: z.string().min(8),
  schoolId: z.number().int().positive().optional(),
  studentIds: z.array(z.number().int().positive()).optional(),
  relation: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).nullable().optional(),
  studentIds: z.array(z.number().int().positive()).optional(),
  relation: z.string().optional(),
});

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).optional(),
});

// ---------------------------------------------------------------------------
// Phase 2 parity (batch 2c, rollout steps 7–8) ke request schemas.
// ---------------------------------------------------------------------------

// Student update: insert schema ka partial roop (shared/routes.ts ke
// contract jaisa). schoolId body se aaye to bhi route use ignore karega.
const updateStudentBodySchema = insertStudentSchema.partial();

const promoteStudentsSchema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1),
  targetClass: z.string().min(1),
});

const studentTransportSchema = z.object({
  // null bhejne par transport link hat jayega.
  transportId: z.number().int().positive().nullable(),
});

const createDocumentSchema = z.object({
  docType: z.string().min(1).optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1).optional(),
  // Phase 3 Batch C — asli file content (base64). Optional hai taaki
  // Phase 2 wale metadata-only clients bhi chalte rahen.
  base64Data: z.string().min(1).optional(),
  mimeType: z.string().min(1).optional(),
});

// Staff documents (Phase 3 Batch C) — Electron ka upload-staff-document
// hamesha file content bhejta tha, isliye yahan base64Data lazmi hai.
const createStaffDocumentSchema = z.object({
  docType: z.string().min(1).optional(),
  fileName: z.string().min(1),
  filePath: z.string().min(1).optional(),
  base64Data: z.string().min(1),
  mimeType: z.string().min(1).optional(),
});

// Document file ki size limit (v1): asal file ~2MB. Base64 usse ~4/3
// guna badi hoti hai, isliye ginna decoded size par hota hai.
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

function estimateBase64Bytes(base64Data: string): number {
  const clean = base64Data.replace(/\s+/g, "");
  if (clean.length === 0) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function documentTooLarge(base64Data: string): boolean {
  return estimateBase64Bytes(base64Data) > MAX_DOCUMENT_BYTES;
}

// List/create ke jawab me file ka content (base64) KABHI nahi bhejta —
// sirf metadata + hasFile. Content sirf /file wale endpoint se milta hai.
function documentMeta<T extends { fileData?: string | null }>(
  doc: T,
): Omit<T, "fileData"> & { hasFile: boolean } {
  const { fileData, ...rest } = doc;
  return { ...rest, hasFile: Boolean(fileData) };
}

const createDueSchema = z.object({
  feeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
  // "2026-09-30" jaisi date string; route Date me badal kar store karega
  // (student_dues.due_date timestamp column hai).
  dueDate: z.string().min(1),
  isPaid: z.number().int().min(0).max(1).optional(),
});

const updateFeeStructureBodySchema = insertFeeStructureSchema.partial();

const createAdditionalFeeBodySchema = z.object({
  class: z.string().min(1),
  feeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
  dueMonth: z.string().min(1).optional(),
});

const createTransportRouteBodySchema = z.object({
  routeName: z.string().min(1),
  amount: z.number().int().nonnegative(),
  // v3.3: gaadi + driver ki jaankari (vaikalpik).
  vehicleNo: z.string().trim().max(50).optional().nullable(),
  driverName: z.string().trim().max(100).optional().nullable(),
  driverContact: z.string().trim().max(20).optional().nullable(),
});

// Route edit (v3.3) — saare khet vaikalpik, jo aaya wahi badlega.
const updateTransportRouteBodySchema = createTransportRouteBodySchema.partial();

const updateStaffBodySchema = insertStaffSchema.partial();

// Phase 3 Batch A fix — payment create ka body. Fees page `breakdown`
// ko OBJECT bhejta hai ({ extras: [{ name, amount, type, month }] }),
// jabki fee_payments.breakdown column text hai; isliye string / object /
// array teeno kubool hain aur route store karne se pehle JSON string me
// badalta hai (normalizePaymentBreakdown). Purane clients bina breakdown
// ke bhejte rahe to bhi chalega — field optional hai.
// `isAdmission` sirf payload flag hai, koi column nahi hai: route use
// breakdown JSON ke andar mehfooz kar deta hai taaki getStudentStatus
// admission balance ghatate waqt use padh sake.
const createFeePaymentBodySchema = insertFeePaymentSchema.extend({
  breakdown: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .nullable()
    .optional(),
  isAdmission: z.boolean().optional(),
  // Dues-fix batch — Fees page kisi pending custom due ke "Pay" se bill
  // banata hai to us due ki pehchan (dueId) aur is bill me uske liye di
  // gayi rakam (amount — bill me badli ja sakti hai, isliye due ki asal
  // rakam se alag bhejna zaroori hai) yahan aati hai. Payment bante hi
  // route in dues ko settle karta hai: poora paisa → is_paid = 1, kam
  // paisa → due ki rakam utni hi ghat jati hai (baaki pending rehta
  // hai). Field optional hai — purane clients bina iske bhejte rahe to
  // bhi chalega; unke dues pehle ki tarah pending hi rahenge. Column
  // koi nahi hai — ye bhi isAdmission ki tarah sirf payload hai.
  dueSettlements: z
    .array(
      z.object({
        dueId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

function normalizePaymentBreakdown(
  breakdown: string | unknown[] | Record<string, unknown> | null | undefined,
  isAdmission: boolean | undefined,
): string | undefined {
  if (breakdown == null) {
    // Breakdown nahi aaya lekin admission wali payment hai — flag ko
    // khali-extras wale JSON me mehfooz kar do, warna ye jaankari
    // hamesha ke liye kho jayegi.
    return isAdmission
      ? JSON.stringify({ extras: [], isAdmission: true })
      : undefined;
  }
  if (typeof breakdown === "string") {
    if (!isAdmission) return breakdown;
    try {
      const parsed = JSON.parse(breakdown);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return JSON.stringify({ ...parsed, isAdmission: true });
      }
    } catch {
      // String jaisi hai waisi rahegi; getStudentStatus ka parsing bhi
      // defensive hai.
    }
    return breakdown;
  }
  const obj: Record<string, unknown> = Array.isArray(breakdown)
    ? { extras: breakdown }
    : { ...breakdown };
  if (isAdmission) obj.isAdmission = true;
  return JSON.stringify(obj);
}

const createSalaryPaymentBodySchema = z.object({
  staffId: z.number().int().positive(),
  month: z.string().min(1),
  year: z.number().int(),
  amount: z.number().int().nonnegative(),
  // Phase 3 Batch C (GAP-B1) — breakup wale fields. Sab optional:
  // purane clients (aur Batch B ka remarks-wala tareeka) bina inke
  // bhejkar bhi chalte rahenge. `amount` hi net rakam hai — server
  // use in fields se dobara NAHI ginta.
  baseSalary: z.number().int().nonnegative().optional(),
  bonus: z.number().int().nonnegative().optional(),
  deduction: z.number().int().nonnegative().optional(),
  paymentMode: z.string().min(1).optional(),
  paymentDate: z.string().min(1).optional(),
  remarks: z.string().optional(),
});

const createExpenseBodySchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1).optional(),
  amount: z.number().int().nonnegative(),
  expenseDate: z.string().min(1).optional(),
  remarks: z.string().optional(),
});

const createExamBodySchema = z.object({
  examName: z.string().min(1),
  examType: z.string().min(1).optional(),
  class: z.string().min(1),
  section: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  maxMarks: z.number().int().positive().optional(),
  passingMarks: z.number().int().nonnegative().optional(),
  examDate: z.string().min(1).optional(),
  session: z.string().min(1).optional(),
});

const saveMarksBodySchema = z.object({
  marks: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        // null = is student ke marks abhi khaali karne hain / nahi bhare.
        marksObtained: z.number().nullable(),
        remarks: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

// Attendance bulk mark (v1.5) — saveMarksBodySchema wala hi pattern.
// date "YYYY-MM-DD" text hai (schema me examDate wali parampara).
const DATE_TEXT_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_TEXT_RE = /^\d{4}-\d{2}$/;

const markAttendanceBodySchema = z.object({
  date: z.string().regex(DATE_TEXT_RE),
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: attendanceStatusSchema,
        remarks: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

// Result approval (v1.7) — POST /api/exams/:id/results-status ka body.
const resultsStatusBodySchema = z.object({
  status: resultStatusSchema,
});

// Timetable upsert (v1.7) — din 1=Mon..6=Sat, period 1..8 (page par
// 8 period ka grid hai; isse bahar ki entry ka koi matlab nahi).
const upsertTimetableBodySchema = z.object({
  className: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(6),
  periodNo: z.number().int().min(1).max(8),
  subject: z.string().min(1),
  teacherId: z.number().int().positive().nullable().optional(),
});

const createNoticeBodySchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  audience: noticeAudienceSchema.optional(),
});

// Library (v1.7) — book catalog + issue/return ke body schemas.
// Tareekhein attendance wali hi parampara: "YYYY-MM-DD" text.
const createLibraryBookBodySchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1).nullable().optional(),
  copiesTotal: z.number().int().nonnegative().optional(),
});

const updateLibraryBookBodySchema = createLibraryBookBodySchema.partial();

const createLibraryIssueBodySchema = z.object({
  bookId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ---------------------------------------------------------------------------
// v2.3 GAP BATCH — Homework / Leaves / CSV bulk / Document status ke
// request schemas. Tareekhein DATE_TEXT_RE ("YYYY-MM-DD") wali hi
// parampara par hain — string tulna se hi from<=to aur overdue jaanch
// ho jati hai.
// ---------------------------------------------------------------------------
const createHomeworkBodySchema = z.object({
  className: z.string().min(1),
  // section na aaye/null ho = poori class ka homework.
  section: z.string().min(1).nullable().optional(),
  subject: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().regex(DATE_TEXT_RE),
});

const createLeaveBodySchema = z.object({
  kind: z.enum(["student", "staff"]),
  studentId: z.number().int().positive().optional(),
  staffId: z.number().int().positive().optional(),
  fromDate: z.string().regex(DATE_TEXT_RE),
  toDate: z.string().regex(DATE_TEXT_RE),
  reason: z.string().min(1).max(1000),
});

// Leave ka faisla aur document ka faisla — dono jagah sirf yehi do
// values chalengi ('pending' wapas karna faisla nahi hota).
const leaveDecisionBodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

const documentStatusBodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// CSV bulk import (v2.3): client CSV parse karke rows bhejta hai.
// Poori file ek saath reject NAHI hoti — har row alag jaanchi jati
// hai (bulkStudentRowSchema), galat row skip + errors me report,
// baaki banti hain. Isliye bahari schema sirf itna dekhta hai ki
// rows ki list hai aur 500 se zyada nahi (ek saath poora school
// ghusana aaram se ho jaye; isse zyada matlab galat file hai).
const bulkStudentsBodySchema = z.object({
  students: z.array(z.unknown()).min(1).max(500),
});

const bulkStaffBodySchema = z.object({
  staff: z.array(z.unknown()).min(1).max(500),
});

// Ek CSV student row: admission form ke lazmi khet (name, class,
// fatherName, contact) + aam vaikalpik khet. admissionNo na aaye to
// route getNextAdmissionNo se banayega; section na aaye to "A".
const bulkStudentRowSchema = z.object({
  name: z.string().min(1),
  class: z.string().min(1),
  section: z.string().min(1).optional(),
  rollNo: z.string().min(1).optional(),
  admissionNo: z.string().min(1).optional(),
  fatherName: z.string().min(1),
  motherName: z.string().min(1).optional(),
  contact: z.string().min(1),
  dob: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  // v3.3: APAAR ID CSV se bhi aa sakta hai (vaikalpik).
  apaarId: z.string().min(1).optional(),
});

// Ek CSV staff row: staff form ke lazmi khet (name, designation,
// contact). basicSalary na aaye to 0; employeeId na aaye to route
// POST /api/staff wala hi EMP-<id> khud banayega.
// App Version publish (v3.0): Master App se Super Admin bhejta hai.
const upsertAppVersionBodySchema = z.object({
  versionName: z.string().trim().min(1).max(20),
  versionCode: z.number().int().positive().max(1000000),
  apkUrl: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(1000).optional().nullable(),
  mandatory: z.boolean().optional().default(false),
  stage: z.enum(["testing", "released"]).optional().default("testing"),
});
const APP_VERSION_APP_NAMES = new Set(["school", "parent", "master"]);

// Payment proof (v3.3) — parent UPI screenshot bhejta hai. amount
// rupee me decimal bhi ho sakta hai (proof table NUMERIC hai);
// image lazmi base64 string (size ki jaanch route par document
// wale 2MB pattern se hoti hai).
const createPaymentProofBodySchema = z.object({
  studentId: z.number().int().positive(),
  amount: z.number().positive().max(10000000),
  txnRef: z.string().trim().max(100).optional().nullable(),
  image: z.string().min(1),
});

const paymentProofDecisionBodySchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// Certificate register entry (v3.3) — client print ke samay bhejta
// hai. type free-text hai (8 certificate types client par hain).
// studentName vaikalpik hai (merge fix): client bhejta hai, lekin
// na aaye to route student record se pakka naam le leta hai —
// register entry kabhi naam ki wajah se na ruke.
const createIssuedCertificateBodySchema = z.object({
  studentId: z.number().int().positive(),
  type: z.string().trim().min(1).max(100),
  studentName: z.string().trim().min(1).max(200).optional(),
  className: z.string().trim().max(100).optional().nullable(),
});

// Staff <-> user link (v3.3).
const linkStaffUserBodySchema = z.object({
  userId: z.number().int().positive(),
});

// Teacher assignment (v3.3) — principal ek teacher-user ko class/
// section/subject deta hai; isClassTeacher 1 = wo class teacher hai.
const createTeacherAssignmentBodySchema = z.object({
  userId: z.number().int().positive(),
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().max(20).optional().nullable(),
  subject: z.string().trim().max(100).optional().nullable(),
  isClassTeacher: z.boolean().optional(),
});

// Backup restore (v3.3) — body GET /api/export/school ka poora JSON
// hota hai; gehri jaanch route ke andar (tables ki maujoodgi).
const importSchoolBodySchema = z.object({
  school: z.object({}).passthrough(),
  exportedAt: z.string().optional(),
  students: z.array(z.unknown()).optional(),
  staff: z.array(z.unknown()).optional(),
  feeStructures: z.array(z.unknown()).optional(),
  feePayments: z.array(z.unknown()).optional(),
  studentDues: z.array(z.unknown()).optional(),
  exams: z.array(z.unknown()).optional(),
  marks: z.array(z.unknown()).optional(),
  attendance: z.array(z.unknown()).optional(),
  notices: z.array(z.unknown()).optional(),
  transportRoutes: z.array(z.unknown()).optional(),
  additionalFees: z.array(z.unknown()).optional(),
  salaryPayments: z.array(z.unknown()).optional(),
  expenses: z.array(z.unknown()).optional(),
});

const bulkStaffRowSchema = z.object({
  name: z.string().min(1),
  designation: z.string().min(1),
  contact: z.string().min(1),
  fatherName: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  qualification: z.string().min(1).optional(),
  experience: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  basicSalary: z.number().int().nonnegative().optional(),
  joinDate: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
});

// Online payment (Razorpay, v1.7) — order sirf rakam + student leta
// hai; verify Razorpay ke teeno ids ke saath wahi payment jaankari
// leta hai jo manual POST /api/payments leta hai (breakdown wagera),
// taaki safal online adaygi ka record bilkul aam fee payment jaisa bane.
const onlineOrderBodySchema = z.object({
  studentId: z.number().int().positive(),
  amount: z.number().int().positive(),
});

const onlineVerifyBodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  studentId: z.number().int().positive(),
  amount: z.number().int().positive(),
  month: z.string().min(1).optional(),
  year: z.number().int().optional(),
  remarks: z.string().optional(),
  breakdown: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .nullable()
    .optional(),
  isAdmission: z.boolean().optional(),
  dueSettlements: z
    .array(
      z.object({
        dueId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

// License expiry ki jaanch (v1.7) — licenseExpiry "YYYY-MM-DD" text
// hai; us tareekh TAK license chaalu hai, uske BAAD wala pehla din hi
// band hai. String tulna hi kaafi hai (dono ek hi format me hain).
// null/khaali = koi expiry nahi — kabhi band nahi hoga.
export function isLicenseExpired(
  licenseExpiry: string | null | undefined,
  today?: string,
): boolean {
  if (!licenseExpiry) return false;
  const now = today ?? new Date().toISOString().slice(0, 10);
  return licenseExpiry < now;
}

const updateNoticeBodySchema = createNoticeBodySchema.partial();

// ---------------------------------------------------------------------------
// v1.7 FIN — Fee kishten (installments) ka request schema.
// POST /api/fees/installments/generate ka body:
//   { className, installments: [{ title, amount, dueDate }] }
// title hi student_dues.feeName bankar source-marker ka kaam karega
// (storage.ts ke v1.7 block me poora design note hai). dueDate
// "YYYY-MM-DD" text hai — baaki dates (attendance) wali hi parampara.
// Ek baar me zyada se zyada 24 kishten (saal ke 12 mahine × 2 bhi
// aaram se aa jayein; isse zyada matlab galat input hai).
// ---------------------------------------------------------------------------
const generateInstallmentsBodySchema = z.object({
  className: z.string().min(1),
  installments: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        amount: z.number().int().positive(),
        dueDate: z.string().regex(DATE_TEXT_RE),
      }),
    )
    .min(1)
    .max(24),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const parseOptionalId = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const parsePathId = (req: Request): number | null => {
    const id = parseInt(req.params.id);
    return Number.isNaN(id) ? null : id;
  };

  // Token wala school scope (§3.1.3 + §3.1.5). Aam user ke liye hamesha
  // req.user.schoolId; super_admin ke liye query, phir body ka schoolId.
  const scopedSchoolId = (req: Request): number | null => {
    if (!req.user) return null;
    if (req.user.role !== "super_admin") return req.user.schoolId;
    const fromQuery = parseOptionalId(req.query.schoolId);
    if (fromQuery) return fromQuery;
    const bodySchoolId = (req.body as { schoolId?: unknown } | undefined)
      ?.schoolId;
    return typeof bodySchoolId === "number" &&
      Number.isInteger(bodySchoolId) &&
      bodySchoolId > 0
      ? bodySchoolId
      : null;
  };

  // Data routes ke liye school lazmi hai — na mile to handler yahin rukta.
  const requireSchoolId = (req: Request, res: Response): number | null => {
    const schoolId = scopedSchoolId(req);
    if (schoolId == null) {
      res.status(400).json({
        message:
          "School context missing. Super Admin must pass schoolId explicitly.",
      });
      return null;
    }
    return schoolId;
  };

  // Audit log helper (v3.3) — "kisne kab kya kiya" ka record bade
  // kaamo par (paisa, admission, accounts, settings, faisle).
  // FAIL-SAFE: audit likhna fail ho (table na ho, DB hichki) to
  // asal kaam KABHI nahi rukta — isliye poora body try/catch me
  // hai aur ye function kabhi throw nahi karta. userName token me
  // nahi hota, isliye user row se liya jata hai (na mile to null).
  const logAudit = async (
    req: Request,
    action: string,
    entity: string,
    entityId: number | null,
    detail?: string | null,
  ): Promise<void> => {
    try {
      if (!req.user) return;
      const schoolId = req.user.schoolId ?? scopedSchoolId(req);
      let userName: string | null = null;
      try {
        const me = await storage.getUser(req.user.id);
        userName = me?.name ?? null;
      } catch {
        userName = null;
      }
      await storage.createAuditLog({
        schoolId: schoolId ?? null,
        userId: req.user.id,
        userName,
        action,
        entity,
        entityId: entityId ?? null,
        detail: detail ?? null,
      });
    } catch (err) {
      console.error("logAudit failed (asli kaam jaari hai):", err);
    }
  };

  // --- Login rate limit (§2.4) -------------------------------------------
  // In-memory, per username+IP: 10 galat koshish / 10 minute par block.
  // Koi nayi dependency nahi; server restart par counters saaf ho jate
  // hain (v1 ke liye theek hai — asal raksha password hashing + lockout
  // ka yahi halka layer hai).
  const LOGIN_MAX_FAILURES = 10;
  const LOGIN_WINDOW_MS = 10 * 60 * 1000;
  const loginFailures = new Map<
    string,
    { count: number; windowStart: number }
  >();

  const loginKey = (req: Request, username: string) =>
    `${req.ip ?? "unknown"}:${username.toLowerCase()}`;

  const loginBlocked = (key: string): boolean => {
    const entry = loginFailures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
      return false;
    }
    return entry.count >= LOGIN_MAX_FAILURES;
  };

  const recordLoginFailure = (key: string) => {
    const now = Date.now();
    const entry = loginFailures.get(key);
    if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
      loginFailures.set(key, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  };

  const issueTokens = async (user: User) => {
    const accessToken = signAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as UserRole,
    });
    const refresh = await issueRefreshToken(user.id);
    return { accessToken, refreshToken: refresh.token };
  };

  // =======================================================================
  // Auth (§5.1)
  // =======================================================================

  app.post("/api/auth/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const { username, password, schoolCode } = result.data;

    const key = loginKey(req, username);
    if (loginBlocked(key)) {
      return res.status(429).json({
        message: "Too many failed login attempts. Try again after some time.",
      });
    }

    const user = await storage.getUserByUsername(username);
    // 🏫 School Code mila ho (Parent App) to school ka milan bhi lazmi
    // hai (v2.2): code wala school dhoondho, aur user USI school ka ho.
    // Code na mile, school na mile, ya user dusre school ka ho — teeno
    // haalaton me schoolOk jhootha rahega aur neeche wahi generic 401
    // milega (kaun si cheez galat hai, ye kabhi nahi bataya jata).
    // Code na aaya ho (School/Master app) to ye jaanch hoti hi nahi —
    // bartav bilkul pehle jaisa.
    let schoolOk = true;
    if (schoolCode) {
      const codedSchool = await storage.getSchoolByCode(
        normalizeSchoolCode(schoolCode),
      );
      schoolOk = !!codedSchool && !!user && user.schoolId === codedSchool.id;
    }
    // Ek hi generic jawab (§2.4): username galat, password galat ya
    // account band — teeno me yahi message, kuch leak nahi hota.
    const passwordOk =
      user && user.isActive === 1
        ? await verifyPassword(password, user.password)
        : false;
    if (!user || !passwordOk || !schoolOk) {
      recordLoginFailure(key);
      return res
        .status(401)
        .json({ message: "Username ya password galat hai" });
    }

    loginFailures.delete(key);
    await storage.updateLastLogin(user.id);
    const tokens = await issueTokens(user);
    res.json({
      ...tokens,
      user: serializeUser({ ...user, lastLoginAt: new Date() }),
    });
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const result = refreshSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const rotated = await rotateRefreshToken(result.data.refreshToken);
    if (!rotated) {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    const user = await storage.getUser(rotated.userId);
    if (!user) {
      return res
        .status(401)
        .json({ message: "Session expired. Please login again." });
    }
    const accessToken = signAccessToken({
      userId: user.id,
      schoolId: user.schoolId,
      role: user.role as UserRole,
    });
    res.json({
      accessToken,
      refreshToken: rotated.refreshToken.token,
      user: serializeUser(user),
    });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const result = logoutSchema.safeParse(req.body ?? {});
    if (result.success && result.data.refreshToken) {
      // Sirf bheja gaya token revoke karo (§5.1 #3).
      await revokeRefreshToken(result.data.refreshToken);
    } else {
      // Token nahi bheja — is user ke saare sessions band (logout everywhere).
      await revokeAllRefreshTokensForUser(req.user!.id);
    }
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(401).json({ message: "Login required" });
    const school = user.schoolId
      ? await storage.getSchool(user.schoolId)
      : undefined;
    res.json({
      user: serializeUser(user),
      // Branding (§4): app login ke turant baad school ka naam/logo/colors
      // yahin se cache kar legi. Super Admin kisi school se linked nahi.
      school: school ?? null,
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(401).json({ message: "Login required" });

    const currentOk = await verifyPassword(
      result.data.currentPassword,
      user.password,
    );
    if (!currentOk) {
      return res
        .status(400)
        .json({ message: "Current password is incorrect" });
    }

    await storage.updateUserPassword(
      user.id,
      await hashPassword(result.data.newPassword),
    );
    await storage.setMustChangePassword(user.id, 0);
    // Purane saare sessions band (§2.2) — phir is device ke liye naye token.
    await revokeAllRefreshTokensForUser(user.id);
    const tokens = await issueTokens(user);
    const updated = await storage.getUser(user.id);
    res.json({
      ...tokens,
      user: serializeUser(updated ?? user),
    });
  });

  // =======================================================================
  // App Version / Update system (v3.0) — Master App se publish, teeno
  // apps login se PEHLE check karte hain isliye GET PUBLIC hai.
  // Isme SIRF version jaankari hoti hai (naam/code/link/notes) —
  // kisi school ka data kabhi nahi; jawab har school ke liye ek
  // jaisa hai.
  //
  // STAGED ROLLOUT: school/parent ko row tabhi milta hai jab
  // stage = 'released' ho — pehle update sirf Master ke paas
  // 'testing' me rehta hai, user check karke "Push to All" karta
  // hai tab sab ko jata hai. Master app apni row hamesha dekhta
  // hai (wohi to testing kar raha hai).
  //
  // Jagah jaan-boojh kar license guard se PEHLE hai: license-expired
  // school ko bhi update milna chahiye (naya version hi fix ho
  // sakta hai), aur bina-login check guard ke token-jaanch me
  // fasna nahi chahiye.
  // =======================================================================
  app.get("/api/app-version", async (req, res) => {
    const appName =
      typeof req.query.app === "string" ? req.query.app : "";
    if (!APP_VERSION_APP_NAMES.has(appName)) {
      return res.status(400).json({
        message: "app query parameter galat hai (school | parent | master)",
      });
    }
    const noUpdate = {
      app: appName,
      versionName: null as string | null,
      versionCode: 0,
      apkUrl: null as string | null,
      notes: null as string | null,
      mandatory: 0,
      stage: "none",
    };
    const row = await storage.getAppVersion(appName);
    if (!row) return res.json(noUpdate);
    // Super Admin (Master App) management ke liye poori row dekhta
    // hai — testing wala bhi. Bina token ke (aam apps ka check)
    // testing wala update dikhta hi nahi.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyAccessToken(
        authHeader.slice("Bearer ".length).trim(),
      );
      if (payload && payload.role === "super_admin") {
        return res.json({
          app: row.app,
          versionName: row.versionName,
          versionCode: row.versionCode,
          apkUrl: row.apkUrl,
          notes: row.notes,
          mandatory: row.mandatory ?? 0,
          stage: row.stage ?? "testing",
          updatedAt: row.updatedAt,
        });
      }
    }
    // Testing wala update aam apps ko dikhta hi nahi.
    if (appName !== "master" && row.stage !== "released") {
      return res.json(noUpdate);
    }
    return res.json({
      app: row.app,
      versionName: row.versionName,
      versionCode: row.versionCode,
      apkUrl: row.apkUrl,
      notes: row.notes,
      mandatory: row.mandatory ?? 0,
      stage: row.stage ?? "testing",
      updatedAt: row.updatedAt,
    });
  });

  // Publish: sirf Super Admin (Master App). Master ki apni row
  // hamesha 'released' — wo user ki apni app hai, testing stage
  // uske liye bekaar hai.
  app.put(
    "/api/app-version/:app",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const appName = req.params.app;
      if (!APP_VERSION_APP_NAMES.has(appName)) {
        return res.status(400).json({ message: "App name galat hai" });
      }
      const result = upsertAppVersionBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const row = await storage.upsertAppVersion(appName, {
        versionName: result.data.versionName,
        versionCode: result.data.versionCode,
        apkUrl: result.data.apkUrl,
        notes: result.data.notes ?? null,
        mandatory: result.data.mandatory ? 1 : 0,
        stage: appName === "master" ? "released" : result.data.stage,
      });
      return res.json(row);
    },
  );

  // =======================================================================
  // License guard (v1.7, NICHOD #15) — expiry beet jane par school ke
  // users ke DATA-API jawab 403 { code: "LICENSE_EXPIRED" }.
  //
  // Jagah jaan-boojh kar yahi hai: auth routes (login/refresh/logout/
  // me/change-password) isse PEHLE register hue hain, isliye wo khule
  // rehte hain — user lock dekh sakta hai, /api/auth/me se apne school
  // ki expiry jaan sakta hai aur logout kar sakta hai. Iske BAAD wale
  // saare /api raste (schools/users/students/fees/library/…) guard se
  // guzrenge. /api/branding bhi neeche register hai, isliye use yahan
  // khaas taur par chhod diya hai (lock screen par school ka naam/logo
  // dikhna chahiye).
  //
  // Guard khud token verify karke school dekhta hai (requireAuth har
  // route par alag se laga hai — guard usse pehle chalta hai, isliye
  // req.user yahan nahi milta). Token na ho/galat ho to guard chup
  // chaap aage badha deta hai — asli 401 route ka requireAuth dega.
  // super_admin exempt hai (uska koi school hi nahi; wo Schools screen
  // se expiry theek kar sakta hai). isActive wala purana on/off switch
  // isse bilkul alag hai — use haath nahi lagaya.
  // =======================================================================
  app.use("/api", async (req, res, next) => {
    try {
      const fullPath = (req.originalUrl ?? "").split("?")[0];
      if (fullPath === "/api/branding") return next();
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) return next();
      const payload = verifyAccessToken(header.slice("Bearer ".length).trim());
      if (!payload) return next();
      if (payload.role === "super_admin" || payload.schoolId == null) {
        return next();
      }
      const school = await storage.getSchool(payload.schoolId);
      if (school && isLicenseExpired(school.licenseExpiry)) {
        return res.status(403).json({
          code: "LICENSE_EXPIRED",
          message:
            "Aapke school ka license khatm ho gaya hai — kripya apne seller/Super Admin se sampark karein",
        });
      }
      return next();
    } catch {
      // Guard ki apni galti par app band nahi hona chahiye — asli
      // faisla route ke requireAuth/roles par chhod do.
      return next();
    }
  });

  // =======================================================================
  // Schools & branding (§5.2)
  // =======================================================================

  app.get(
    "/api/schools",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const schools = await storage.getSchools();
      res.json(schools);
    },
  );

  // Super Admin: naya school + uska pehla Principal (§2.3.2).
  // Principal ko temporary password milega, mustChangePassword = 1 ke
  // saath — pehle login par password badalna hi padega.
  app.post(
    "/api/schools",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const result = createSchoolWithPrincipalSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { principal, ...schoolData } = result.data;

      const existing = await storage.getUserByUsername(principal.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // 🏫 School Code (v2.2): har naye school ko apna code milega —
      // Parent App ke login ki pehchan. Body me code aaya ho to pehle
      // uski takraav-jaanch (409), warna server khud bana deta hai
      // (naam ke akshar + ank, storage.generateUniqueSchoolCode).
      let code = schoolData.code
        ? normalizeSchoolCode(schoolData.code)
        : null;
      if (code) {
        const clash = await storage.getSchoolByCode(code);
        if (clash) {
          return res
            .status(409)
            .json({ message: "School code already exists" });
        }
      } else {
        code = await generateUniqueSchoolCode(storage, schoolData.name);
      }

      const school = await storage.createSchool({ ...schoolData, code });
      const principalUser = await storage.createUser({
        schoolId: school.id,
        username: principal.username,
        password: await hashPassword(principal.temporaryPassword),
        role: "principal",
        name: principal.name,
        phone: principal.phone ?? null,
        mustChangePassword: 1,
        isActive: 1,
      });
      res.status(201).json({
        school,
        principal: serializeUser(principalUser),
      });
    },
  );

  app.get(
    "/api/schools/:id",
    requireAuth,
    requireRole("super_admin", "principal"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      // Principal sirf apna school — dusre ka maange to 404 (§3.1.4).
      if (req.user!.role === "principal" && req.user!.schoolId !== id) {
        return res.status(404).json({ message: "School not found" });
      }
      const school = await storage.getSchool(id);
      if (!school) return res.status(404).json({ message: "School not found" });
      res.json(school);
    },
  );

  // Branding/settings update (§4): Principal (apna) ya Super Admin.
  app.put(
    "/api/schools/:id",
    requireAuth,
    requireRole("super_admin", "principal"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      if (req.user!.role === "principal" && req.user!.schoolId !== id) {
        return res.status(404).json({ message: "School not found" });
      }
      const result = updateSchoolSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const existing = await storage.getSchool(id);
      if (!existing) {
        return res.status(404).json({ message: "School not found" });
      }
      const updates: Record<string, unknown> = { ...result.data };
      // School band/chaalu karna sirf Super Admin ka kaam hai (#10).
      if (req.user!.role !== "super_admin") delete updates.isActive;
      // Plan/license bhi sirf Super Admin badal sakta hai (v1.7) —
      // Principal apne school ka plan ya expiry khud nahi badhega.
      if (req.user!.role !== "super_admin") {
        delete updates.plan;
        delete updates.licenseExpiry;
      }
      // School Code bhi sirf Super Admin ka adhikaar hai (v2.2) —
      // parents usi code se login karte hain; Principal use khud
      // badal de to saare parent login toot jayenge.
      if (req.user!.role !== "super_admin") delete updates.code;
      if (updates.code != null && updates.code !== "") {
        updates.code = normalizeSchoolCode(String(updates.code));
        const clash = await storage.getSchoolByCode(String(updates.code));
        if (clash && clash.id !== id) {
          return res
            .status(409)
            .json({ message: "School code already exists" });
        }
      }
      if (updates.code === "") updates.code = null;
      // Plan sirf Basic/Pro me se ek; expiry ya to khaali (null = koi
      // expiry nahi) ya "YYYY-MM-DD" — galat value DB tak nahi jayegi.
      if (updates.plan !== undefined && updates.plan !== null) {
        const planCheck = schoolPlanSchema.safeParse(updates.plan);
        if (!planCheck.success) {
          return res
            .status(400)
            .json({ message: "Plan sirf Basic ya Pro ho sakta hai" });
        }
      }
      if (
        updates.licenseExpiry !== undefined &&
        updates.licenseExpiry !== null &&
        updates.licenseExpiry !== "" &&
        !DATE_TEXT_RE.test(String(updates.licenseExpiry))
      ) {
        return res
          .status(400)
          .json({ message: "licenseExpiry must be YYYY-MM-DD" });
      }
      if (updates.licenseExpiry === "") updates.licenseExpiry = null;
      // v3.3: UPI QR image (base64) par bhi document wali 2MB seema —
      // bina seema ke ek vishal string DB row ko phula degi.
      if (
        typeof updates.upiQr === "string" &&
        updates.upiQr !== "" &&
        documentTooLarge(updates.upiQr)
      ) {
        return res.status(400).json({
          message: "UPI QR image bahut badi hai (adhiktam ~2 MB)",
        });
      }
      const school = await storage.updateSchool(id, {
        ...(updates as typeof result.data),
        updatedAt: new Date(),
      });
      // Audit (v3.3): settings/branding badlav record ho.
      await logAudit(
        req,
        "school.settings_update",
        "school",
        id,
        `Settings update: ${Object.keys(updates).join(", ")}`,
      );
      res.json(school);
    },
  );

  // License band karna = school deactivate (§5.2 #10).
  app.post(
    "/api/schools/:id/deactivate",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const existing = await storage.getSchool(id);
      if (!existing) {
        return res.status(404).json({ message: "School not found" });
      }
      const school = await storage.updateSchool(id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(school);
    },
  );

  // Apne school ki branding — login kiya hua koi bhi user (§5.2 #11).
  app.get("/api/branding", requireAuth, async (req, res) => {
    if (!req.user!.schoolId) {
      return res
        .status(404)
        .json({ message: "This account is not linked to a school" });
    }
    const school = await storage.getSchool(req.user!.schoolId);
    if (!school) return res.status(404).json({ message: "School not found" });
    res.json(school);
  });

  // =======================================================================
  // 🧪 Master App — Demo School (v2.2)
  // Super Admin ek tap me poora test school bana sakta hai: school +
  // Principal + fees ki rachna + 5 bacche + kuch fees/dues + aaj ki
  // hajri + ek notice (+ har bacche ke parent ka login, admission wale
  // auto-link niyam se). Pehchan ka nishan = School Code "DEMO01" —
  // wahi code dobara mile to naya NAHI banta (idempotent), purana hi
  // wapas milta hai aur Principal ka password dobara NAHI dikhta
  // (bhool jaye to Schools → Accounts se reset kar dein).
  // =======================================================================
  const DEMO_SCHOOL_CODE = "DEMO01";
  app.post(
    "/api/admin/demo-school",
    requireAuth,
    requireRole("super_admin"),
    async (req, res) => {
      const existingDemo = await storage.getSchoolByCode(DEMO_SCHOOL_CODE);
      if (existingDemo) {
        const demoUsers = await storage.getUsersBySchool(existingDemo.id);
        const demoPrincipal = demoUsers.find((u) => u.role === "principal");
        return res.json({
          created: false,
          school: existingDemo,
          principal: demoPrincipal
            ? { username: demoPrincipal.username }
            : null,
          message:
            "Demo School pehle se bana hua hai — naya nahi banaya. Principal ka password bhool gaye ho to Schools list me is school ke Accounts se reset kar dein.",
        });
      }

      const principalUsername = "demo.principal";
      const usernameTaken = await storage.getUserByUsername(principalUsername);
      if (usernameTaken) {
        return res.status(409).json({
          message:
            "Username 'demo.principal' pehle se kisi aur ke paas hai — Demo School nahi ban paya.",
        });
      }

      const now = new Date();
      const year = now.getFullYear();
      const monthName = now.toLocaleString("en-US", { month: "long" });
      const session =
        now.getMonth() >= 3
          ? `${year}-${String(year + 1).slice(2)}`
          : `${year - 1}-${String(year).slice(2)}`;
      const today = now.toISOString().slice(0, 10);

      const school = await storage.createSchool({
        name: "Demo Public School",
        code: DEMO_SCHOOL_CODE,
        address: "Demo Nagar, Test City",
        phone: "9999999999",
        email: "demo@schoolguardian.local",
        session,
        admissionPrefix: "DEMO",
        admissionYear: String(year),
        admissionStart: 1,
        plan: "Basic",
        isActive: 1,
      });

      // Pehla Principal — aam provisioning wala hi niyam: temporary
      // password sirf is ek response me, mustChangePassword = 1.
      const temporaryPassword = randomBytes(6).toString("hex");
      const principalUser = await storage.createUser({
        schoolId: school.id,
        username: principalUsername,
                password: await hashPassword(temporaryPassword),
        role: "principal",
        name: "Demo Principal",
        phone: "9999999999",
        mustChangePassword: 1,
        isActive: 1,
      });

      // Ek class ki fee rachna (Class 1).
      await storage.createFeeStructure({
        schoolId: school.id,
        class: "1",
        monthlyFee: 1000,
        admissionFee: 2000,
        examFee: 500,
        otherFee: 0,
      });

      // 5 namoona bacche — 3 Class 1 me, 2 Class 2 me. Har bacche ke
      // admission ke saath parent ka login bhi taiyaar (v2.1 wala
      // auto-link: username = mobile, password = Admission No.).
      const demoStudents: Array<{
        name: string;
        fatherName: string;
        class: string;
        contact: string;
        dob: string;
      }> = [
        { name: "Aarav Sharma", fatherName: "Rakesh Sharma", class: "1", contact: "9810000001", dob: "2019-04-12" },
        { name: "Diya Patel", fatherName: "Amit Patel", class: "1", contact: "9810000002", dob: "2019-08-03" },
        { name: "Kabir Singh", fatherName: "Harpreet Singh", class: "1", contact: "9810000003", dob: "2019-01-25" },
        { name: "Ananya Gupta", fatherName: "Rohit Gupta", class: "2", contact: "9810000004", dob: "2018-06-17" },
        { name: "Vihaan Khan", fatherName: "Imran Khan", class: "2", contact: "9810000005", dob: "2018-11-30" },
      ];
      const createdStudents = [];
      for (const [index, s] of demoStudents.entries()) {
        const admissionNo = await storage.getNextAdmissionNo(school.id);
        const student = await storage.createStudent({
          schoolId: school.id,
          admissionNo,
          name: s.name,
          fatherName: s.fatherName,
          class: s.class,
          section: "A",
          rollNo: String(index + 1),
          contact: s.contact,
          address: "Demo Nagar, Test City",
          dob: s.dob,
          isActive: 1,
        });
        createdStudents.push(student);
        try {
          await storage.ensureParentForAdmission(school.id, student, () =>
            hashPassword(student.admissionNo),
          );
        } catch (err) {
          console.error("Demo school: parent auto-link failed:", err);
        }
      }

      // Fees: pehle bacche ki admission fee poori jama, dusre ki is
      // mahine ki tuition jama — teesre ke naam ek pending due.
      await storage.createFeePayment({
        studentId: createdStudents[0].id,
        schoolId: school.id,
        amount: 2000,
        month: monthName,
        year,
        receiptNo: await storage.getNextReceiptNo(school.id),
        paymentMethod: "Cash",
        remarks: "Admission Fee (Demo)",
        breakdown: JSON.stringify({ extras: [], isAdmission: true }),
      });
      await storage.createFeePayment({
        studentId: createdStudents[1].id,
        schoolId: school.id,
        amount: 1000,
        month: monthName,
        year,
        receiptNo: await storage.getNextReceiptNo(school.id),
        paymentMethod: "Cash",
        remarks: `Tuition: ${monthName} (Demo)`,
        breakdown: JSON.stringify({
          extras: [
            {
              name: `Tuition: ${monthName}`,
              amount: 1000,
              type: "Tuition",
              month: monthName,
            },
          ],
        }),
      });
      await storage.createStudentDue({
        studentId: createdStudents[2].id,
        feeName: "Admission Fee (baaki)",
        amount: 2000,
        dueDate: now,
        isPaid: 0,
      });

      // Aaj ki hajri: 4 present, 1 absent.
      await storage.markAttendanceBulk(
        school.id,
        principalUser.id,
        today,
        createdStudents.map((student, index) => ({
          studentId: student.id,
          status: index === 4 ? "absent" : "present",
        })),
      );

      // Ek swagat notice (parents ko bhi dikhega — audience "all").
      await storage.createNotice({
        schoolId: school.id,
        title: "Demo School me aapka swagat hai",
        body: "Ye ek demo notice hai — Demo Public School ke test data ke saath bheja gaya hai.",
        audience: "all",
        createdBy: principalUser.id,
      });

      res.status(201).json({
        created: true,
        school,
        principal: {
          username: principalUsername,
          temporaryPassword,
        },
        seeded: {
          feeStructure: "Class 1 (monthly ₹1000, admission ₹2000)",
          students: createdStudents.length,
          payments: 2,
          pendingDue: `${createdStudents[2].name} — Admission Fee ₹2000 baaki`,
          attendanceDate: today,
          notices: 1,
          parentLogins:
            "Har bacche ke parent ka login taiyaar hai — Parent App me School Code DEMO01 + mobile number + password = bacche ka Admission No.",
        },
      });
    },
  );

  // =======================================================================
  // Users (§5.3)
  // =======================================================================

  // Object-level scope (§3.1.4): super_admin sab, principal apne school
  // ke, user khud — iske bahar wala user "hai hi nahi" (404).
  const loadUserInScope = async (req: Request): Promise<User | null> => {
    const id = parsePathId(req);
    if (id == null) return null;
    const user = await storage.getUser(id);
    if (!user) return null;
    if (req.user!.role === "super_admin") return user;
    if (req.user!.id === user.id) return user;
    if (
      req.user!.role === "principal" &&
      user.schoolId === req.user!.schoolId
    ) {
      return user;
    }
    return null;
  };

  const withStudentIds = async (user: User) => {
    const serialized = serializeUser(user);
    if (user.role !== "parent") return serialized;
    const links = await storage.getParentStudentLinks(user.id);
    return { ...serialized, studentIds: links.map((link) => link.studentId) };
  };

  app.get(
    "/api/users",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      let users: User[];
      if (req.user!.role === "principal") {
        // Principal ko sirf apne school ke accounts (§5.3).
        users = await storage.getUsersBySchool(req.user!.schoolId ?? -1);
      } else {
        const schoolId = parseOptionalId(req.query.schoolId);
        users = schoolId
          ? await storage.getUsersBySchool(schoolId)
          : await storage.getUsers();
      }
      res.json(await Promise.all(users.map(withStudentIds)));
    },
  );

  app.post(
    "/api/users",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const data = result.data;
      const caller = req.user!;

      // Principal sirf staff roles + parent bana sakta hai — principal ya
      // super_admin banana uske adhikar me nahi (§2.3.3).
      if (
        caller.role === "principal" &&
        data.role !== "accountant" &&
        data.role !== "teacher" &&
        data.role !== "staff" &&
        data.role !== "parent"
      ) {
        return res.status(403).json({
          message:
            "Principal can create only accountant, teacher, staff or parent accounts",
        });
      }

      // Naya user hamesha banane wale ke school ka — client ke bheje
      // schoolId par bharosa nahi (§2.3.3, §3.1.6). Sirf super_admin
      // (jiska apna school nahi) body wala schoolId de sakta hai.
      const targetSchoolId =
        caller.role === "super_admin" ? data.schoolId : caller.schoolId;
      if (!targetSchoolId) {
        return res.status(400).json({ message: "schoolId is required" });
      }
      const targetSchool = await storage.getSchool(targetSchoolId);
      if (!targetSchool) {
        return res.status(404).json({ message: "School not found" });
      }

      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Parent: kam se kam ek baccha link hona lazmi, aur har baccha
      // usi school ka hona chahiye (§2.3.4).
      const studentIds =
        data.role === "parent" ? (data.studentIds ?? []) : [];
      if (data.role === "parent") {
        if (studentIds.length === 0) {
          return res.status(400).json({
            message: "A parent account must be linked to at least one student",
          });
        }
        for (const studentId of studentIds) {
          const student = await storage.getStudent(studentId);
          if (!student || student.schoolId !== targetSchoolId) {
            return res.status(400).json({
              message: "One or more students do not belong to this school",
            });
          }
        }
      }

      const created = await storage.createUser({
        schoolId: targetSchoolId,
        username: data.username,
        password: await hashPassword(data.temporaryPassword),
        role: data.role,
        name: data.name,
        // Parent ka username hi mobile number hai (§2.3.4) — phone khaali
        // ho to wahi phone ban jayega.
        phone: data.phone ?? (data.role === "parent" ? data.username : null),
        mustChangePassword: 1,
        isActive: 1,
      });

      for (const studentId of studentIds) {
        await storage.linkParentStudent({
          parentUserId: created.id,
          studentId,
          relation: data.relation ?? null,
        });
      }

      // Audit (v3.3): naya account bana — kisne, kis role ka.
      await logAudit(
        req,
        "user.create",
        "user",
        created.id,
        `${created.name} (${created.role}, username ${created.username})`,
      );

      res.status(201).json(await withStudentIds(created));
    },
  );

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await loadUserInScope(req);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(await withStudentIds(user));
  });

  app.put("/api/users/:id", requireAuth, async (req, res) => {
    const result = updateUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json(result.error);
    const target = await loadUserInScope(req);
    if (!target) return res.status(404).json({ message: "User not found" });

    const data = result.data;
    const isSelfEdit =
      req.user!.id === target.id &&
      req.user!.role !== "principal" &&
      req.user!.role !== "super_admin";

    // Khud ka edit sirf name/phone tak (§5.3 #15); baccho ke links sirf
    // principal/super_admin badal sakte hain.
    if (isSelfEdit && data.studentIds !== undefined) {
      return res.status(403).json({
        message: "You cannot change linked students on your own account",
      });
    }

    const updates: { name?: string; phone?: string | null } = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    let updated = target;
    if (Object.keys(updates).length > 0) {
      updated = await storage.updateUser(target.id, updates);
    }

    if (data.studentIds !== undefined && target.role === "parent") {
      for (const studentId of data.studentIds) {
        const student = await storage.getStudent(studentId);
        if (!student || student.schoolId !== target.schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      await storage.replaceParentStudentLinks(
        target.id,
        data.studentIds,
        data.relation ?? null,
      );
    }

    res.json(await withStudentIds(updated));
  });

  app.post(
    "/api/users/:id/deactivate",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      if (id === req.user!.id) {
        return res
          .status(400)
          .json({ message: "You cannot deactivate your own account" });
      }
      const target = await storage.getUser(id);
      if (
        !target ||
        (req.user!.role === "principal" &&
          target.schoolId !== req.user!.schoolId)
      ) {
        return res.status(404).json({ message: "User not found" });
      }
      const updated = await storage.updateUser(id, { isActive: 0 });
      // Band account ke purane sessions bhi turant band (§2.4).
      await revokeAllRefreshTokensForUser(id);
      res.json(serializeUser(updated));
    },
  );

  app.post(
    "/api/users/:id/reset-password",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = resetPasswordSchema.safeParse(req.body ?? {});
      if (!result.success) return res.status(400).json(result.error);
      const target = await storage.getUser(id);
      if (
        !target ||
        (req.user!.role === "principal" &&
          target.schoolId !== req.user!.schoolId)
      ) {
        return res.status(404).json({ message: "User not found" });
      }
      // Temporary password na diya ho to server bana dega — wo sirf is
      // ek response me dikhega (office wahi parent/staff ko dega, §2.3.4).
      const generated = result.data.temporaryPassword
        ? null
        : randomBytes(6).toString("hex");
      const temporaryPassword = result.data.temporaryPassword ?? generated!;
      await storage.updateUserPassword(
        id,
        await hashPassword(temporaryPassword),
      );
      await storage.setMustChangePassword(id, 1);
      await revokeAllRefreshTokensForUser(id);
      const updated = await storage.getUser(id);
      // Audit (v3.3): password reset — temporary password khud
      // record me KABHI nahi likhte, sirf ghatna likhte hain.
      await logAudit(
        req,
        "user.password_reset",
        "user",
        id,
        `${target.name} (${target.username}) ka password reset`,
      );
      res.json({
        user: serializeUser(updated ?? target),
        ...(generated ? { temporaryPassword: generated } : {}),
      });
    },
  );

  // =======================================================================
  // Students — purane routes, ab login + role + token-school ke saath
  // (rollout step 5). Behaviour pehle jaisa hi hai.
  // =======================================================================

  app.get(
    "/api/students",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;

      const filters = {
        class:
          typeof req.query.class === "string" ? req.query.class : undefined,
        section:
          typeof req.query.section === "string"
            ? req.query.section
            : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      };

      const students = await storage.getStudents(schoolId, filters);
      res.json(students);
    },
  );

  app.post(
    "/api/students",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertStudentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      // schoolId body se nahi, token se (§3.1.6).
      const student = await storage.createStudent({
        ...result.data,
        schoolId,
      });
      // 👨‍👩‍👧 Parent App auto-link (v2.1): admission bante hi parent ka
      // login taiyaar kar do — contact number ka parent account ho to
      // is bacche ko link, na ho to naya parent account (username =
      // mobile, shuru ka password = bacche ka Admission No.,
      // mustChangePassword = 1 — v3.3: pehle login par password
      // badalna LAZMI hai, kyunki Admission No. ID card/report card
      // par chhapa hota hai — koi bhi use jaan sakta hai). Poora
      // niyam storage.ensureParentForAdmission me hai. Ye kadam fail
      // ho jaye to bhi admission safal hi rahega — parent account
      // baad me Users screen se haath se bhi ban sakta hai.
      try {
        await storage.ensureParentForAdmission(schoolId, student, () =>
          hashPassword(student.admissionNo),
        );
      } catch (err) {
        console.error("Parent auto-link failed (admission OK):", err);
      }
      // Audit (v3.3): naya admission.
      await logAudit(
        req,
        "student.create",
        "student",
        student.id,
        `${student.name} — Admission No. ${student.admissionNo}, Class ${student.class}${student.section ? `-${student.section}` : ""}`,
      );
      res.json(student);
    },
  );

  // =======================================================================
  // Fees
  // =======================================================================

  app.get(
    "/api/fee-structures",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const structures = await storage.getFeeStructures(schoolId);
      res.json(structures);
    },
  );

  app.post(
    "/api/fee-structures",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertFeeStructureSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const structure = await storage.createFeeStructure({
        ...result.data,
        schoolId,
      });
      res.json(structure);
    },
  );

  app.get(
    "/api/payments",
    requireAuth,
    // Phase 3 Batch A fix: "teacher" Dashboard ki collection stats ke
    // liye (page saari payments padhta hai) aur "parent" apne linked
    // baccho ki payments ke liye jode gaye hain.
    requireRole("principal", "accountant", "staff", "teacher", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const studentId = parseOptionalId(req.query.studentId);

      // Parent († rule): sirf apne parent_students-linked baccho ki
      // payments. studentId diya ho aur wo linked na ho to khali list —
      // kisi dusre bacche ki ek bhi payment parent ko nahi jayegi.
      if (req.user!.role === "parent") {
        const links = await storage.getParentStudentLinks(req.user!.id);
        const linkedIds = new Set(links.map((link) => link.studentId));
        if (studentId != null) {
          if (!linkedIds.has(studentId)) return res.json([]);
          return res.json(await storage.getFeePayments(schoolId, studentId));
        }
        const allPayments = await storage.getFeePayments(schoolId);
        return res.json(
          allPayments.filter(
            (payment) =>
              payment.studentId != null && linkedIds.has(payment.studentId),
          ),
        );
      }

      const payments = await storage.getFeePayments(schoolId, studentId);
      res.json(payments);
    },
  );

  app.post(
    "/api/payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createFeePaymentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      // isAdmission column nahi hai — use breakdown JSON ke andar
      // mehfooz kiya jata hai (upar normalizePaymentBreakdown dekho).
      const { isAdmission, breakdown, dueSettlements, ...paymentData } =
        result.data;

      // Dues-fix — dueSettlements aaye hon to payment banane se PEHLE
      // har due ki jaanch: due maujood ho, ISI payment wale student ka
      // ho, aur wo student isi school ka ho. student_dues me school_id
      // column hai hi nahi, isliye school ki pehchan student ke zariye
      // hoti hai — DELETE /api/dues/:id (#41) wala hi tareeka. Ek bhi
      // due galat nikla to payment bane hi nahi (400) — paisa kisi aur
      // student/school ke due par kabhi settle nahi hoga. Ek hi due
      // do baar aaye to rakam jud jayegi; pehle se paid due chupchaap
      // skip hoga (network retry par dohra settle nahi hoga).
      const settlements: Array<{ due: StudentDues; amount: number }> = [];
      if (dueSettlements && dueSettlements.length > 0) {
        const merged: Array<{ dueId: number; amount: number }> = [];
        for (const settlement of dueSettlements) {
          if (settlement.amount <= 0) continue;
          const existing = merged.find((m) => m.dueId === settlement.dueId);
          if (existing) existing.amount += settlement.amount;
          else merged.push({ dueId: settlement.dueId, amount: settlement.amount });
        }
        for (const { dueId, amount } of merged) {
          const due = await storage.getStudentDue(dueId);
          if (
            !due ||
            due.studentId == null ||
            due.studentId !== paymentData.studentId
          ) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          const student = await storage.getStudent(due.studentId);
          if (!student || student.schoolId !== schoolId) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          if (due.isPaid === 1) continue;
          settlements.push({ due, amount });
        }
      }

      const breakdownText = normalizePaymentBreakdown(breakdown, isAdmission);
      const payment = await storage.createFeePayment({
        ...paymentData,
        ...(breakdownText !== undefined
          ? { breakdown: breakdownText }
          : {}),
        schoolId,
      });

      // Payment ban gaya — ab dues settle karo. Poora paisa aaya ho to
      // is_paid = 1 (due Pending Dues se gayab ho jayega); kam aaya ho
      // to due ki rakam utni hi ghatado aur baaki hissa pending rakho —
      // isse na kabhi dohra vasool hoga, na due jhootha "paid" hoga.
      for (const { due, amount } of settlements) {
        if (amount >= due.amount) {
          await storage.updateStudentDue(due.id, {
            isPaid: 1,
            updatedAt: new Date(),
          });
        } else {
          await storage.updateStudentDue(due.id, {
            amount: due.amount - amount,
            updatedAt: new Date(),
          });
        }
      }

      // Audit (v3.3): paisa aaya — sabse hassas record.
      await logAudit(
        req,
        "payment.create",
        "fee_payment",
        payment.id,
        `₹${payment.amount} — student ${paymentData.studentId ?? "-"}, receipt ${payment.receiptNo ?? "-"}`,
      );

      res.status(201).json(payment);
    },
  );

  app.get(
    "/api/fees/defaulters",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const classStr =
        typeof req.query.class === "string" ? req.query.class : undefined;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const defaulters = await storage.getDefaulters(schoolId, classStr, month);
      res.json(defaulters);
    },
  );

  // =======================================================================
  // Staff
  // =======================================================================

  // Roles design §5.6 #49 + §3 matrix ke hisaab se batch 2c me badhaye:
  // teacher/staff bhi staff list padh sakte hain, lekin salary fields
  // unhe kabhi nahi dikhengi (serializeStaffFor, §3 ‡).
  app.get(
    "/api/staff",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      // Phase 3 Batch A fix: Staff page ke status filters (Inactive
      // wagera) kaam karne ke liye list me saare staff (active +
      // inactive) chahiye. Salary/pending aur dashboard stats apni
      // jagah par default active-only wala getStaff hi istemal karte
      // hain — unka behaviour nahi badla.
      const staffList = await storage.getStaff(schoolId, {
        includeInactive: true,
      });
      res.json(
        staffList.map((member) => serializeStaffFor(member, req.user!.role)),
      );
    },
  );

  app.post(
    "/api/staff",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = insertStaffSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const newStaff = await storage.createStaff({
        ...result.data,
        schoolId,
      });
      // Phase 3 Batch A fix: employeeId client se na aaye (Staff page
      // me ID ka input hai hi nahi) to server khud banata hai. Insert
      // ke baad mile id se banta hai (EMP-<id>), isliye hamesha unique
      // hai — employee_id par unique bandhan bhi hai. Client ne ID
      // bheja ho to wahi rehta hai.
      if (!newStaff.employeeId) {
        const withEmployeeId = await storage.updateStaff(newStaff.id, {
          employeeId: `EMP-${newStaff.id}`,
          updatedAt: new Date(),
        });
        return res.json(withEmployeeId);
      }
      res.json(newStaff);
    },
  );

  // =======================================================================
  // Phase 2 parity — batch 2c (rollout steps 7–8, §5.4–§5.8)
  //
  // Niyam wahi purane (§3.1): schoolId sirf token se; dusri school ka
  // record = 404; parent (†) sirf apne parent_students-linked bacche
  // dekh sakta hai — dusra baccha uske liye "hai hi nahi" (404).
  // =======================================================================

  // :id wala student load karke school-scope (+ parent link) check.
  // Fail ho to response yahi se chala jata hai aur null milta hai.
  const loadStudentInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; student: Student } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const student = await storage.getStudent(id);
    if (!student || student.schoolId !== schoolId) {
      res.status(404).json({ message: "Student not found" });
      return null;
    }
    if (req.user!.role === "parent") {
      const links = await storage.getParentStudentLinks(req.user!.id);
      if (!links.some((link) => link.studentId === student.id)) {
        res.status(404).json({ message: "Student not found" });
        return null;
      }
    }
    return { schoolId, student };
  };

  const loadStaffInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; member: Staff } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const member = await storage.getStaffMember(id);
    if (!member || member.schoolId !== schoolId) {
      res.status(404).json({ message: "Staff not found" });
      return null;
    }
    return { schoolId, member };
  };

  // Parent ke linked baccho ke IDs — parent-scope wale har handler me
  // yahi set lagega († rule).
  const parentLinkedStudentIds = async (req: Request): Promise<number[]> => {
    const links = await storage.getParentStudentLinks(req.user!.id);
    return links.map((link) => link.studentId);
  };

  // ---------------------------------------------------------------------
  // Students parity (§5.4) — note: literal paths (/promote,
  // /next-admission-no, ...) hamesha /api/students/:id se PEHLE register
  // honge, warna Express ":id" unhe kha jayega.
  // ---------------------------------------------------------------------

  // #24 — agla admission number (school settings se banta hai, §6.7).
  app.get(
    "/api/students/next-admission-no",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const admissionNo = await storage.getNextAdmissionNo(schoolId);
      res.json({ admissionNo });
    },
  );

  // #25 — admission number pehle se hai kya?
  app.get(
    "/api/students/check-admission-no",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const no =
        typeof req.query.no === "string" ? req.query.no : undefined;
      if (!no) {
        return res
          .status(400)
          .json({ message: "Query parameter 'no' is required" });
      }
      const existing = await storage.getStudentByAdmissionNo(schoolId, no);
      res.json({
        admissionNo: no,
        exists: Boolean(existing),
        ...(existing ? { studentId: existing.id } : {}),
      });
    },
  );

  // #26 — admission number se student.
  app.get(
    "/api/students/by-admission-no/:no",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const student = await storage.getStudentByAdmissionNo(
        schoolId,
        req.params.no,
      );
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    },
  );

  // #23 — promote (contract shared/routes.ts me pehle se tha).
  // Sirf wahi students promote honge jo is school ke hain — dusri
  // school ke IDs chup-chaap ignore ho jayenge (leak bhi nahi, kaam
  // bhi nahi).
  app.post(
    "/api/students/promote",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = promoteStudentsSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const inSchool: number[] = [];
      for (const studentId of result.data.studentIds) {
        const student = await storage.getStudent(studentId);
        if (student && student.schoolId === schoolId) {
          inSchool.push(studentId);
        }
      }
      await storage.promoteStudents(inSchool, result.data.targetClass);
      res.json({
        message: `${inSchool.length} student(s) promoted to ${result.data.targetClass}`,
        promotedCount: inSchool.length,
      });
    },
  );

  // #20 — ek student (parent: sirf apna linked baccha).
  app.get(
    "/api/students/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      res.json(loaded.student);
    },
  );

  // #21 — student update. schoolId body se kabhi nahi badlega.
  app.put(
    "/api/students/:id",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = updateStudentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const student = await storage.updateStudent(loaded.student.id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // #22 — deactivate (hard delete NAHI; isActive = 0).
  app.post(
    "/api/students/:id/deactivate",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const student = await storage.updateStudent(loaded.student.id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // #27 — student ki poori fee status (getStudentStatus pehle se tha;
  // year query se, default current year; class student ki apni).
  app.get(
    "/api/students/:id/status",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const year =
        parseOptionalId(
          typeof req.query.year === "string" ? req.query.year : undefined,
        ) ?? new Date().getFullYear();
      const status = await storage.getStudentStatus(
        loaded.student.id,
        loaded.student.class,
        year,
      );
      res.json(status);
    },
  );

  // #28 — documents list (metadata hi; file Phase 3 me ayegi).
  app.get(
    "/api/students/:id/documents",
    requireAuth,
    requireRole("principal", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const documents = await storage.getStudentDocuments(loaded.student.id);
      res.json(documents.map(documentMeta));
    },
  );

  // #29a — document add. Phase 3 Batch C: body me base64Data aaye to
  // asli file content bhi save hota hai (limit ~2MB); bina uske ye
  // pehle jaisa metadata-only document banta hai.
  app.post(
    "/api/students/:id/documents",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = createDocumentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (
        result.data.base64Data &&
        documentTooLarge(result.data.base64Data)
      ) {
        return res.status(400).json({
          message: "Document bahut bada hai — zyada se zyada 2MB ki file chalegi",
        });
      }
      const doc = await storage.createStudentDocument({
        schoolId: loaded.schoolId,
        studentId: loaded.student.id,
        docType: result.data.docType ?? null,
        fileName: result.data.fileName,
        filePath: result.data.filePath ?? null,
        fileData: result.data.base64Data ?? null,
        mimeType: result.data.mimeType ?? null,
      });
      res.status(201).json(documentMeta(doc));
    },
  );

  // #29c — document ki asli file (download/view ke liye). Metadata-only
  // (Phase 2) wale documents ke paas content hai hi nahi — unpar 404.
  app.get(
    "/api/students/:id/documents/:docId/file",
    requireAuth,
    requireRole("principal", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStudentDocument(docId);
      if (!doc || doc.studentId !== loaded.student.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (!doc.fileData) {
        return res
          .status(404)
          .json({ message: "Is document ki file uplabdh nahi hai" });
      }
      res.json({
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        base64Data: doc.fileData,
      });
    },
  );

  // #29b — document metadata delete.
  app.delete(
    "/api/students/:id/documents/:docId",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStudentDocument(docId);
      if (!doc || doc.studentId !== loaded.student.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      await storage.deleteStudentDocument(docId);
      res.json({ message: "Document deleted" });
    },
  );

  // #29d — document approve/reject (v2.3, Arena port #8). Sirf
  // Principal faisla karega; jawab list wala hi documentMeta shape
  // hai (status ke saath) taaki client usi row ko taaza kar sake.
  app.patch(
    "/api/students/:id/documents/:docId/status",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      try {
        const loaded = await loadStudentInScope(req, res);
        if (!loaded) return;
        const docId = parseInt(req.params.docId, 10);
        if (Number.isNaN(docId)) {
          return res.status(400).json({ message: "Invalid ID" });
        }
        const doc = await storage.getStudentDocument(docId);
        if (!doc || doc.studentId !== loaded.student.id) {
          return res.status(404).json({ message: "Document not found" });
        }
        const result = documentStatusBodySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);
        const updated = await storage.updateStudentDocumentStatus(
          docId,
          result.data.status,
        );
        if (!updated) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json(documentMeta(updated));
      } catch (err) {
        console.error("PATCH /api/students/:id/documents/:docId/status failed:", err);
        return res.status(500).json({ message: "Document ka status save nahi ho paya. Dobara koshish karein." });
      }
    },
  );

  // #39 — ek student ke dues (parent: sirf apne bacche ke).
  app.get(
    "/api/students/:id/dues",
    requireAuth,
    requireRole("principal", "accountant", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const dues = await storage.getStudentDues(loaded.student.id);
      res.json(dues);
    },
  );

  // #40 — student par due add (add-student-due).
  app.post(
    "/api/students/:id/dues",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = createDueSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const dueDate = new Date(result.data.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({ message: "Invalid dueDate" });
      }
      const due = await storage.createStudentDue({
        studentId: loaded.student.id,
        feeName: result.data.feeName,
        amount: result.data.amount,
        dueDate,
        isPaid: result.data.isPaid ?? 0,
      });
      res.status(201).json(due);
    },
  );

  // #41 — due delete. Due ka school uske student se check hoga
  // (student_dues me school_id column hai hi nahi).
  app.delete(
    "/api/dues/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const due = await storage.getStudentDue(id);
      if (!due) return res.status(404).json({ message: "Due not found" });
      const student = await storage.getStudent(due.studentId);
      if (!student || student.schoolId !== schoolId) {
        return res.status(404).json({ message: "Due not found" });
      }
      await storage.deleteStudentDue(id);
      res.json({ message: "Due deleted" });
    },
  );

  // #48 — student ka transport route set/clear.
  app.put(
    "/api/students/:id/transport",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const result = studentTransportSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { transportId } = result.data;
      if (transportId != null) {
        const routes = await storage.getTransportRoutes(loaded.schoolId);
        if (!routes.some((route) => route.id === transportId)) {
          return res
            .status(400)
            .json({ message: "Transport route does not belong to this school" });
        }
      }
      const student = await storage.updateStudent(loaded.student.id, {
        transportId,
        updatedAt: new Date(),
      });
      res.json(student);
    },
  );

  // ---------------------------------------------------------------------
  // Fees parity (§5.5) — structures/payments ke bache hue writes,
  // additional fees, transport routes.
  // ---------------------------------------------------------------------

  // #37 — agla receipt number.
  app.get(
    "/api/payments/next-receipt-no",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const receiptNo = await storage.getNextReceiptNo(schoolId);
      res.json({ receiptNo });
    },
  );

  // #36 — payment delete.
  app.delete(
    "/api/payments/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const payments = await storage.getFeePayments(schoolId);
      if (!payments.some((payment) => payment.id === id)) {
        return res.status(404).json({ message: "Payment not found" });
      }
      await storage.deleteFeePayment(id);
      res.json({ message: "Payment deleted" });
    },
  );

  // #32 — fee structure update.
  app.put(
    "/api/fee-structures/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = updateFeeStructureBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const structures = await storage.getFeeStructures(schoolId);
      if (!structures.some((structure) => structure.id === id)) {
        return res.status(404).json({ message: "Fee structure not found" });
      }
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const structure = await storage.updateFeeStructure(id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(structure);
    },
  );

  // #33 — fee structure delete (sirf principal).
  app.delete(
    "/api/fee-structures/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const structures = await storage.getFeeStructures(schoolId);
      if (!structures.some((structure) => structure.id === id)) {
        return res.status(404).json({ message: "Fee structure not found" });
      }
      await storage.deleteFeeStructure(id);
      res.json({ message: "Fee structure deleted" });
    },
  );

  // #42 — additional fees list.
  app.get(
    "/api/additional-fees",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const fees = await storage.getAdditionalFees(schoolId);
      res.json(fees);
    },
  );

  // #43 — additional fee add.
  app.post(
    "/api/additional-fees",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createAdditionalFeeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const fee = await storage.createAdditionalFee({
        ...result.data,
        dueMonth: result.data.dueMonth ?? null,
        schoolId,
      });
      res.status(201).json(fee);
    },
  );

  // #44 — additional fee delete.
  app.delete(
    "/api/additional-fees/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const fee = await storage.getAdditionalFee(id);
      if (!fee || fee.schoolId !== schoolId) {
        return res.status(404).json({ message: "Additional fee not found" });
      }
      await storage.deleteAdditionalFee(id);
      res.json({ message: "Additional fee deleted" });
    },
  );

  // #45 — transport routes list.
  app.get(
    "/api/transport-routes",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const routes = await storage.getTransportRoutes(schoolId);
      res.json(routes);
    },
  );

  // #46 — transport route add.
  app.post(
    "/api/transport-routes",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createTransportRouteBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const route = await storage.createTransportRoute({
        ...result.data,
        schoolId,
      });
      res.status(201).json(route);
    },
  );

  // #46b — transport route edit (v3.3): routeName/amount ke saath
  // vehicleNo/driverName/driverContact bhi badal sakte hain. Scope
  // jaanch DELETE wali hi — route isi school ka hona lazmi.
  app.put(
    "/api/transport-routes/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = updateTransportRouteBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const routes = await storage.getTransportRoutes(schoolId);
      if (!routes.some((route) => route.id === id)) {
        return res.status(404).json({ message: "Transport route not found" });
      }
      const updated = await storage.updateTransportRoute(id, {
        ...result.data,
        updatedAt: new Date(),
      });
      res.json(updated);
    },
  );

  // #47 — transport route delete (sirf principal).
  app.delete(
    "/api/transport-routes/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const routes = await storage.getTransportRoutes(schoolId);
      if (!routes.some((route) => route.id === id)) {
        return res.status(404).json({ message: "Transport route not found" });
      }
      await storage.deleteTransportRoute(id);
      res.json({ message: "Transport route deleted" });
    },
  );

  // ---------------------------------------------------------------------
  // Staff & salary (§5.6)
  // ---------------------------------------------------------------------

  // #51 — ek staff member (salary fields role ke hisaab se, §3 ‡).
  app.get(
    "/api/staff/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      res.json(serializeStaffFor(loaded.member, req.user!.role));
    },
  );

  // #52 — staff update (sirf principal).
  app.put(
    "/api/staff/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const result = updateStaffBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const { schoolId: _ignoredSchoolId, ...updates } = result.data;
      const member = await storage.updateStaff(loaded.member.id, {
        ...updates,
        updatedAt: new Date(),
      });
      res.json(member);
    },
  );

  // #53 — staff deactivate (soft delete; Electron ka delete-staff yahi
  // karta tha — record rehta hai, list se gayab).
  app.post(
    "/api/staff/:id/deactivate",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const member = await storage.updateStaff(loaded.member.id, {
        isActive: 0,
        updatedAt: new Date(),
      });
      res.json(member);
    },
  );

  // #54 — ek staff ki salary history.
  app.get(
    "/api/staff/:id/salary-history",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const history = await storage.getStaffSalaryHistory(loaded.member.id);
      res.json(history);
    },
  );

  // Staff documents (Phase 3 Batch C) — Electron ke upload-staff-document
  // ka REST roop. Roles: dekhna principal/accountant/staff, upload aur
  // delete principal/staff (student documents wale usool par).
  // Jawab me file content kabhi nahi jata — sirf metadata + hasFile;
  // content ke liye /file wala endpoint hai.

  // #54b — ek staff ke documents ki list (metadata).
  app.get(
    "/api/staff/:id/documents",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const documents = await storage.getStaffDocuments(loaded.member.id);
      res.json(documents.map(documentMeta));
    },
  );

  // #54c — staff document upload (base64 content ke saath, limit ~2MB).
  app.post(
    "/api/staff/:id/documents",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const result = createStaffDocumentSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (documentTooLarge(result.data.base64Data)) {
        return res.status(400).json({
          message: "Document bahut bada hai — zyada se zyada 2MB ki file chalegi",
        });
      }
      const doc = await storage.createStaffDocument({
        schoolId: loaded.schoolId,
        staffId: loaded.member.id,
        docType: result.data.docType ?? null,
        fileName: result.data.fileName,
        filePath: result.data.filePath ?? null,
        fileData: result.data.base64Data,
        mimeType: result.data.mimeType ?? null,
      });
      res.status(201).json(documentMeta(doc));
    },
  );

  // #54d — staff document ki asli file (download/view ke liye).
  app.get(
    "/api/staff/:id/documents/:docId/file",
    requireAuth,
    requireRole("principal", "accountant", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStaffDocument(docId);
      if (!doc || doc.staffId !== loaded.member.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (!doc.fileData) {
        return res
          .status(404)
          .json({ message: "Is document ki file uplabdh nahi hai" });
      }
      res.json({
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        base64Data: doc.fileData,
      });
    },
  );

  // #54e — staff document delete.
  app.delete(
    "/api/staff/:id/documents/:docId",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const loaded = await loadStaffInScope(req, res);
      if (!loaded) return;
      const docId = parseInt(req.params.docId, 10);
      if (Number.isNaN(docId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const doc = await storage.getStaffDocument(docId);
      if (!doc || doc.staffId !== loaded.member.id) {
        return res.status(404).json({ message: "Document not found" });
      }
      await storage.deleteStaffDocument(docId);
      res.json({ message: "Document deleted" });
    },
  );

  // #54f — staff document approve/reject (v2.3, Arena port #8).
  // Sirf Principal; jawab documentMeta shape (status ke saath).
  app.patch(
    "/api/staff/:id/documents/:docId/status",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      try {
        const loaded = await loadStaffInScope(req, res);
        if (!loaded) return;
        const docId = parseInt(req.params.docId, 10);
        if (Number.isNaN(docId)) {
          return res.status(400).json({ message: "Invalid ID" });
        }
        const doc = await storage.getStaffDocument(docId);
        if (!doc || doc.staffId !== loaded.member.id) {
          return res.status(404).json({ message: "Document not found" });
        }
        const result = documentStatusBodySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);
        const updated = await storage.updateStaffDocumentStatus(
          docId,
          result.data.status,
        );
        if (!updated) {
          return res.status(404).json({ message: "Document not found" });
        }
        res.json(documentMeta(updated));
      } catch (err) {
        console.error("PATCH /api/staff/:id/documents/:docId/status failed:", err);
        return res.status(500).json({ message: "Document ka status save nahi ho paya. Dobara koshish karein." });
      }
    },
  );

  // Pending salaries — YE route #55 (GET /api/salary-payments) se PEHLE
  // register hona lazmi hai (design §5.6 note): "pending" ek literal
  // segment hai, koi :id route use kha na le isliye order yahi rakha.
  // Pending = active staff jinhone diye month/year me salary nahi payi,
  // aur unka advance/balance hisaab.
  app.get(
    "/api/salary-payments/pending",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const now = new Date();
      const CALENDAR_MONTHS = [
        "January", "February", "March", "April", "May", "June", "July",
        "August", "September", "October", "November", "December",
      ];
      const month =
        typeof req.query.month === "string"
          ? req.query.month
          : CALENDAR_MONTHS[now.getMonth()];
      const year =
        parseOptionalId(
          typeof req.query.year === "string" ? req.query.year : undefined,
        ) ?? now.getFullYear();
      const paid = await storage.getSalaryPayments(schoolId, month, year);
      const paidStaffIds = new Set(paid.map((payment) => payment.staffId));
      const activeStaff = await storage.getStaff(schoolId);
      const pending = activeStaff
        .filter((member) => !paidStaffIds.has(member.id))
        .map((member) => {
          const advance = member.advanceGiven ?? 0;
          return {
            staffId: member.id,
            name: member.name,
            designation: member.designation,
            basicSalary: member.basicSalary,
            advanceGiven: advance,
            pendingAmount: Math.max(0, member.basicSalary - advance),
            month,
            year,
          };
        });
      res.json(pending);
    },
  );

  // #55 — salary payments list (month/year filter ke saath).
  app.get(
    "/api/salary-payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      const year = parseOptionalId(
        typeof req.query.year === "string" ? req.query.year : undefined,
      );
      const payments = await storage.getSalaryPayments(schoolId, month, year);
      res.json(payments);
    },
  );

  // #56 — salary pay.
  app.post(
    "/api/salary-payments",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createSalaryPaymentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const member = await storage.getStaffMember(result.data.staffId);
      if (!member || member.schoolId !== schoolId) {
        return res
          .status(400)
          .json({ message: "Staff does not belong to this school" });
      }
      // GAP-B2 (Phase 3 Batch C) — ek staff ki ek mahine ki salary
      // dusri baar nahi. Electron bhi yahi rokta tha; page ka catch
      // "SALARY_ALREADY_PAID" message ko pehchankar khaas toast
      // dikhata hai, isliye spelling bilkul yahi rakhi hai.
      const monthPayments = await storage.getSalaryPayments(
        schoolId,
        result.data.month,
        result.data.year,
      );
      if (
        monthPayments.some((payment) => payment.staffId === result.data.staffId)
      ) {
        return res.status(409).json({ message: "SALARY_ALREADY_PAID" });
      }
      const payment = await storage.createSalaryPayment({
        schoolId,
        staffId: result.data.staffId,
        month: result.data.month,
        year: result.data.year,
        amount: result.data.amount,
        // GAP-B1 — breakup (na aaye to purani remarks-wali body bhi
        // bilkul pehle jaise chalegi; bonus/deduction ka DB default 0).
        baseSalary: result.data.baseSalary ?? null,
        bonus: result.data.bonus ?? 0,
        deduction: result.data.deduction ?? 0,
        paymentMode: result.data.paymentMode ?? null,
        paymentDate: result.data.paymentDate ?? null,
        remarks: result.data.remarks ?? null,
      });
      res.status(201).json(payment);
    },
  );

  // #57 — salary payment delete.
  app.delete(
    "/api/salary-payments/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const payments = await storage.getSalaryPayments(schoolId);
      if (!payments.some((payment) => payment.id === id)) {
        return res.status(404).json({ message: "Salary payment not found" });
      }
      await storage.deleteSalaryPayment(id);
      res.json({ message: "Salary payment deleted" });
    },
  );

  // ---------------------------------------------------------------------
  // Expenses & reports (§5.7)
  // ---------------------------------------------------------------------

  // #58 — expenses list.
  app.get(
    "/api/expenses",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const expenseList = await storage.getExpenses(schoolId);
      res.json(expenseList);
    },
  );

  // #59 — expense add.
  app.post(
    "/api/expenses",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createExpenseBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const expense = await storage.createExpense({
        schoolId,
        title: result.data.title,
        category: result.data.category ?? null,
        amount: result.data.amount,
        expenseDate: result.data.expenseDate ?? null,
        remarks: result.data.remarks ?? null,
      });
      res.status(201).json(expense);
    },
  );

  // #60 — expense delete.
  app.delete(
    "/api/expenses/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const expense = await storage.getExpense(id);
      if (!expense || expense.schoolId !== schoolId) {
        return res.status(404).json({ message: "Expense not found" });
      }
      await storage.deleteExpense(id);
      res.json({ message: "Expense deleted" });
    },
  );

  // #61 — financial summary (fees − salary − expenses + pending dues).
  app.get(
    "/api/reports/financial-summary",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const summary = await storage.getFinancialSummary(schoolId);
      res.json(summary);
    },
  );

  // #62 — month-wise financial trend.
  app.get(
    "/api/reports/financial-trend",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const trend = await storage.getFinancialTrend(schoolId);
      res.json(trend);
    },
  );

  // #63 — dashboard stats (counts + aaj/is mahine ki collection).
  app.get(
    "/api/reports/dashboard",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const stats = await storage.getDashboardStats(schoolId);
      res.json(stats);
    },
  );

  // ---------------------------------------------------------------------
  // Exams, marks, results (§5.8 #64–69)
  // ---------------------------------------------------------------------

  const loadExamInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; exam: NonNullable<Awaited<ReturnType<typeof storage.getExam>>> } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const exam = await storage.getExam(id);
    if (!exam || exam.schoolId !== schoolId) {
      res.status(404).json({ message: "Exam not found" });
      return null;
    }
    return { schoolId, exam };
  };

  // #64 — exams list. Parent ko sirf apne baccho ki class wale exams
  // dikhenge (exam class-level hota hai, student-level nahi).
  // v1.7: (a) "accountant" joda gaya — Broadsheet office screen hai aur
  // accountant ko exams ki list padhni padti hai (marks wala GET bhi
  // neeche usi wajah se khula hai; likhna ab bhi principal/teacher hi).
  // (b) Parent ko sirf APPROVED exams dikhte hain — draft exam parent
  // ke liye "hai hi nahi" (baaki parent-filter wala † usool). Purani
  // rows par resultsStatus null/na ho to 'approved' mana jata hai
  // (column ka default hi wahi hai).
  app.get(
    "/api/exams",
    requireAuth,
    requireRole("principal", "teacher", "staff", "parent", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      let examList = await storage.getExams(schoolId);
      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        const classNames = new Set<string>();
        for (const studentId of linkedIds) {
          const student = await storage.getStudent(studentId);
          if (student) classNames.add(student.class);
        }
        examList = examList.filter(
          (exam) =>
            classNames.has(exam.class) &&
            (exam.resultsStatus ?? "approved") === "approved",
        );
      }
      res.json(examList);
    },
  );

  // #65 — exam create.
  app.post(
    "/api/exams",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createExamBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const exam = await storage.createExam({
        schoolId,
        // v1.7: naya exam HAMESHA 'draft' se shuru hota hai — marks
        // bhar kar principal approve kare tabhi parent ko dikhega.
        // (Column ka DB default 'approved' sirf purani live rows ke
        // liye hai; yahan default par bharosa NAHI kiya gaya.)
        resultsStatus: "draft",
        examName: result.data.examName,
        examType: result.data.examType ?? null,
        class: result.data.class,
        section: result.data.section ?? null,
        subject: result.data.subject ?? null,
        maxMarks: result.data.maxMarks ?? 100,
        passingMarks: result.data.passingMarks ?? null,
        examDate: result.data.examDate ?? null,
        session: result.data.session ?? null,
      });
      res.status(201).json(exam);
    },
  );

  // #66 — exam delete (uske marks bhi saath delete hote hain, storage me).
  app.delete(
    "/api/exams/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      await storage.deleteExam(loaded.exam.id);
      res.json({ message: "Exam deleted" });
    },
  );

  // #66b — Result approval (v1.7): exam ki results_status badalna.
  // SIRF principal — teacher marks bharta hai, approve principal
  // karta hai (Skuul wala workflow). Jawab updated exam hai, taaki
  // client badge turant badal sake.
  app.post(
    "/api/exams/:id/results-status",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      const result = resultsStatusBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const updated = await storage.updateExamResultsStatus(
        loaded.exam.id,
        result.data.status,
      );
      if (!updated) {
        return res.status(404).json({ message: "Exam not found" });
      }
      res.json(updated);
    },
  );

  // #67 — ek exam ke marks. Parent: sirf apne linked baccho ke marks.
  app.get(
    "/api/exams/:id/marks",
    requireAuth,
    requireRole("principal", "teacher", "parent", "accountant"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      // v1.7: parent ke liye draft exam ke marks "hain hi nahi" —
      // 404, bilkul dusri-school wale exam jaisa (§3.1.4 ka † usool).
      if (
        req.user!.role === "parent" &&
        (loaded.exam.resultsStatus ?? "approved") !== "approved"
      ) {
        return res.status(404).json({ message: "Exam not found" });
      }
      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        const rows = await storage.getMarksForStudents(
          loaded.exam.id,
          linkedIds,
        );
        return res.json(rows);
      }
      const rows = await storage.getExamMarks(loaded.exam.id);
      res.json(rows);
    },
  );

  // #68 — marks bulk save. Body ke har student ka is school ka hona
  // lazmi hai; ek bhi bahar ka student ho to poora batch reject (400)
  // — aadha save karke halla nahi.
  app.post(
    "/api/exams/:id/marks",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadExamInScope(req, res);
      if (!loaded) return;
      const result = saveMarksBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      for (const entry of result.data.marks) {
        const student = await storage.getStudent(entry.studentId);
        if (!student || student.schoolId !== loaded.schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      const saved = await storage.saveExamMarks(
        loaded.exam.id,
        loaded.schoolId,
        result.data.marks.map((entry) => ({
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          remarks: entry.remarks ?? null,
        })),
      );
      res.json(saved);
    },
  );

  // #69 — ek student ke saare results (exam ki detail ke saath).
  // Parent: sirf apna linked baccha loadStudentInScope se pakka hai.
  app.get(
    "/api/students/:id/results",
    requireAuth,
    requireRole("principal", "teacher", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const rows = await storage.getStudentMarks(loaded.student.id);
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const exam = await storage.getExam(row.examId);
          return {
            ...row,
            examName: exam?.examName ?? null,
            examType: exam?.examType ?? null,
            subject: exam?.subject ?? null,
            maxMarks: exam?.maxMarks ?? null,
            passingMarks: exam?.passingMarks ?? null,
            examDate: exam?.examDate ?? null,
            // v1.7: office roles ko badge ke liye haalat saath jati
            // hai (purani rows = 'approved')...
            resultsStatus: exam?.resultsStatus ?? "approved",
          };
        }),
      );
      // ...lekin parent ko draft exam ki rows jawab me JATI HI NAHI
      // (ReportCards ka data-rasta bhi yahi hai — wahan alag se kuch
      // karna nahi padta, khaali list par page apna sandesh dikhata
      // hai). Principal/teacher ko sab dikhta hai.
      const visible =
        req.user!.role === "parent"
          ? enriched.filter((row) => row.resultsStatus === "approved")
          : enriched;
      res.json(visible);
    },
  );

  // ---------------------------------------------------------------------
  // Attendance (v1.5 #73–76) — Gibbon/RosarioSIS se seekha design:
  // hajri roz class-wise EK bulk save me lagti hai, default "present"
  // (client sab ko present rakh kar sirf exceptions badalta hai), aur
  // dobara bhejne par wahi din ki hajri update hoti hai (upsert).
  // Mark karna sirf principal/teacher (marks-entry #68 wala usool —
  // hajri class-teacher ka kaam hai; accountant ka kaam fees hai).
  // Padhna: school staff sab; parent sirf apne linked bacche ka
  // (loadStudentInScope ka † niyam — dusra baccha = 404).
  // ---------------------------------------------------------------------

  // #73 — ek class ki ek date ki hajri (roster ke saath mili hui).
  // status null = us din ki hajri abhi lagi hi nahi.
  app.get(
    "/api/attendance",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const className =
        typeof req.query.class === "string" ? req.query.class : undefined;
      if (!className) {
        return res.status(400).json({ message: "class query parameter is required" });
      }
      const section =
        typeof req.query.section === "string" ? req.query.section : undefined;
      // v1.8 hotfix: date aaya hi na ho YA khaali string ho — dono
      // haalat me aaj ki tareekh. Android par date ka dabba saaf
      // karne se client "date=" (khaali) bhej deta tha aur ye handler
      // 400 de raha tha, jabki date asal me OPTIONAL (default aaj)
      // hai. 400 ab sirf tab hai jab kuch likha ho aur wo
      // YYYY-MM-DD na ho.
      const rawDate =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      const date =
        rawDate === "" ? new Date().toISOString().slice(0, 10) : rawDate;
      if (!DATE_TEXT_RE.test(date)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      const students = await storage.getStudents(schoolId, {
        class: className,
        section,
      });
      const active = students.filter((student) => student.isActive !== 0);
      const rows = await storage.getAttendanceForStudents(
        active.map((student) => student.id),
        date,
      );
      const byStudent = new Map(rows.map((row) => [row.studentId, row]));
      res.json(
        active.map((student) => {
          const row = byStudent.get(student.id);
          return {
            studentId: student.id,
            name: student.name,
            rollNo: student.rollNo,
            class: student.class,
            section: student.section,
            status: row?.status ?? null,
            remarks: row?.remarks ?? null,
            markedBy: row?.markedBy ?? null,
          };
        }),
      );
    },
  );

  // #74 — hajri bulk mark/update. Body ke har student ka is school ka
  // hona lazmi hai; ek bhi bahar ka ho to poora batch reject (400) —
  // marks #68 wala hi usool, aadha save karke halla nahi.
  app.post(
    "/api/attendance",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = markAttendanceBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      for (const entry of result.data.entries) {
        const student = await storage.getStudent(entry.studentId);
        if (!student || student.schoolId !== schoolId) {
          return res.status(400).json({
            message: "One or more students do not belong to this school",
          });
        }
      }
      const saved = await storage.markAttendanceBulk(
        schoolId,
        req.user!.id,
        result.data.date,
        result.data.entries.map((entry) => ({
          studentId: entry.studentId,
          status: entry.status,
          remarks: entry.remarks ?? null,
        })),
      );
      res.json(saved);
    },
  );

  // ---------------------------------------------------------------------
  // Attendance office reports (v1.7 #77–78) — NICHOD ABHI #4:
  // (a) RosarioSIS "Teacher Completion" — kis class ki hajri NAHI lagi;
  // (b) Gibbon "Consecutive Absences" — lagatar absent baccho ki list,
  // parent ko phone karne ke liye contact ke saath.
  // Padhna: principal/teacher/accountant (office ke teeno kaam ke log).
  // Staff/parent ko ye reports nahi miltin — parent apne bacche ka
  // summary pehle ki tarah Student Profile se dekhta hai. Hisaab aur
  // paribhashayein storage ke compute* helpers me hain.
  // Dhyaan: ye literal paths /api/attendance (GET/POST) ke baad aur
  // /api/students/:id/attendance se pehle hain — koi ":id" wala route
  // /api/attendance/* par hai hi nahi, isliye takraav nahi.
  // ---------------------------------------------------------------------

  // #77 — ek date par kin class+section groups ki hajri lagi / nahi
  // lagi (ginti ke saath). date na diya to aaj (server ki tareekh).
  app.get(
    "/api/attendance/reports/missing",
    requireAuth,
    requireRole("principal", "teacher", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      // v1.8 hotfix: upar wale roster handler wala hi niyam —
      // khaali date ("date=") ka matlab "aaj" hai, 400 nahi.
      const rawDate =
        typeof req.query.date === "string" ? req.query.date.trim() : "";
      const date =
        rawDate === "" ? new Date().toISOString().slice(0, 10) : rawDate;
      if (!DATE_TEXT_RE.test(date)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      const report = await storage.getAttendanceMissingReport(schoolId, date);
      res.json(report);
    },
  );

  // #78 — lagatar absent list. days query: default 3, 1–30 ke beech;
  // isse bahar ho to 400 (chup-chaap clamp karke galat report nahi).
  app.get(
    "/api/attendance/reports/absent-streak",
    requireAuth,
    requireRole("principal", "teacher", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      let days = 3;
      if (typeof req.query.days === "string") {
        const parsed = parseInt(req.query.days, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
          return res
            .status(400)
            .json({ message: "days must be an integer between 1 and 30" });
        }
        days = parsed;
      }
      const entries = await storage.getAbsentStreakReport(schoolId, days);
      res.json({ days, count: entries.length, entries });
    },
  );

  // #75 — ek student ki hajri history (month=YYYY-MM diya to sirf wo
  // mahina, warna saari). Parent: sirf apna linked baccha
  // (loadStudentInScope — dusra baccha 404).
  app.get(
    "/api/students/:id/attendance",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const month =
        typeof req.query.month === "string" ? req.query.month : undefined;
      if (month !== undefined && !MONTH_TEXT_RE.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }
      const rows = await storage.getStudentAttendance(
        loaded.student.id,
        month,
      );
      res.json(rows);
    },
  );

  // #76 — ek student ka mahina-summary (present/absent/late/half_day
  // ginti + percentage). month na diya to chal raha mahina.
  app.get(
    "/api/students/:id/attendance/summary",
    requireAuth,
    requireRole("principal", "teacher", "accountant", "staff", "parent"),
    async (req, res) => {
      const loaded = await loadStudentInScope(req, res);
      if (!loaded) return;
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const month =
        typeof req.query.month === "string" ? req.query.month : currentMonth;
      if (!MONTH_TEXT_RE.test(month)) {
        return res.status(400).json({ message: "month must be YYYY-MM" });
      }
      const summary = await storage.getStudentAttendanceSummary(
        loaded.student.id,
        month,
      );
      res.json(summary);
    },
  );

  // ---------------------------------------------------------------------
  // Parent overview (v2.0, Arena port #5) — parent login ke baad ki
  // home screen ka EK call. Jawab buildParentOverviewImpl banata hai:
  // har linked bacche ka profile, is mahine ki hajri, fee status
  // (getStudentStatus wala hi hisaab — Fees page se hamesha mail),
  // approved results ka exam-wise summary, class timetable, aur
  // school ke parent-visible notices.
  // † niyam: bacche SIRF parent_students links se aate hain — is
  // route me koi :id/studentId parameter hai hi nahi jise badalkar
  // dusre ka baccha dekha ja sake. Sirf parent role; baaki roles ko
  // ye screen chahiye hi nahi (unke apne pages hain).
  // ---------------------------------------------------------------------
  app.get(
    "/api/parent/overview",
    requireAuth,
    requireRole("parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const overview = await storage.getParentOverview(
        schoolId,
        req.user!.id,
      );
      res.json(overview);
    },
  );

  // ---------------------------------------------------------------------
  // Notices (§5.8 #70–72) — audience: all | teachers | parents.
  // Parent ko teachers-wale notices kabhi nahi; teacher/staff ko
  // parents-wale nahi. Principal/accountant/super-hooked roles sab
  // dekh sakte hain (principal sab, accountant read-only).
  // ---------------------------------------------------------------------

  const noticeVisibleTo = (
    audience: string | null,
    role: string,
  ): boolean => {
    if (role === "principal" || role === "super_admin") return true;
    if (audience === "all") return true;
    if (audience === "teachers") {
      return role === "teacher" || role === "accountant";
    }
    if (audience === "parents") {
      return role === "parent" || role === "accountant";
    }
    return false;
  };

  const loadNoticeInScope = async (
    req: Request,
    res: Response,
  ): Promise<{ schoolId: number; notice: NonNullable<Awaited<ReturnType<typeof storage.getNotice>>> } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const notice = await storage.getNotice(id);
    if (!notice || notice.schoolId !== schoolId) {
      res.status(404).json({ message: "Notice not found" });
      return null;
    }
    return { schoolId, notice };
  };

  // #70 — notices list (koi bhi logged-in user, audience filter ke saath).
  app.get("/api/notices", requireAuth, async (req, res) => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return;
    const all = await storage.getNotices(schoolId);
    res.json(
      all.filter((notice) => noticeVisibleTo(notice.audience, req.user!.role)),
    );
  });

  // #71 — notice create.
  app.post(
    "/api/notices",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createNoticeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const notice = await storage.createNotice({
        schoolId,
        title: result.data.title,
        body: result.data.body ?? null,
        audience: result.data.audience ?? "all",
        createdBy: req.user!.id,
      });
      res.status(201).json(notice);
    },
  );

  // #72a — notice update. Principal kisi ka bhi; teacher sirf APNA
  // banaya hua (dusre ka = 404, §5.8).
  app.put(
    "/api/notices/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadNoticeInScope(req, res);
      if (!loaded) return;
      if (
        req.user!.role === "teacher" &&
        loaded.notice.createdBy !== req.user!.id
      ) {
        return res.status(404).json({ message: "Notice not found" });
      }
      const result = updateNoticeBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const notice = await storage.updateNotice(loaded.notice.id, {
        ...(result.data.title !== undefined
          ? { title: result.data.title }
          : {}),
        ...(result.data.body !== undefined ? { body: result.data.body } : {}),
        ...(result.data.audience !== undefined
          ? { audience: result.data.audience }
          : {}),
        updatedAt: new Date(),
      });
      res.json(notice);
    },
  );

  // #72b — notice delete (ownership niyam update jaisa hi).
  app.delete(
    "/api/notices/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const loaded = await loadNoticeInScope(req, res);
      if (!loaded) return;
      if (
        req.user!.role === "teacher" &&
        loaded.notice.createdBy !== req.user!.id
      ) {
        return res.status(404).json({ message: "Notice not found" });
      }
      await storage.deleteNotice(loaded.notice.id);
      res.json({ message: "Notice deleted" });
    },
  );

  // =======================================================================
  // v1.7 FIN — Fee kishten (installments) + Backup/Export
  //
  // Dono endpoints is alag block me hain taaki dusre workstreams ke
  // saath merge saaf rahe. Niyam purane hi hain: schoolId sirf token
  // se (requireSchoolId), dusri school ka data kabhi nahi.
  // =======================================================================

  // #77 — Ek class ke SAARE active students ke liye kishten ek saath
  // banao (Frappe fee-schedule wala kaam, humare student_dues par).
  // Har kisht ek student_dues row hai — isliye bani hui kishten Fees
  // page ki Pending Dues me apne aap dikhengi aur maujooda
  // dueSettlements wala settlement unpar bilkul pehle jaisa chalega
  // (use yahan chheda hi nahi gaya hai).
  // Dobara wahi request bhejne par pehle se maujood kishten (title +
  // dueDate wali pehchan, storage v1.7 note) SKIP hoti hain — jawab
  // me { created, skipped } ki sachhi ginti aati hai, aadhi safalta
  // chhupti nahi.
  app.post(
    "/api/fees/installments/generate",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = generateInstallmentsBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const installments: Array<{ title: string; amount: number; dueDate: Date }> = [];
      for (const inst of result.data.installments) {
        const dueDate = new Date(inst.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          return res
            .status(400)
            .json({ message: `Invalid dueDate: ${inst.dueDate}` });
        }
        installments.push({
          title: inst.title.trim(),
          amount: inst.amount,
          dueDate,
        });
      }
      const outcome = await storage.generateInstallmentDues(
        schoolId,
        result.data.className,
        installments,
      );
      res.status(201).json({
        className: result.data.className,
        studentCount: outcome.studentCount,
        installmentCount: installments.length,
        created: outcome.created,
        skipped: outcome.skipped,
      });
    },
  );

  // #78 — Poora school data ek JSON me (backup). Principal (apna
  // school) + v3.0 se Super Admin (?schoolId=, Master App testing):
  // jawab me salary ki rakam aur saare students ka personal data
  // hota hai, isliye accountant/teacher ko nahi. Seedha JSON
  // response hai (koi zip library nahi) — client use file banakar
  // download karta hai. Users/password-hash isme kabhi nahi jate
  // (storage ke SchoolExportData ka design note dekho).
  app.get(
    "/api/export/school",
    requireAuth,
    requireRole("principal", "super_admin"),
    async (req, res) => {
      // v3.0: Super Admin (Master App, apni testing ke liye) ko
      // ?schoolId= ke saath kisi ek school ka backup lene ki chhoot —
      // principal ke liye pehle jaisa hi token wala school. Jawab
      // hamesha SIRF usi ek school ka data (storage schoolId par
      // filter karta hai) — dusre school ka data mix nahi hota.
      let schoolId: number | null;
      if (req.user!.role === "super_admin") {
        const raw = Number(req.query.schoolId);
        if (!Number.isInteger(raw) || raw <= 0) {
          return res
            .status(400)
            .json({ message: "schoolId query parameter is required" });
        }
        const school = await storage.getSchool(raw);
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }
        schoolId = raw;
      } else {
        schoolId = requireSchoolId(req, res);
        if (schoolId == null) return;
      }
      const data = await storage.getSchoolExport(schoolId);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="school-backup-${schoolId}.json"`,
      );
      res.json(data);
    },
  );

  // ---------------------------------------------------------------------
  // Timetable (v1.7 #77–79) — saada haath-se-bana class timetable.
  // Dekhna: school ke sab roles; parent sirf APNE bacche ki class ka
  // (className dusri class ka maange to khaali list — payments wale
  // parent-filter jaisa; className na de to bacche ki class khud
  // lag jati hai). Badalna: sirf principal/teacher (hajri/marks
  // wala hi usool — class ka kaam class-teacher/principal ka hai).
  // Jawab me teacherName saath jata hai kyunki parent GET /api/staff
  // nahi padh sakta — bina naam ke use "Teacher #5" dikhta.
  // ---------------------------------------------------------------------

  const withTeacherName = async (
    rows: Awaited<ReturnType<typeof storage.getTimetableEntries>>,
  ) => {
    const out = [];
    for (const row of rows) {
      let teacherName: string | null = null;
      if (row.teacherId != null) {
        const member = await storage.getStaffMember(row.teacherId);
        // Dusri school ke staff id par naam kabhi nahi (scope jaanch).
        if (member && member.schoolId === row.schoolId) {
          teacherName = member.name;
        }
      }
      out.push({ ...row, teacherName });
    }
    return out;
  };

  // #77 — ek class ka poora hafta (din/period kram me, storage deta hai).
  app.get(
    "/api/timetable",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      let className =
        typeof req.query.className === "string"
          ? req.query.className
          : undefined;

      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        const childClasses = new Set<string>();
        for (const studentId of linkedIds) {
          const student = await storage.getStudent(studentId);
          if (student) childClasses.add(student.class);
        }
        if (className != null) {
          // Dusri class maangi — parent ke liye wo "hai hi nahi".
          if (!childClasses.has(className)) return res.json([]);
        } else {
          // Class na di ho to pehle linked bacche ki class.
          className = Array.from(childClasses)[0];
          if (!className) return res.json([]);
        }
      }

      if (!className) {
        return res
          .status(400)
          .json({ message: "className query parameter is required" });
      }
      const rows = await storage.getTimetableEntries(schoolId, className);
      res.json(await withTeacherName(rows));
    },
  );

  // #78 — ek entry upsert: (school, class, day, period) par maujood
  // ho to wahi entry badalti hai, warna nayi banti hai. teacherId
  // aaya ho to wo staff ISI school ka hona lazmi (warna 400).
  // v2.0: teacher usi din/period me dusri class me pehle se ho to
  // 409 TIMETABLE_TEACHER_CLASH (neeche handler me jaanch).
  app.post(
    "/api/timetable",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = upsertTimetableBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (result.data.teacherId != null) {
        const member = await storage.getStaffMember(result.data.teacherId);
        if (!member || member.schoolId !== schoolId) {
          return res
            .status(400)
            .json({ message: "Teacher does not belong to this school" });
        }
        // Clash jaanch (v2.0, Arena port #1): wahi teacher, wahi
        // school, wahi din + period, lekin DUSRI class = teacher
        // double-booked — 409. Apni hi class ka wahi slot upsert ka
        // target hai (update), clash nahi. Class ka apna clash
        // (ek class, ek din/period, do entries) schema ke unique
        // index + is upsert se pehle se hi namumkin hai — dusri
        // entry banti hi nahi, wahi entry update hoti hai.
        const teacherEntries = await storage.getTimetableEntriesByTeacher(
          schoolId,
          result.data.teacherId,
        );
        const clash = teacherEntries.find(
          (entry) =>
            entry.dayOfWeek === result.data.dayOfWeek &&
            entry.periodNo === result.data.periodNo &&
            entry.className !== result.data.className,
        );
        if (clash) {
          const dayNames = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ];
          const dayName =
            dayNames[clash.dayOfWeek - 1] ?? `Day ${clash.dayOfWeek}`;
          return res.status(409).json({
            code: "TIMETABLE_TEACHER_CLASH",
            message:
              `Teacher ${member.name} is samay pehle se Class ${clash.className} ` +
              `me padha rahe hain (${dayName}, Period ${clash.periodNo} — ${clash.subject}). ` +
              `Ek teacher ek hi samay par do class me nahi padha sakta.`,
          });
        }
      }
      const saved = await storage.upsertTimetableEntry({
        schoolId,
        className: result.data.className,
        dayOfWeek: result.data.dayOfWeek,
        periodNo: result.data.periodNo,
        subject: result.data.subject,
        teacherId: result.data.teacherId ?? null,
      });
      res.json((await withTeacherName([saved]))[0]);
    },
  );

  // #79 — entry delete. Dusri school ki entry = 404 (§3.1.4).
  app.delete(
    "/api/timetable/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const entry = await storage.getTimetableEntry(id);
      if (!entry || entry.schoolId !== schoolId) {
        return res.status(404).json({ message: "Timetable entry not found" });
      }
      await storage.deleteTimetableEntry(id);
      res.json({ message: "Timetable entry deleted" });
    },
  );

  // ---------------------------------------------------------------------
  // Library (v1.7 #85–91, NICHOD #12) — saada catalog + issue/return.
  // Prabandh (banana/badla/issue/return) = principal/accountant/
  // teacher; dekhna = saare school roles; parent = sirf apne linked
  // baccho ki issued kitabein (payments wala † niyam — dusre bacche
  // ki kitab parent ke liye hai hi nahi).
  // Uplabdh copies = copiesTotal − active (returned_at null) issues;
  // issue ki jaanch SERVER par hai — client ki ginti par bharosa nahi.
  // ---------------------------------------------------------------------

  const withBookAvailability = async (
    book: NonNullable<Awaited<ReturnType<typeof storage.getLibraryBook>>>,
  ) => {
    const active = await storage.countActiveLibraryIssues(book.id);
    return {
      ...book,
      issuedCopies: active,
      availableCopies: Math.max(0, (book.copiesTotal ?? 0) - active),
    };
  };

  const enrichLibraryIssue = async (
    issue: Awaited<ReturnType<typeof storage.getLibraryIssues>>[number],
  ) => {
    const [book, student] = await Promise.all([
      storage.getLibraryBook(issue.bookId),
      storage.getStudent(issue.studentId),
    ]);
    return {
      ...issue,
      bookTitle: book?.title ?? null,
      bookAuthor: book?.author ?? null,
      studentName: student?.name ?? null,
      studentClass: student?.class ?? null,
      studentSection: student?.section ?? null,
    };
  };

  const loadLibraryBookInScope = async (
    req: Request,
    res: Response,
  ): Promise<{
    schoolId: number;
    book: NonNullable<Awaited<ReturnType<typeof storage.getLibraryBook>>>;
  } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid ID" });
      return null;
    }
    const book = await storage.getLibraryBook(id);
    if (!book || book.schoolId !== schoolId) {
      res.status(404).json({ message: "Book not found" });
      return null;
    }
    return { schoolId, book };
  };

  // #85 — kitabon ki list (har kitab ke saath uplabdh ginti).
  app.get(
    "/api/library/books",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const books = await storage.getLibraryBooks(schoolId);
      res.json(await Promise.all(books.map(withBookAvailability)));
    },
  );

  // #86 — nayi kitab.
  app.post(
    "/api/library/books",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createLibraryBookBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const book = await storage.createLibraryBook({
        schoolId,
        title: result.data.title,
        author: result.data.author ?? null,
        copiesTotal: result.data.copiesTotal ?? 1,
      });
      res.status(201).json(await withBookAvailability(book));
    },
  );

  // #87 — kitab badlo. Copies kul ginti active issues se kam nahi ho
  // sakti (bahar gayi kitab ko "gayab" nahi dikha sakte).
  app.put(
    "/api/library/books/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const loaded = await loadLibraryBookInScope(req, res);
      if (!loaded) return;
      const result = updateLibraryBookBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      if (result.data.copiesTotal !== undefined) {
        const active = await storage.countActiveLibraryIssues(loaded.book.id);
        if (result.data.copiesTotal < active) {
          return res.status(400).json({
            message: `Is kitab ki ${active} copies abhi issue hain — kul copies isse kam nahi ho sakti`,
          });
        }
      }
      const book = await storage.updateLibraryBook(loaded.book.id, {
        ...(result.data.title !== undefined
          ? { title: result.data.title }
          : {}),
        ...(result.data.author !== undefined
          ? { author: result.data.author }
          : {}),
        ...(result.data.copiesTotal !== undefined
          ? { copiesTotal: result.data.copiesTotal }
          : {}),
        updatedAt: new Date(),
      });
      res.json(await withBookAvailability(book));
    },
  );

  // #88 — kitab delete. Issue ka record (active ya purana) ho to
  // delete nahi — warna history ka FK tootega aur hisaab bigdega.
  app.delete(
    "/api/library/books/:id",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const loaded = await loadLibraryBookInScope(req, res);
      if (!loaded) return;
      const allIssues = await storage.getLibraryIssues(loaded.schoolId);
      if (allIssues.some((issue) => issue.bookId === loaded.book.id)) {
        return res.status(400).json({
          message:
            "Is kitab ka issue record hai — pehle saari copies wapas aayein, kitab delete nahi hogi (record suraksha ke liye)",
        });
      }
      await storage.deleteLibraryBook(loaded.book.id);
      res.json({ message: "Book deleted" });
    },
  );

  // #89 — issued kitabon ki list. ?studentId= filter; ?status=active
  // sirf bahar gayi hui. Parent: studentId diya ho aur linked na ho
  // to khaali list (payments wala † niyam); na diya ho to sirf apne
  // linked baccho ki kitabein.
  app.get(
    "/api/library/issues",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const studentId = parseOptionalId(req.query.studentId);
      const activeOnly = req.query.status === "active";
      if (req.user!.role === "parent") {
        const linkedIds = await parentLinkedStudentIds(req);
        if (studentId != null && !linkedIds.includes(studentId)) {
          return res.json([]);
        }
        const rows = await storage.getLibraryIssues(schoolId, {
          studentIds: studentId != null ? [studentId] : linkedIds,
          activeOnly,
        });
        return res.json(await Promise.all(rows.map(enrichLibraryIssue)));
      }
      const rows = await storage.getLibraryIssues(schoolId, {
        studentId: studentId ?? undefined,
        activeOnly,
      });
      res.json(await Promise.all(rows.map(enrichLibraryIssue)));
    },
  );

  // #90 — kitab issue karo. Uplabdh jaanch SERVER par: active issues
  // copiesTotal ke barabar/zyada hon to 400 — do copies wali kitab ki
  // teesri issue kabhi nahi banegi, client kuch bhi dikhaye.
  app.post(
    "/api/library/issues",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createLibraryIssueBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const book = await storage.getLibraryBook(result.data.bookId);
      if (!book || book.schoolId !== schoolId) {
        return res.status(400).json({ message: "Book does not belong to this school" });
      }
      const student = await storage.getStudent(result.data.studentId);
      if (!student || student.schoolId !== schoolId) {
        return res.status(400).json({ message: "Student does not belong to this school" });
      }
      const active = await storage.countActiveLibraryIssues(book.id);
      if (active >= (book.copiesTotal ?? 0)) {
        return res.status(400).json({
          message: "Is kitab ki saari copies pehle se issue hain — uplabdh copies khatm",
        });
      }
      const issueDate =
        result.data.issueDate ?? new Date().toISOString().slice(0, 10);
      // Due date na aaye to issue se 14 din baad (aam library niyam).
      const dueDate =
        result.data.dueDate ??
        new Date(new Date(`${issueDate}T00:00:00Z`).getTime() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
      const issue = await storage.createLibraryIssue({
        schoolId,
        bookId: book.id,
        studentId: student.id,
        issueDate,
        dueDate,
        returnedAt: null,
      });
      res.status(201).json(await enrichLibraryIssue(issue));
    },
  );

  // #91 — kitab wapas (return). Pehle se wapas aa chuki ho to 400 —
  // dohra return hisaab bigad dega.
  app.post(
    "/api/library/issues/:id/return",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const issue = await storage.getLibraryIssue(id);
      if (!issue || issue.schoolId !== schoolId) {
        return res.status(404).json({ message: "Issue not found" });
      }
      if (issue.returnedAt != null) {
        return res.status(400).json({ message: "Ye kitab pehle hi wapas aa chuki hai" });
      }
      const returned = await storage.returnLibraryIssue(issue.id);
      res.json(await enrichLibraryIssue(returned));
    },
  );

  // ---------------------------------------------------------------------
  // Online Payment — Razorpay (v1.7 #92–94, NICHOD #9 ki jagah is
  // batch ka #11). IMAANDAAR design:
  //  - Keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env) na hon to
  //    config enabled:false deta hai aur order 503 — koi nakli
  //    safalta, koi test-mode jhooth NAHI hai.
  //  - Order asal Razorpay Orders API se banta hai (global fetch,
  //    koi nayi dependency nahi).
  //  - Fee payment ka record TABHI banta hai jab verify me
  //    HMAC-SHA256 signature asal secret se mil jaye — galat
  //    signature par 400 aur record bilkul NAHI banta.
  //  - Parent sirf apne linked bacche ke liye; principal/accountant
  //    apne school ke kisi bhi student ke liye.
  // ---------------------------------------------------------------------

  const razorpayKeys = () => {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    return keyId && keySecret ? { keyId, keySecret } : null;
  };

  // Online raste ke liye student scope (loadStudentInScope params.id
  // par hai, yahan studentId body se aata hai — isliye alag helper,
  // niyam bilkul wahi: dusri school/dusra baccha = 404).
  const loadOnlineStudent = async (
    req: Request,
    res: Response,
    studentId: number,
  ): Promise<{ schoolId: number; student: Student } | null> => {
    const schoolId = requireSchoolId(req, res);
    if (schoolId == null) return null;
    const student = await storage.getStudent(studentId);
    if (!student || student.schoolId !== schoolId) {
      res.status(404).json({ message: "Student not found" });
      return null;
    }
    if (req.user!.role === "parent") {
      const links = await storage.getParentStudentLinks(req.user!.id);
      if (!links.some((link) => link.studentId === student.id)) {
        res.status(404).json({ message: "Student not found" });
        return null;
      }
    }
    return { schoolId, student };
  };

  // #92 — online payment chalu hai ya nahi (Fees page ka button yahi
  // pehle poochta hai). keyId public jaankari hai (checkout me wahi
  // jata hai); secret kabhi jawab me NAHI jata.
  app.get(
    "/api/payments/online/config",
    requireAuth,
    requireRole("principal", "accountant", "parent"),
    async (req, res) => {
      const keys = razorpayKeys();
      if (!keys) return res.json({ enabled: false });
      res.json({ enabled: true, keyId: keys.keyId });
    },
  );

  // #93 — Razorpay order banao. Rakam rupaye me aati hai, Razorpay
  // ko paise me jati hai. Receipt number humara apna pattern
  // (getNextReceiptNo) — order ke saath bandha rehta hai.
  app.post(
    "/api/payments/online/order",
    requireAuth,
    requireRole("principal", "accountant", "parent"),
    async (req, res) => {
      const keys = razorpayKeys();
      if (!keys) {
        return res.status(503).json({
          code: "ONLINE_PAYMENT_NOT_CONFIGURED",
          message:
            "Is school ne online payment chalu nahi kiya hai — server par Razorpay keys set nahi hain",
        });
      }
      const result = onlineOrderBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const loaded = await loadOnlineStudent(req, res, result.data.studentId);
      if (!loaded) return;
      const receipt = await storage.getNextReceiptNo(loaded.schoolId);
      let order: { id?: unknown } | null = null;
      try {
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: result.data.amount * 100,
            currency: "INR",
            receipt,
            payment_capture: 1,
          }),
        });
        if (!rzpRes.ok) {
          return res.status(502).json({
            code: "RAZORPAY_ORDER_FAILED",
            message:
              "Razorpay par order nahi ban paya — koi rakam nahi kati. Thodi der baad dobara koshish karein.",
          });
        }
        order = (await rzpRes.json()) as { id?: unknown };
      } catch {
        return res.status(502).json({
          code: "RAZORPAY_ORDER_FAILED",
          message:
            "Razorpay se sampark nahi ho paya — koi rakam nahi kati. Internet/server jaanch kar dobara koshish karein.",
        });
      }
      if (!order || typeof order.id !== "string") {
        return res.status(502).json({
          code: "RAZORPAY_ORDER_FAILED",
          message:
            "Razorpay ne order ki pehchan nahi di — koi rakam nahi kati. Dobara koshish karein.",
        });
      }
      res.json({ orderId: order.id, amount: result.data.amount, keyId: keys.keyId });
    },
  );

  // #94 — signature jaanch ke BAAD hi asal fee payment record.
  // Signature = HMAC-SHA256("<order_id>|<payment_id>", secret) —
  // Razorpay ka dastavezi tareeka. Ek akshar bhi idhar-udhar ho to
  // timingSafeEqual fail aur record NAHI banta.
  app.post(
    "/api/payments/online/verify",
    requireAuth,
    requireRole("principal", "accountant", "parent"),
    async (req, res) => {
      const keys = razorpayKeys();
      if (!keys) {
        return res.status(503).json({
          code: "ONLINE_PAYMENT_NOT_CONFIGURED",
          message:
            "Is school ne online payment chalu nahi kiya hai — server par Razorpay keys set nahi hain",
        });
      }
      const result = onlineVerifyBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const data = result.data;

      const expected = createHmac("sha256", keys.keySecret)
        .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
        .digest("hex");
      const givenBuf = Buffer.from(data.razorpay_signature);
      const expectedBuf = Buffer.from(expected);
      if (
        givenBuf.length !== expectedBuf.length ||
        !timingSafeEqual(givenBuf, expectedBuf)
      ) {
        return res.status(400).json({
          code: "PAYMENT_VERIFICATION_FAILED",
          message:
            "Payment ki jaanch (signature) fail ho gayi — koi record NAHI bana. Agar rakam kat gayi ho to school se sampark karein.",
        });
      }

      const loaded = await loadOnlineStudent(req, res, data.studentId);
      if (!loaded) return;

      // Due settlements ki pehle-jaanch POST /api/payments wali hi hai:
      // ek bhi due galat to payment bane hi nahi.
      const settlements: Array<{ due: StudentDues; amount: number }> = [];
      if (data.dueSettlements && data.dueSettlements.length > 0) {
        const merged: Array<{ dueId: number; amount: number }> = [];
        for (const settlement of data.dueSettlements) {
          if (settlement.amount <= 0) continue;
          const existing = merged.find((m) => m.dueId === settlement.dueId);
          if (existing) existing.amount += settlement.amount;
          else merged.push({ dueId: settlement.dueId, amount: settlement.amount });
        }
        for (const { dueId, amount } of merged) {
          const due = await storage.getStudentDue(dueId);
          if (!due || due.studentId == null || due.studentId !== data.studentId) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          const dueStudent = await storage.getStudent(due.studentId);
          if (!dueStudent || dueStudent.schoolId !== loaded.schoolId) {
            return res
              .status(400)
              .json({ message: "Due does not belong to this student" });
          }
          if (due.isPaid === 1) continue;
          settlements.push({ due, amount });
        }
      }

      const breakdownText = normalizePaymentBreakdown(
        data.breakdown,
        data.isAdmission,
      );
      const receiptNo = await storage.getNextReceiptNo(loaded.schoolId);
      const payment = await storage.createFeePayment({
        studentId: data.studentId,
        schoolId: loaded.schoolId,
        amount: data.amount,
        month: data.month ?? "Misc",
        year: data.year ?? new Date().getFullYear(),
        receiptNo,
        paymentMethod: "Online (Razorpay)",
        remarks:
          data.remarks ?? `Razorpay online payment ${data.razorpay_payment_id}`,
        ...(breakdownText !== undefined ? { breakdown: breakdownText } : {}),
      });

      for (const { due, amount } of settlements) {
        if (amount >= due.amount) {
          await storage.updateStudentDue(due.id, {
            isPaid: 1,
            updatedAt: new Date(),
          });
        } else {
          await storage.updateStudentDue(due.id, {
            amount: due.amount - amount,
            updatedAt: new Date(),
          });
        }
      }

      res.status(201).json(payment);
    },
  );

  // =======================================================================
  // v3.0 GAP BATCH — Homework, Leaves (chutti), CSV Bulk Import
  // (Document status PATCH routes apni jagah #29d/#54f par hain.)
  //
  // ISOLATION (user ka sakht niyam — "data mix na ho"): har route
  // token ke schoolId se bandha hai; dusre school ki cheez maangna
  // hamesha 404 hai (hai hi nahi jaisa jawab). Parent ke raste
  // parent_students link se bandhe hain — unlinked baccha 404.
  // =======================================================================

  // Staff ki apni staff-record pehchan (v1 jod): staff table me
  // user_id nahi hai, isliye login-user ke phone/username ko staff
  // ke contact se milate hain. Na mile to null (route imaandari se
  // 400 deta hai — andaze se dusre ki record nahi pakadta).
  const findOwnStaffRecord = async (
    req: Request,
    schoolId: number,
    ): Promise<Staff | null> => {
    const me = await storage.getUser(req.user!.id);
    if (!me) return null;
    const all = await storage.getStaff(schoolId, { includeInactive: true });
    // v3.3: pehle pakka user_id link (principal ne POST
    // /api/staff/:id/link-user se lagaya ho) — contact-match se
    // zyada bharosemand hai.
    const linked = all.find((member) => member.userId === me.id);
    if (linked) return linked;
    // Fallback: purana contact-match (phone/username == staff contact).
    const candidates = [me.phone, me.username].filter(
      (value): value is string => Boolean(value && value.trim()),
    );
    if (candidates.length === 0) return null;
    return (
      all.find(
        (member) => member.contact != null && candidates.includes(member.contact),
      ) ?? null
    );
  };

  // -------------------------------------------------------------------
  // Homework — banana: principal/teacher; dekhna: school ke staff
  // roles (parent ka homework Parent Overview se aata hai);
  // mitana: principal koi bhi, teacher sirf apna banaya hua.
  // -------------------------------------------------------------------
  app.post(
    "/api/homework",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createHomeworkBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const created = await storage.createHomework({
        schoolId,
        className: result.data.className,
        section: result.data.section ?? null,
        subject: result.data.subject,
        title: result.data.title,
        description: result.data.description ?? null,
        dueDate: result.data.dueDate,
        createdBy: req.user!.id,
      });
      return res.status(201).json(created);
    },
  );

  app.get(
    "/api/homework",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const classFilter =
        typeof req.query.class === "string" && req.query.class !== "all"
          ? req.query.class
          : undefined;
      const sectionFilter =
        typeof req.query.section === "string" && req.query.section !== "all"
          ? req.query.section
          : undefined;
      const dateFilter =
        typeof req.query.date === "string" ? req.query.date : undefined;
      const rows = await storage.getHomework(schoolId, {
        className: classFilter,
        section: sectionFilter,
        dueDate: dateFilter,
      });
      return res.json(rows);
    },
  );

  app.delete(
    "/api/homework/:id",
    requireAuth,
    requireRole("principal", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const row = await storage.getHomeworkById(id);
      // Dusre school ka homework = hai hi nahi (404). Teacher sirf
      // apna banaya mita sakta hai — dusre ka bhi uske liye 404.
      if (!row || row.schoolId !== schoolId) {
        return res.status(404).json({ message: "Homework not found" });
      }
      if (req.user!.role === "teacher" && row.createdBy !== req.user!.id) {
        return res.status(404).json({ message: "Homework not found" });
      }
      await storage.deleteHomework(id);
      return res.json({ ok: true });
    },
  );

  // -------------------------------------------------------------------
  // Leaves (chutti) — parent: sirf apne linked bacche ke liye;
  // teacher/staff: staff wali sirf apni record ke liye; principal:
  // kisi ke liye bhi record + faisla (approve/reject) sirf wahi.
  // -------------------------------------------------------------------
  app.post(
    "/api/leaves",
    requireAuth,
    requireRole("parent", "principal", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createLeaveBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const data = result.data;
      if (data.toDate < data.fromDate) {
        return res.status(400).json({
          message: "To date, from date se pehle nahi ho sakti",
        });
      }
      const role = req.user!.role;

      let studentId: number | null = null;
      let staffId: number | null = null;

      if (data.kind === "student") {
        if (data.studentId == null) {
          return res
            .status(400)
            .json({ message: "studentId is required for student leave" });
        }
        if (role === "parent") {
          // Parent sirf apne LINKED bacche ke liye — unlinked (ya
          // dusre school ka) baccha = 404, hai hi nahi jaisa.
          const linked = await parentLinkedStudentIds(req);
          if (!linked.includes(data.studentId)) {
            return res.status(404).json({ message: "Student not found" });
          }
        } else if (role === "principal" || role === "teacher") {
          const student = await storage.getStudent(data.studentId);
          if (!student || student.schoolId !== schoolId) {
            return res.status(404).json({ message: "Student not found" });
          }
        } else {
          return res
            .status(403)
            .json({ message: "Staff student leave nahi laga sakta" });
        }
        studentId = data.studentId;
      } else {
        // kind === "staff"
        if (role === "parent") {
          return res
            .status(403)
            .json({ message: "Parent staff leave nahi laga sakta" });
        }
        if (role === "principal") {
          if (data.staffId == null) {
            return res
              .status(400)
              .json({ message: "staffId is required for staff leave" });
          }
          const member = await storage.getStaffMember(data.staffId);
          if (!member || member.schoolId !== schoolId) {
            return res.status(404).json({ message: "Staff not found" });
          }
          staffId = data.staffId;
        } else {
          // teacher/staff: sirf APNI record — body ka staffId
          // andekha; pehchan login se (contact-match).
          const own = await findOwnStaffRecord(req, schoolId);
          if (!own) {
            return res.status(400).json({
              message:
                "Aapki staff record nahi mili — kripya office/principal se sampark karein",
            });
          }
          staffId = own.id;
        }
      }

      const created = await storage.createLeaveRequest({
        schoolId,
        kind: data.kind,
        studentId,
        staffId,
        applicantUserId: req.user!.id,
        fromDate: data.fromDate,
        toDate: data.toDate,
        reason: data.reason,
        status: "pending",
        decidedBy: null,
      });
      return res.status(201).json(created);
    },
  );

  app.get(
    "/api/leaves",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff", "parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const role = req.user!.role;
      const kindFilter =
        typeof req.query.kind === "string" ? req.query.kind : undefined;
      const statusFilter =
        typeof req.query.status === "string" ? req.query.status : undefined;

      let rows: LeaveRequest[];
      if (role === "principal" || role === "accountant") {
        rows = await storage.getLeaveRequests(schoolId, {
          kind: kindFilter,
          status: statusFilter,
        });
      } else if (role === "parent") {
        const linked = await parentLinkedStudentIds(req);
        rows = await storage.getLeaveRequests(schoolId, {
          kind: "student",
          status: statusFilter,
          studentIds: linked,
        });
      } else {
        // teacher/staff: apni lagayi hui + apni staff-record wali.
        const own = await findOwnStaffRecord(req, schoolId);
        const byApplicant = await storage.getLeaveRequests(schoolId, {
          status: statusFilter,
          applicantUserId: req.user!.id,
        });
        const byStaff = own
          ? await storage.getLeaveRequests(schoolId, {
              status: statusFilter,
              staffId: own.id,
            })
          : [];
        const seen = new Set<number>();
        rows = [...byApplicant, ...byStaff]
          .filter((row) => {
            if (seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
          })
          .sort((a, b) => b.id - a.id);
        if (kindFilter) rows = rows.filter((row) => row.kind === kindFilter);
      }

      // Naam saath bhejo (client ke paas parent jaise roles ke liye
      // students/staff list ka access nahi hota) — har naam usi
      // school se jaanch kar.
      const studentNames = new Map<number, string>();
      const staffNames = new Map<number, string>();
      const enriched = [] as Array<
        LeaveRequest & { studentName: string | null; staffName: string | null }
      >;
      for (const row of rows) {
        let studentName: string | null = null;
        let staffName: string | null = null;
        if (row.studentId != null) {
          if (!studentNames.has(row.studentId)) {
            const student = await storage.getStudent(row.studentId);
            studentNames.set(
              row.studentId,
              student && student.schoolId === schoolId ? student.name : "",
            );
          }
          studentName = studentNames.get(row.studentId) || null;
        }
        if (row.staffId != null) {
          if (!staffNames.has(row.staffId)) {
            const member = await storage.getStaffMember(row.staffId);
            staffNames.set(
              row.staffId,
              member && member.schoolId === schoolId ? member.name : "",
            );
          }
          staffName = staffNames.get(row.staffId) || null;
        }
        enriched.push({ ...row, studentName, staffName });
      }
      return res.json(enriched);
    },
  );

  // Faisla sirf principal, sirf pending par (ek baar faisla ho jaye
  // to badla nahi jata — galti ho to nayi leave record hoti hai).
  app.patch(
    "/api/leaves/:id/decision",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      try {
        const schoolId = requireSchoolId(req, res);
        if (schoolId == null) return;
        const id = parsePathId(req);
        if (id == null) return res.status(400).json({ message: "Invalid ID" });
        const result = leaveDecisionBodySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);
        const leave = await storage.getLeaveRequest(id);
        if (!leave || leave.schoolId !== schoolId) {
          return res.status(404).json({ message: "Leave not found" });
        }
        if (leave.status !== "pending") {
          return res.status(400).json({
            message: "Is leave par pehle hi faisla ho chuka hai",
          });
        }
        const updated = await storage.updateLeaveRequest(id, {
          status: result.data.status,
          decidedBy: req.user!.id,
        });
        // Audit (v3.3): leave ka faisla.
        await logAudit(
          req,
          "leave.decision",
          "leave_request",
          id,
          `${leave.kind} leave ${result.data.status}`,
        );
        return res.json(updated);
      } catch (err) {
        console.error("PATCH /api/leaves/:id/decision failed:", err);
        return res.status(500).json({ message: "Faisla save nahi ho paya. Dobara koshish karein." });
      }
    },
  );

  // -------------------------------------------------------------------
  // CSV Bulk Import — Students (principal/staff) + Staff (principal).
  // Har row alag jaancha jata hai: kharab row skip + error list me,
  // achhi rows ban jati hain (ek kharab row poora import nahi
  // rokta). Students ke liye v2.1 wala parent auto-link bhi chalta
  // hai. Import SIRF importer ke school me hota hai — schoolId
  // hamesha token se, body se kabhi nahi.
  // -------------------------------------------------------------------
  app.post(
    "/api/students/bulk",
    requireAuth,
    requireRole("principal", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = bulkStudentsBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      let created = 0;
      let skipped = 0;
      const errors: Array<{ row: number; message: string }> = [];
      const seenAdmissionNos = new Set<string>();

      for (let i = 0; i < result.data.students.length; i++) {
        const lineNo = i + 2; // CSV ki line (1 = header)
        const parsed = bulkStudentRowSchema.safeParse(result.data.students[i]);
        if (!parsed.success) {
          skipped++;
          errors.push({
            row: lineNo,
            message:
              "Zaroori jaankari adhuri hai (name, class, fatherName, contact lazmi hain)",
          });
          continue;
        }
        const rowData = parsed.data;
        try {
          let admissionNo = rowData.admissionNo?.trim() || null;
          if (admissionNo) {
            if (seenAdmissionNos.has(admissionNo)) {
              skipped++;
              errors.push({
                row: lineNo,
                message: `Admission No. ${admissionNo} is file me do baar hai`,
              });
              continue;
            }
            const clash = await storage.getStudentByAdmissionNo(
              schoolId,
              admissionNo,
            );
            if (clash) {
              skipped++;
              errors.push({
                row: lineNo,
                message: `Admission No. ${admissionNo} pehle se maujood hai`,
              });
              continue;
            }
            seenAdmissionNos.add(admissionNo);
          } else {
            admissionNo = await storage.getNextAdmissionNo(schoolId);
          }

          const student = await storage.createStudent({
            schoolId,
            name: rowData.name,
            class: rowData.class,
            section: rowData.section?.trim() || "A",
            rollNo: rowData.rollNo ?? null,
            admissionNo,
            fatherName: rowData.fatherName,
            motherName: rowData.motherName ?? null,
            contact: rowData.contact,
            dob: rowData.dob ?? null,
            address: rowData.address ?? null,
            category: rowData.category ?? null,
            apaarId: rowData.apaarId ?? null,
          });
          created++;

          // v2.1 niyam: admission par parent login khud banta hai.
          // Isme gadbad ho to row fail nahi hoti (student ban gaya
          // hai) — parent baad me Students page se bhi jud sakta hai.
          try {
            await ensureParentForAdmission(
              schoolId,
              student,
              async () => await hashPassword(student.admissionNo),
            );
          } catch (error) {
            console.error("bulk import: parent auto-link failed:", error);
          }
        } catch (error) {
          console.error("bulk import student row failed:", error);
          skipped++;
          errors.push({ row: lineNo, message: "Row save nahi ho payi" });
        }
      }
      return res.json({ created, skipped, errors });
    },
  );

  app.post(
    "/api/staff/bulk",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = bulkStaffBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);

      let created = 0;
      let skipped = 0;
      const errors: Array<{ row: number; message: string }> = [];
      const seenEmployeeIds = new Set<string>();

      for (let i = 0; i < result.data.staff.length; i++) {
        const lineNo = i + 2;
        const parsed = bulkStaffRowSchema.safeParse(result.data.staff[i]);
        if (!parsed.success) {
          skipped++;
          errors.push({
            row: lineNo,
            message:
              "Zaroori jaankari adhuri hai (name, designation, contact lazmi hain)",
          });
          continue;
        }
        const rowData = parsed.data;
        try {
          const employeeId = rowData.employeeId?.trim() || null;
          if (employeeId) {
            if (seenEmployeeIds.has(employeeId)) {
              skipped++;
              errors.push({
                row: lineNo,
                message: `Employee ID ${employeeId} is file me do baar hai`,
              });
              continue;
            }
            const existing = await storage.getStaff(schoolId, {
              includeInactive: true,
            });
            if (existing.some((member) => member.employeeId === employeeId)) {
              skipped++;
              errors.push({
                row: lineNo,
                message: `Employee ID ${employeeId} pehle se maujood hai`,
              });
              continue;
            }
            seenEmployeeIds.add(employeeId);
          }

          const member = await storage.createStaff({
            schoolId,
            employeeId,
            name: rowData.name,
            fatherName: rowData.fatherName ?? null,
            designation: rowData.designation,
            department: rowData.department ?? null,
            qualification: rowData.qualification ?? null,
            experience: rowData.experience ?? null,
            contact: rowData.contact,
            email: rowData.email ?? null,
            address: rowData.address ?? null,
            joinDate: rowData.joinDate ?? null,
            basicSalary: rowData.basicSalary ?? 0,
            status: "active",
          });
          // POST /api/staff jaisa hi niyam: employeeId na ho to
          // EMP-<id> khud lag jata hai.
          if (!member.employeeId) {
            await storage.updateStaff(member.id, {
              employeeId: `EMP-${member.id}`,
            });
          }
          created++;
        } catch (error) {
          console.error("bulk import staff row failed:", error);
          skipped++;
          errors.push({ row: lineNo, message: "Row save nahi ho payi" });
        }
      }
      return res.json({ created, skipped, errors });
    },
  );

  // =====================================================================
  // v3.3 — Payment proofs (UPI screenshot) / Certificates register /
  // Audit log / Staff-user link / Teacher assignments / Backup restore
  // =====================================================================

  // Proof ki rakam storage me NUMERIC (string) aati hai — client ko
  // hamesha number bhejo.
  const serializePaymentProof = (proof: PaymentProof) => ({
    ...proof,
    amount: Number(proof.amount),
  });

  // Parent UPI screenshot bhejta hai. Ownership: student parent ke
  // linked baccho me hona lazmi — warna 404 (parent overview wala
  // hi pattern: dusre ke bacche ka wajood hi nahi dikhta).
  app.post(
    "/api/parent/payment-proof",
    requireAuth,
    requireRole("parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createPaymentProofBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const linked = await parentLinkedStudentIds(req);
      if (!linked.includes(result.data.studentId)) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (documentTooLarge(result.data.image)) {
        return res.status(400).json({
          message: "Screenshot bahut bada hai (adhiktam ~2 MB)",
        });
      }
      const proof = await storage.createPaymentProof({
        schoolId,
        studentId: result.data.studentId,
        parentUserId: req.user!.id,
        amount: String(result.data.amount),
        txnRef: result.data.txnRef ?? null,
        image: result.data.image,
        status: "pending",
      });
      return res.status(201).json(serializePaymentProof(proof));
    },
  );

  // Parent ke APNE bheje hue proofs — Parents App ki "Meri bheji
  // raseedein" list ke liye (merge fix v3.3: parent client ye
  // endpoint pehle try karta hai). Sirf usi parent ke proofs jiska
  // login hai (parentUserId match), naye pehle (storage ka order).
  // Tasveer list me NAHI jati (bhaari hai) — hasImage flag aata hai.
  app.get(
    "/api/parent/payment-proofs",
    requireAuth,
    requireRole("parent"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const all = await storage.getPaymentProofs(schoolId);
      const mine = all.filter((proof) => proof.parentUserId === req.user!.id);
      const enriched = await Promise.all(
        mine.map(async (proof) => {
          const student =
            proof.studentId != null
              ? await storage.getStudent(proof.studentId)
              : undefined;
          const { image: _image, ...rest } = serializePaymentProof(proof);
          return {
            ...rest,
            hasImage: Boolean(proof.image),
            studentName: student?.name ?? null,
          };
        }),
      );
      return res.json(enriched);
    },
  );

  // Daftar ki proof list — student ke naam/class ke saath. Tasveer
  // (image) list me NAHI jati (bhaari hai); faisle se pehle ek
  // proof dekhna ho to GET /api/payment-proofs/:id.
  app.get(
    "/api/payment-proofs",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const proofs = await storage.getPaymentProofs(schoolId, { status });
      const enriched = await Promise.all(
        proofs.map(async (proof) => {
          const student =
            proof.studentId != null
              ? await storage.getStudent(proof.studentId)
              : undefined;
          const { image: _image, ...rest } = serializePaymentProof(proof);
          return {
            ...rest,
            hasImage: Boolean(proof.image),
            studentName: student?.name ?? null,
            studentClass: student?.class ?? null,
            studentSection: student?.section ?? null,
            admissionNo: student?.admissionNo ?? null,
          };
        }),
      );
      return res.json(enriched);
    },
  );

  // Ek proof poora (tasveer ke saath) — faisle se pehle dekhne ke liye.
  app.get(
    "/api/payment-proofs/:id",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const proof = await storage.getPaymentProof(id);
      if (!proof || proof.schoolId !== schoolId) {
        return res.status(404).json({ message: "Payment proof not found" });
      }
      const student =
        proof.studentId != null
          ? await storage.getStudent(proof.studentId)
          : undefined;
      return res.json({
        ...serializePaymentProof(proof),
        studentName: student?.name ?? null,
        studentClass: student?.class ?? null,
        studentSection: student?.section ?? null,
        admissionNo: student?.admissionNo ?? null,
      });
    },
  );

  // Proof ka faisla. Approve = asal fee payment banta hai (maujooda
  // payment system se — receipt no wagera khud banta hai) aur
  // payment_id proof se jud jata hai. Sirf pending par faisla;
  // dusri baar 400. Try/catch leave-decision jaisa (PATCH route).
  app.patch(
    "/api/payment-proofs/:id/decision",
    requireAuth,
    requireRole("principal", "accountant"),
    async (req, res) => {
      try {
        const schoolId = requireSchoolId(req, res);
        if (schoolId == null) return;
        const id = parsePathId(req);
        if (id == null) return res.status(400).json({ message: "Invalid ID" });
        const result = paymentProofDecisionBodySchema.safeParse(req.body);
        if (!result.success) return res.status(400).json(result.error);
        const proof = await storage.getPaymentProof(id);
        if (!proof || proof.schoolId !== schoolId) {
          return res.status(404).json({ message: "Payment proof not found" });
        }
        if (proof.status !== "pending") {
          return res.status(400).json({
            message: "Is proof par pehle hi faisla ho chuka hai",
          });
        }

        let paymentId: number | null = null;
        if (result.data.status === "approved") {
          const student =
            proof.studentId != null
              ? await storage.getStudent(proof.studentId)
              : undefined;
          if (!student || student.schoolId !== schoolId) {
            return res
              .status(400)
              .json({ message: "Proof ka student is school me nahi mila" });
          }
          const now = new Date();
          const monthName = now.toLocaleString("en-US", { month: "long" });
          const payment = await storage.createFeePayment({
            schoolId,
            studentId: proof.studentId,
            // feePayments.amount INTEGER hai — proof ki decimal
            // rakam ko gol karke bhejo.
            amount: Math.round(Number(proof.amount)),
            month: monthName,
            year: now.getFullYear(),
            // Receipt no baaki payments ki tarah server hi banata hai.
            receiptNo: await storage.getNextReceiptNo(schoolId),
            paymentMethod: "UPI",
            remarks: proof.txnRef
              ? `UPI screenshot proof (Txn: ${proof.txnRef})`
              : "UPI screenshot proof",
          });
          paymentId = payment.id;
        }

        const updated = await storage.updatePaymentProof(id, {
          status: result.data.status,
          decidedBy: req.user!.id,
          decidedAt: new Date(),
          paymentId,
        });
        // Audit (v3.3): proof ka faisla (+ banti hui payment).
        await logAudit(
          req,
          "payment_proof.decision",
          "payment_proof",
          id,
          result.data.status === "approved"
            ? `Proof approved — ₹${proof.amount} ki payment #${paymentId} bani`
            : `Proof rejected — ₹${proof.amount}`,
        );
        return res.json(serializePaymentProof(updated ?? proof));
      } catch (err) {
        console.error("PATCH /api/payment-proofs/:id/decision failed:", err);
        return res.status(500).json({
          message: "Faisla save nahi ho paya. Dobara koshish karein.",
        });
      }
    },
  );

  // Certificate register — print ke samay record. Roles wahi jo
  // Certificates page khol sakte hain (school ke staff roles).
  app.post(
    "/api/certificates/issued",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createIssuedCertificateBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const student = await storage.getStudent(result.data.studentId);
      if (!student || student.schoolId !== schoolId) {
        return res.status(404).json({ message: "Student not found" });
      }
      const resolvedStudentName = result.data.studentName ?? student.name;
      const entry = await storage.createIssuedCertificate({
        schoolId,
        studentId: result.data.studentId,
        type: result.data.type,
        studentName: resolvedStudentName,
        className: result.data.className ?? student.class ?? null,
        issuedBy: req.user!.id,
      });
      // Audit (v3.3): certificate issue.
      await logAudit(
        req,
        "certificate.issue",
        "certificate",
        entry.id,
        `${result.data.type} — ${resolvedStudentName}`,
      );
      return res.status(201).json(entry);
    },
  );

  // Register ki list — ?studentId= se ek bacche ke saare certificates.
  app.get(
    "/api/certificates/issued",
    requireAuth,
    requireRole("principal", "accountant", "teacher", "staff"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const studentId = parseOptionalId(
        typeof req.query.studentId === "string"
          ? req.query.studentId
          : undefined,
      );
      const rows = await storage.getIssuedCertificates(schoolId, {
        studentId,
      });
      return res.json(rows);
    },
  );

  // Audit log — sirf principal, naye pehle, adhiktam 200.
  app.get(
    "/api/audit-logs",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const rows = await storage.getAuditLogs(schoolId, 200);
      return res.json(rows);
    },
  );

  // Staff record ko uske login user se pakka jodo (v3.3) — leave
  // matching iske baad contact-match par nirbhar nahi rehti. Dono
  // (staff + user) ISI school ke hone lazmi; user teacher/staff/
  // accountant role ka hi ho sakta hai.
  app.post(
    "/api/staff/:id/link-user",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const result = linkStaffUserBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const member = await storage.getStaffMember(id);
      if (!member || member.schoolId !== schoolId) {
        return res.status(404).json({ message: "Staff not found" });
      }
      const user = await storage.getUser(result.data.userId);
      if (!user || user.schoolId !== schoolId) {
        return res.status(400).json({
          message: "User is school ka nahi hai",
        });
      }
      if (
        user.role !== "teacher" &&
        user.role !== "staff" &&
        user.role !== "accountant"
      ) {
        return res.status(400).json({
          message: "Sirf teacher/staff/accountant user ko staff record se jod sakte hain",
        });
      }
      const updated = await storage.updateStaff(id, {
        userId: user.id,
        updatedAt: new Date(),
      });
      return res.json(updated);
    },
  );

  // Teacher assignments — principal manage karta hai; teacher sirf
  // apne assignments dekhta hai; principal/accountant poori list.
  app.get(
    "/api/teacher-assignments",
    requireAuth,
    requireRole("principal", "accountant", "teacher"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const rows =
        req.user!.role === "teacher"
          ? await storage.getTeacherAssignments(schoolId, {
              userId: req.user!.id,
            })
          : await storage.getTeacherAssignments(schoolId);
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const user =
            row.userId != null ? await storage.getUser(row.userId) : undefined;
          return {
            ...row,
            teacherName: user?.name ?? null,
            teacherUsername: user?.username ?? null,
          };
        }),
      );
      return res.json(enriched);
    },
  );

  app.post(
    "/api/teacher-assignments",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = createTeacherAssignmentBodySchema.safeParse(req.body);
      if (!result.success) return res.status(400).json(result.error);
      const user = await storage.getUser(result.data.userId);
      if (!user || user.schoolId !== schoolId) {
        return res.status(400).json({
          message: "User is school ka nahi hai",
        });
      }
      if (user.role !== "teacher") {
        return res.status(400).json({
          message: "Assignment sirf teacher user ko de sakte hain",
        });
      }
      const created = await storage.createTeacherAssignment({
        schoolId,
        userId: result.data.userId,
        className: result.data.className,
        section: result.data.section ?? null,
        subject: result.data.subject ?? null,
        isClassTeacher: result.data.isClassTeacher ? 1 : 0,
      });
      return res.status(201).json(created);
    },
  );

  app.delete(
    "/api/teacher-assignments/:id",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const id = parsePathId(req);
      if (id == null) return res.status(400).json({ message: "Invalid ID" });
      const existing = await storage.getTeacherAssignment(id);
      if (!existing || existing.schoolId !== schoolId) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      await storage.deleteTeacherAssignment(id);
      return res.json({ message: "Assignment hata diya gaya" });
    },
  );

  // Backup restore (v3.3) — GET /api/export/school wala JSON wapas
  // bharo. Sirf principal, sirf APNE school ki file: file ke
  // school.id ka caller ke school se milna lazmi hai (warna 400),
  // aur andar har row par schoolId token wala hi lagta hai.
  // Users/logins ko restore chhoota hi nahi. Poori seema NOTES.md
  // me hai.
  app.post(
    "/api/import/school",
    requireAuth,
    requireRole("principal"),
    async (req, res) => {
      const schoolId = requireSchoolId(req, res);
      if (schoolId == null) return;
      const result = importSchoolBodySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message:
            "Backup file ka format sahi nahi hai — GET /api/export/school wali file chahiye",
        });
      }
      const data = result.data;
      // Dusri school ki file = saaf inkaar. Export me school ka id
      // hota hai; wo caller ke school se na mile to restore nahi
      // hoga. (Ek wajah ye bhi hai: admissionNo poore system me
      // UNIQUE hai — dusri school ke admission numbers is school
      // me ghus hi nahi sakte, takraav lazmi hoga.)
      const fileSchoolId = (data.school as { id?: unknown }).id;
      if (typeof fileSchoolId !== "number" || fileSchoolId !== schoolId) {
        return res.status(400).json({
          message:
            "Ye backup file is school ki nahi hai — sirf apne school ki export file hi restore ho sakti hai",
        });
      }
      const tableKeys = [
        "students",
        "staff",
        "feeStructures",
        "feePayments",
        "studentDues",
        "exams",
        "marks",
        "attendance",
        "notices",
        "transportRoutes",
        "additionalFees",
        "salaryPayments",
        "expenses",
      ] as const;
      // Ek bhi pehchan-wali table na ho to ye backup file nahi hai.
      if (!tableKeys.some((key) => Array.isArray(data[key]))) {
        return res.status(400).json({
          message:
            "Backup file me koi data table nahi mili — sahi export file chahiye",
        });
      }
      // Har row ek object honi chahiye jisme id ho (id-remap ke liye).
      for (const key of tableKeys) {
        const rows = data[key];
        if (!rows) continue;
        for (const row of rows as unknown[]) {
          if (
            typeof row !== "object" ||
            row === null ||
            typeof (row as { id?: unknown }).id !== "number"
          ) {
            return res.status(400).json({
              message: `Backup file kharab hai (${key} ki ek row me id nahi hai)`,
            });
          }
        }
      }
      try {
        const counts = await storage.importSchoolData(
          schoolId,
          data as unknown as SchoolExportData,
        );
        // Audit (v3.3): restore khud ek bada faisla hai — record ho
        // (restore audit_logs ko saaf nahi karta, isliye ye entry
        // restore ke BAAD bhi bachi rehti hai).
        await logAudit(
          req,
          "school.restore",
          "school",
          schoolId,
          `Backup restore: ${counts.students} students, ${counts.staff} staff, ${counts.feePayments} payments, ${counts.exams} exams`,
        );
        return res.json({
          message: "Backup restore ho gaya",
          restored: counts,
        });
      } catch (err) {
        console.error("POST /api/import/school failed:", err);
        return res.status(500).json({
          message:
            "Restore nahi ho paya — purana data surakshit hai (aadha restore nahi hota). File jaanch kar dobara koshish karein.",
        });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
