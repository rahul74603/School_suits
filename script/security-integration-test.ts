import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, Student, User } from "@shared/schema";

process.env.DATABASE_URL ||= "postgres://security-test:security-test@127.0.0.1:5432/security-test";

const { registerRoutes } = await import("../server/routes");

const schoolAStudent: Student = {
  id: 1,
  admissionNo: "A-001",
  name: "School A Student",
  fatherName: "Parent A",
  motherName: null,
  class: "1",
  section: "A",
  rollNo: "1",
  aadhaar: "sensitive-value",
  category: null,
  dob: null,
  contact: "9000000001",
  address: "School A address",
  isActive: true,
  schoolId: 10,
  sessionId: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const schoolBStudent: Student = { ...schoolAStudent, id: 2, admissionNo: "B-001", name: "School B Student", schoolId: 20 };
const users: User[] = [];

const staffUser: User = {
  id: 1,
  username: "staff-a",
  passwordHash: await hashPassword("staff-password"),
  role: "staff",
  name: "Staff A",
  schoolId: 10,
};
const adminUser: User = {
  id: 2,
  username: "admin-a",
  passwordHash: await hashPassword("admin-password"),
  role: "admin",
  name: "Admin A",
  schoolId: 10,
};
users.push(staffUser, adminUser);

let createdPaymentSchoolId: number | undefined;
const activeSession: AcademicSession = {
  id: 100,
  schoolId: 10,
  name: "Test Session",
  startDate: null,
  endDate: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find((user) => user.username === username),
  getSchool: async () => undefined,
  updateSchool: async () => undefined,
  getActiveSession: async (schoolId: number) => schoolId === 10 ? activeSession : undefined,
  createAcademicSession: async () => activeSession,
  getStudents: async (schoolId: number) => schoolId === 10 ? [schoolAStudent] : [schoolBStudent],
  createStudent: async (student: Student) => student,
  getStudent: async (id: number, schoolId: number) => {
    if (schoolId === 10 && id === schoolAStudent.id) return schoolAStudent;
    if (schoolId === 20 && id === schoolBStudent.id) return schoolBStudent;
    return undefined;
  },
  updateStudent: async () => undefined,
  promoteStudents: async () => undefined,
  getFeeStructures: async () => [],
  createFeeStructure: async () => undefined,
  getFeePayments: async (schoolId: number) => schoolId === 10 ? [] : [{ schoolId: 20 }],
  createFeePayment: async (payment: { schoolId: number; sessionId: number }) => {
    createdPaymentSchoolId = payment.schoolId;
    return payment;
  },
  createFeePaymentForSchool: async (payment: { schoolId: number; sessionId: number; studentId: number }, schoolId: number) => {
    if (schoolId !== 10 || payment.studentId !== 1) return undefined;
    createdPaymentSchoolId = schoolId;
    return payment;
  },
  getDefaulters: async () => [],
  getStaff: async () => [],
  createStaff: async () => undefined,
} as unknown as IStorage;

const app = express();
app.use(express.json());
app.use(session({ secret: "security-test-secret", resave: false, saveUninitialized: false }));
await registerRoutes(createServer(), app, fakeStorage);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ message: "test error", error });
});

const server = app.listen(0);
const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not start test server");
const baseUrl = `http://127.0.0.1:${address.port}`;

async function request(path: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

try {
  const unauthenticated = await request("/api/students");
  assert.equal(unauthenticated.status, 401, "protected endpoint must reject unauthenticated requests");

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "staff-a", password: "staff-password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie");
  assert.ok(cookie, "login must issue a session cookie");
  const loginBody = await login.json() as { user: Record<string, unknown> };
  assert.equal("passwordHash" in loginBody.user, false);

  const students = await request("/api/students", {}, cookie);
  assert.equal(students.status, 200);
  const studentBody = await students.json() as Array<Record<string, unknown>>;
  assert.equal(studentBody.length, 1);
  assert.equal(studentBody[0].schoolId, 10);
  assert.equal("aadhaar" in studentBody[0], false);

  const schoolBStudentAttempt = await request("/api/students/2", {}, cookie);
  assert.equal(schoolBStudentAttempt.status, 404, "school A must not read school B students");

  const studentInput = {
    admissionNo: schoolAStudent.admissionNo,
    name: schoolAStudent.name,
    fatherName: schoolAStudent.fatherName,
    class: schoolAStudent.class,
    section: schoolAStudent.section,
    rollNo: schoolAStudent.rollNo,
    contact: schoolAStudent.contact,
    address: schoolAStudent.address,
    schoolId: 20,
  };
  const changedSchoolId = await request("/api/students", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(studentInput),
  }, cookie);
  assert.equal(changedSchoolId.status, 201, "staff may create a student");
  const createdStudent = await changedSchoolId.json() as Record<string, unknown>;
  assert.equal(createdStudent.schoolId, 10, "client schoolId must not control tenant ownership");

  const schoolBPaymentHistory = await request("/api/payments?studentId=2", {}, cookie);
  assert.equal(schoolBPaymentHistory.status, 200);
  assert.deepEqual(await schoolBPaymentHistory.json(), [], "school A must not retrieve school B payments");

  const unauthorizedPayment = await request("/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 1, amount: 100, year: 2026, receiptNo: "T-1", schoolId: 20 }),
  }, cookie);
  assert.equal(unauthorizedPayment.status, 403, "staff must not create payments");

  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin-a", password: "admin-password" }),
  });
  const adminCookie = adminLogin.headers.get("set-cookie");
  assert.equal(adminLogin.status, 200);
  assert.ok(adminCookie);

  const schoolBPayment = await request("/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 2, amount: 100, year: 2026, receiptNo: "T-2", schoolId: 10 }),
  }, adminCookie);
  assert.equal(schoolBPayment.status, 404, "school A must not create a payment for school B");

  const schoolAPayment = await request("/api/payments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studentId: 1, amount: 100, year: 2026, receiptNo: "T-3", schoolId: 20 }),
  }, adminCookie);
  assert.equal(schoolAPayment.status, 201);
  assert.equal(createdPaymentSchoolId, 10, "payment ownership must come from the session school");

  console.log("Security integration tests passed.");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
