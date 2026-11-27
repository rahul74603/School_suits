import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";

process.env.DATABASE_URL ||= "postgres://erp-test:erp-test@127.0.0.1:5432/erp-test";
const { registerRoutes } = await import("../server/routes");

const activeSession: any = { id: 100, schoolId: 10, name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", isActive: true };
const students: any[] = [
  { id: 50, schoolId: 10, sessionId: 100, isActive: true, name: "Aarav Sharma", fatherName: "Rajesh Sharma", admissionNo: "A-50", class: "10", section: "A", transportRouteId: null },
  { id: 51, schoolId: 10, sessionId: 100, isActive: true, name: "Diya Sharma", fatherName: "Rajesh Sharma", admissionNo: "A-51", class: "10", section: "B", transportRouteId: null },
];
const users: any[] = [
  { id: 1, username: "test-admin", passwordHash: await hashPassword("AdminPass123!"), role: "admin", name: "Test Admin", schoolId: 10 },
  { id: 2, username: "test-student", passwordHash: await hashPassword("StudentPass123!"), role: "student", name: "Aarav", schoolId: 10 },
  { id: 3, username: "unlinked-student", passwordHash: await hashPassword("StudentPass123!"), role: "student", name: "Unlinked", schoolId: 10 },
];
const notices: any[] = [
  { id: 1, title: "School wide", targetAudience: "all" },
  { id: 2, title: "For students", targetAudience: "students" },
  { id: 3, title: "Class 10 A", targetAudience: "class", targetClass: "10", targetSection: "A" },
  { id: 4, title: "Class 10 B", targetAudience: "class", targetClass: "10", targetSection: "B" },
  { id: 5, title: "All class 10", targetAudience: "class", targetClass: "10", targetSection: null },
  { id: 6, title: "Teacher only", targetAudience: "teachers" },
  { id: 7, title: "Staff only", targetAudience: "staff" },
];
const leaves: any[] = [
  { id: 1, schoolId: 10, sessionId: 100, userId: 2, studentId: 50, applicantType: "student", applicantName: "Aarav", status: "approved", fromDate: "2026-06-01", toDate: "2026-06-01", reason: "Medical" },
  { id: 2, schoolId: 10, sessionId: 100, userId: 2, studentId: 51, applicantType: "student", applicantName: "Diya", status: "pending", fromDate: "2026-06-02", toDate: "2026-06-02", reason: "Old bad record" },
];
const feePayments = [
  { id: 1, studentId: 50, schoolId: 10, sessionId: 100, amount: 1250, month: "April", year: 2026, paymentDate: "2026-04-05T00:00:00.000Z", receiptNo: "R-1", remarks: "UPI" },
  { id: 2, studentId: 50, schoolId: 10, sessionId: 100, amount: 500, month: "May", year: 2026, paymentDate: "2026-05-05T00:00:00.000Z", receiptNo: "R-2", remarks: "Cash" },
  { id: 3, studentId: 51, schoolId: 10, sessionId: 100, amount: 9999, month: "April", year: 2026, paymentDate: "2026-04-05T00:00:00.000Z", receiptNo: "OTHER", remarks: "Other student" },
];
const dues = [
  { id: 10, studentId: 50, schoolId: 10, sessionId: 100, amount: 300, status: "open", description: "Library fine", dueDate: "2026-06-30" },
  { id: 11, studentId: 50, schoolId: 10, sessionId: 100, amount: 200, status: "settled", description: "Settled fee", dueDate: null },
];
const schedules: any[] = [
  { id: 21, examId: 200, schoolId: 10, sessionId: 100, className: "10", section: "A", subjectId: 1, examDate: "2026-07-01", maxMarks: 100, passingMarks: 33 },
  { id: 22, examId: 200, schoolId: 10, sessionId: 100, className: "10", section: "A", subjectId: 2, examDate: "2026-07-02", maxMarks: 100, passingMarks: 33 },
];
const fakeStorage: any = {
  getUserByUsername: async (username: string) => users.find((user) => user.username === username),
  getActiveSession: async (schoolId: number) => schoolId === 10 ? activeSession : undefined,
  getSchool: async (schoolId: number) => schoolId === 10 ? { id: 10, name: "Test School" } : undefined,
  getStudentForUser: async (userId: number, schoolId: number, sessionId: number) => schoolId === 10 && sessionId === 100 && userId === 2 ? students[0] : undefined,
  getStudent: async (studentId: number, schoolId: number) => students.find((student) => student.id === studentId && student.schoolId === schoolId),
  getStudents: async (schoolId: number, _filters?: any, sessionId?: number) => students.filter((student) => student.schoolId === schoolId && (sessionId === undefined || student.sessionId === sessionId)),
  getUsersBySchool: async () => users,
  getSubjects: async () => [{ id: 1, name: "Mathematics" }, { id: 2, name: "Science" }],
  getNotices: async () => notices,
  getHomework: async () => [],
  getTimetable: async () => [],
  getAttendance: async () => [],
  getFeeStructures: async () => [{ class: "10", monthlyFee: 1500, admissionFee: 2000, examFee: 500, otherFee: 100 }],
  getFeePayments: async (schoolId: number, studentId?: number, sessionId?: number) => feePayments.filter((payment) => payment.schoolId === schoolId && payment.studentId === studentId && payment.sessionId === sessionId),
  getStudentDues: async (schoolId: number, sessionId: number, studentId?: number) => dues.filter((due) => due.schoolId === schoolId && due.sessionId === sessionId && due.studentId === studentId),
  getLeaveRequests: async (schoolId: number, sessionId: number, filters: any = {}) => leaves.filter((leave) => leave.schoolId === schoolId && leave.sessionId === sessionId && (filters.userId === undefined || leave.userId === filters.userId) && (filters.studentId === undefined || leave.studentId === filters.studentId) && (filters.status === undefined || filters.status === "all" || leave.status === filters.status)),
  createLeaveRequest: async (input: any) => { const value = { id: leaves.length + 1, ...input, status: "pending" }; leaves.push(value); return value; },
  getTransportRoutes: async () => [],
  getStudentTransportAllocations: async () => [],
  getCertificates: async () => [],
  getExams: async () => [
    { id: 200, name: "Quarterly", examType: "quarterly", status: "published" },
    { id: 201, name: "Draft exam", examType: "unit", status: "draft" },
  ],
  getExamScopes: async (examId: number) => examId === 200 ? [{ className: "10", section: "A" }] : [],
  getExamSchedules: async (examId: number) => examId === 200 ? schedules : [],
  getExamResults: async (_schoolId: number, _sessionId: number, filters: any = {}) => filters.studentId === 50 && filters.examId === 200 ? [
    { scheduleId: 21, obtainedMarks: 80, isAbsent: false, status: "published", remarks: null },
    { scheduleId: 22, obtainedMarks: 90, isAbsent: false, status: "published", remarks: "Good" },
  ] : [],
} as unknown as IStorage;

const app = express();
app.use(express.json());
app.use(session({ secret: "parent-app-test-secret", resave: false, saveUninitialized: false }));
await registerRoutes(createServer(), app, fakeStorage);
const server = app.listen(0);
const address = server.address();
if (!address || typeof address === "string") throw new Error("Server failed to start");
const base = `http://127.0.0.1:${address.port}`;
async function req(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${base}${path}`, { ...init, headers });
}
async function login(username: string) {
  const response = await req("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "StudentPass123!" }) });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

try {
  const studentCookie = await login("test-student");
  const overviewResponse = await req("/api/parent-app/overview", {}, studentCookie);
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json() as any;

  assert.deepEqual(overview.notices.map((notice: any) => notice.title), ["School wide", "For students", "Class 10 A", "All class 10"]);
  assert.equal(overview.fees.monthlyFee, 1500);
  assert.equal(overview.fees.admissionFee, 2000);
  assert.equal(overview.fees.totalPaid, 1750);
  assert.equal(overview.fees.openDues, 300);
  assert.equal(overview.fees.payments.length, 2);
  assert.equal(overview.fees.payments[0].amount, 1250);
  assert.deepEqual(overview.fees.openDueItems.map((due: any) => due.id), [10]);
  assert.equal(overview.reportCards.length, 1);
  assert.equal(overview.reportCards[0].exam.name, "Quarterly");
  assert.equal(overview.reportCards[0].totals.totalObtained, 170);
  assert.equal(overview.reportCards[0].totals.percentage, 85);
  assert.deepEqual(overview.leaves.map((leave: any) => leave.studentId), [50]);

  const ownLeavesResponse = await req("/api/leaves", {}, studentCookie);
  const ownLeaves = await ownLeavesResponse.json() as any[];
  assert.equal(ownLeavesResponse.status, 200);
  assert.deepEqual(ownLeaves.map((leave) => leave.studentId), [50]);

  const deniedOtherChildLeave = await req("/api/leaves", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 51, leaveType: "sick", fromDate: "2026-06-10", toDate: "2026-06-10", reason: "Test" }),
  }, studentCookie);
  assert.equal(deniedOtherChildLeave.status, 403);

  const ownChildLeave = await req("/api/leaves", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 50, leaveType: "sick", fromDate: "2026-06-10", toDate: "2026-06-10", reason: "Own student leave" }),
  }, studentCookie);
  assert.equal(ownChildLeave.status, 201);
  assert.equal((await ownChildLeave.json() as any).studentId, 50);

  const unlinkedCookie = await login("unlinked-student");
  const unlinkedLeavesResponse = await req("/api/leaves", {}, unlinkedCookie);
  assert.deepEqual(await unlinkedLeavesResponse.json(), []);
  const deniedUnlinkedLeave = await req("/api/leaves", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 51, leaveType: "sick", fromDate: "2026-06-10", toDate: "2026-06-10", reason: "Test" }),
  }, unlinkedCookie);
  assert.equal(deniedUnlinkedLeave.status, 403);

  console.log("Parent app fee, notice, report-card, and leave ownership tests passed.");
} finally {
  server.close();
}
