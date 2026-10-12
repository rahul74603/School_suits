import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";

process.env.DATABASE_URL ||= "postgres://erp-test:erp-test@127.0.0.1:5432/erp-test";

const { registerRoutes } = await import("../server/routes");

const activeSession = {
  id: 100,
  schoolId: 10,
  name: "2026-27",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const users: any[] = [
  {
    id: 1,
    username: "admin1",
    passwordHash: await hashPassword("AdminPass123!"),
    role: "admin",
    name: "Principal Admin",
    schoolId: 10,
  },
  {
    id: 2,
    username: "student1",
    passwordHash: await hashPassword("StudentPass123!"),
    role: "student",
    name: "Aarav Sharma",
    schoolId: 10,
  },
];

const students: any[] = [
  {
    id: 50,
    admissionNo: "ADM-2026-001",
    name: "Aarav Sharma",
    fatherName: "Rajesh Sharma",
    class: "10",
    section: "A",
    contact: "9876543210",
    isActive: true,
    schoolId: 10,
    sessionId: 100,
  },
];

const noticesList: any[] = [];
const homeworkList: any[] = [];
const timetableList: any[] = [];
const leavesList: any[] = [];
const certsList: any[] = [];
const routesList: any[] = [];
const allocationsList: any[] = [];

const fakeStorage = {
  getUserByUsername: async (username: string) => users.find((u) => u.username === username),
  getUsersBySchool: async (schoolId: number) => users.filter((u) => u.schoolId === schoolId),
  createUser: async (input: any) => {
    const created = { id: users.length + 1, ...input };
    users.push(created);
    return created;
  },
  getActiveSession: async (schoolId: number) => (schoolId === 10 ? activeSession : undefined),
  getStudent: async (id: number, schoolId: number) =>
    students.find((s) => s.id === id && s.schoolId === schoolId),
  getStudentForUser: async (userId: number, schoolId: number) =>
    userId === 2 && schoolId === 10 ? students[0] : undefined,
  getNotices: async (schoolId: number) => noticesList.filter((n) => n.schoolId === schoolId && n.isActive),
  createNotice: async (input: any) => {
    const created = { id: noticesList.length + 1, ...input, createdAt: new Date() };
    noticesList.push(created);
    return created;
  },
  getHomework: async (schoolId: number, sessionId: number, filters: any) =>
    homeworkList.filter(
      (h) =>
        h.schoolId === schoolId &&
        h.sessionId === sessionId &&
        (!filters?.className || h.className === filters.className) &&
        (!filters?.section || h.section === filters.section),
    ),
  createHomework: async (input: any) => {
    const created = { id: homeworkList.length + 1, ...input, createdAt: new Date(), updatedAt: new Date() };
    homeworkList.push(created);
    return created;
  },
  getTimetable: async (schoolId: number, sessionId: number, filters: any) =>
    timetableList.filter(
      (t) =>
        t.schoolId === schoolId &&
        t.sessionId === sessionId &&
        (!filters?.className || t.className === filters.className),
    ),
  createTimetableEntry: async (input: any) => {
    const created = { id: timetableList.length + 1, ...input, createdAt: new Date() };
    timetableList.push(created);
    return created;
  },
  getLeaveRequests: async (schoolId: number, sessionId: number, filters: any) =>
    leavesList.filter(
      (l) =>
        l.schoolId === schoolId &&
        l.sessionId === sessionId &&
        (!filters?.userId || l.userId === filters.userId),
    ),
  createLeaveRequest: async (input: any) => {
    const created = { id: leavesList.length + 1, ...input, status: "pending", createdAt: new Date() };
    leavesList.push(created);
    return created;
  },
  reviewLeaveRequest: async (id: number, schoolId: number, _sessionId: number, status: string, reviewedByUserId: number) => {
    const found = leavesList.find((l) => l.id === id && l.schoolId === schoolId);
    if (!found) return undefined;
    found.status = status;
    found.reviewedByUserId = reviewedByUserId;
    return found;
  },
  getCertificates: async (schoolId: number, sessionId: number, studentId?: number) =>
    certsList.filter(
      (c) =>
        c.schoolId === schoolId &&
        c.sessionId === sessionId &&
        (!studentId || c.studentId === studentId),
    ),
  createCertificate: async (input: any) => {
    const created = { id: certsList.length + 1, ...input, status: "issued", createdAt: new Date() };
    certsList.push(created);
    return created;
  },
  getTransportRoutes: async (schoolId: number, sessionId: number) =>
    routesList.filter((r) => r.schoolId === schoolId && r.sessionId === sessionId),
  createTransportRoute: async (input: any) => {
    const created = { id: routesList.length + 1, ...input, createdAt: new Date() };
    routesList.push(created);
    return created;
  },
  getStudentTransportAllocations: async (schoolId: number, sessionId: number) =>
    allocationsList.filter((a) => a.schoolId === schoolId && a.sessionId === sessionId),
  assignStudentTransport: async (input: any) => {
    const created = { id: allocationsList.length + 1, ...input, createdAt: new Date() };
    allocationsList.push(created);
    return created;
  },
} as unknown as IStorage;

const app = express();
app.use(express.json());
app.use(session({ secret: "erp-test-secret", resave: false, saveUninitialized: false }));
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

try {
  // 1. Login as Admin
  const adminLogin = await req("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin1", password: "AdminPass123!" }),
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0]!;

  // 2. Create a Teacher user via /api/school-users
  const createTeacher = await req(
    "/api/school-users",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "teacher.verma",
        name: "Neha Verma",
        role: "teacher",
        password: "TeacherPassword123!",
      }),
    },
    adminCookie,
  );
  assert.equal(createTeacher.status, 201);

  // 3. Publish a Notice
  const createNotice = await req(
    "/api/notices",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Half-Yearly Exam Schedule Released",
        content: "Half-yearly exams begin from 15th November.",
        category: "exam",
        targetAudience: "all",
        isPinned: true,
        publishDate: "2026-10-12",
      }),
    },
    adminCookie,
  );
  assert.equal(createNotice.status, 201);

  // 4. Create Homework for Class 10-A
  const createHw = await req(
    "/api/homework",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        className: "10",
        section: "A",
        subjectId: 1,
        title: "Quadratic Equations Ex 4.1",
        description: "Solve Q1 to Q10 in fair notebook",
        assignedDate: "2026-10-12",
        dueDate: "2026-10-14",
      }),
    },
    adminCookie,
  );
  assert.equal(createHw.status, 201);

  // 5. Create Timetable slot
  const createTt = await req(
    "/api/timetable",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        className: "10",
        section: "A",
        dayOfWeek: "Monday",
        periodNo: 1,
        startTime: "08:30",
        endTime: "09:15",
        subjectId: 1,
        roomNo: "204",
      }),
    },
    adminCookie,
  );
  assert.equal(createTt.status, 201);

  // 6. Issue Bonafide Certificate
  const issueCert = await req(
    "/api/certificates",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studentId: 50,
        certificateType: "bonafide",
        issueDate: "2026-10-12",
        reason: "Scholarship Application",
        conduct: "Excellent",
      }),
    },
    adminCookie,
  );
  assert.equal(issueCert.status, 201);

  // 7. Create Transport Route & Allocate Student
  const createRoute = await req(
    "/api/transport/routes",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routeName: "Route 1 - MP Nagar",
        vehicleNo: "MP-04-PA-1001",
        driverName: "Ramesh Kumar",
        driverContact: "9000011111",
        stops: "MP Nagar, New Market, School Campus",
        monthlyFee: 1200,
        capacity: 40,
      }),
    },
    adminCookie,
  );
  assert.equal(createRoute.status, 201);

  const allocRoute = await req(
    "/api/transport/allocations",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studentId: 50,
        routeId: 1,
        stopName: "MP Nagar",
        monthlyFee: 1200,
      }),
    },
    adminCookie,
  );
  assert.equal(allocRoute.status, 201);

  // 8. Login as Student, submit Leave Request, and verify Student-scoped views
  const studentLogin = await req("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "student1", password: "StudentPass123!" }),
  });
  assert.equal(studentLogin.status, 200);
  const studentCookie = studentLogin.headers.get("set-cookie")?.split(";")[0]!;

  // Student cannot issue certificates (403)
  const forbiddenCert = await req(
    "/api/certificates",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        studentId: 50,
        certificateType: "bonafide",
        issueDate: "2026-10-12",
      }),
    },
    studentCookie,
  );
  assert.equal(forbiddenCert.status, 403);

  // Student submits leave request
  const applyLeave = await req(
    "/api/leaves",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        leaveType: "sick",
        fromDate: "2026-10-13",
        toDate: "2026-10-14",
        reason: "Viral fever",
      }),
    },
    studentCookie,
  );
  assert.equal(applyLeave.status, 201);

  // Admin approves leave request
  const reviewLeave = await req(
    "/api/leaves/1/review",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "approved", reviewRemarks: "Get well soon" }),
    },
    adminCookie,
  );
  assert.equal(reviewLeave.status, 200);
  const reviewedBody = (await reviewLeave.json()) as any;
  assert.equal(reviewedBody.status, "approved");

  console.log("Complete ERP modules tests passed.");
} finally {
  server.close();
}
