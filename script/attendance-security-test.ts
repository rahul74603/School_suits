import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, AttendanceRecord, Student, User } from "@shared/schema";

process.env.DATABASE_URL ||= "postgres://attendance-test:attendance-test@127.0.0.1:5432/attendance-test";
const passwordHash = await hashPassword("password");
const sessionRecord: AcademicSession = { id: 100, schoolId: 10, name: "2026", startDate: null, endDate: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
const studentA: Student = { id: 1, admissionNo: "A1", name: "Student A", fatherName: "Parent", motherName: null, class: "1", section: "A", rollNo: "1", aadhaar: null, category: null, dob: null, contact: "1", address: null, isActive: true, schoolId: 10, sessionId: 100, createdAt: new Date(), updatedAt: new Date() };
const studentB: Student = { ...studentA, id: 2, admissionNo: "B1", name: "Student B", class: "2", section: "B" };
const users: User[] = [
  { id: 1, username: "admin", passwordHash, role: "admin", name: "Admin", schoolId: 10 },
  { id: 2, username: "principal", passwordHash, role: "principal", name: "Principal", schoolId: 10 },
  { id: 3, username: "teacher", passwordHash, role: "teacher", name: "Teacher", schoolId: 10 },
  { id: 4, username: "student", passwordHash, role: "student", name: "Student", schoolId: 10 },
  { id: 5, username: "staff", passwordHash, role: "staff", name: "Staff", schoolId: 10 },
];
const records: AttendanceRecord[] = [];
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find((user) => user.username === username),
  getActiveSession: async (schoolId: number) => schoolId === 10 ? sessionRecord : undefined,
  getTeacherClassAssignments: async (schoolId: number, sessionId: number, teacherUserId?: number) => schoolId === 10 && sessionId === 100 && teacherUserId === 3 ? [{ id: 1, teacherUserId: 3, className: "1", section: "A", schoolId: 10, sessionId: 100, createdAt: new Date() }] : [],
  getTeacherSubjectAssignments: async (schoolId: number, sessionId: number, teacherUserId?: number) => schoolId === 10 && sessionId === 100 && teacherUserId === 3 ? [{ id: 1, teacherUserId: 3, subjectId: 10, schoolId: 10, sessionId: 100, createdAt: new Date() }] : [],
  getStudentForUser: async (userId: number, schoolId: number, sessionId: number) => userId === 4 && schoolId === 10 && sessionId === 100 ? studentA : undefined,
  getStudent: async (id: number, schoolId: number) => schoolId === 10 ? [studentA, studentB].find((student) => student.id === id) : undefined,
  getAttendance: async (schoolId: number, sessionId: number, filters: { studentId?: number } = {}) => records.filter((record) => record.schoolId === schoolId && record.sessionId === sessionId && (filters.studentId === undefined || record.studentId === filters.studentId)),
  createAttendanceBulk: async (items: any[]) => { for (const item of items) if (records.some((record) => record.schoolId === item.schoolId && record.sessionId === item.sessionId && record.attendanceDate === item.attendanceDate && record.studentId === item.studentId && record.subjectId === item.subjectId)) throw new Error("Duplicate attendance"); const created = items.map((item, index) => ({ ...item, id: records.length + index + 1, createdAt: new Date(), updatedAt: new Date() })); records.push(...created); return created; },
  updateAttendance: async (id: number, schoolId: number, sessionId: number, status: string) => { const record = records.find((item) => item.id === id && item.schoolId === schoolId && item.sessionId === sessionId); if (record) record.status = status as any; return record; },
} as unknown as IStorage;

const app = express();
app.use(express.json());
app.use(session({ secret: "attendance-test", resave: false, saveUninitialized: false }));
const { registerRoutes } = await import("../server/routes");
await registerRoutes(createServer(), app, fakeStorage);
const server = app.listen(0);
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start test server");
const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, init: RequestInit = {}, cookie?: string) { const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); return fetch(`${base}${path}`, { ...init, headers }); }
async function login(username: string) { const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "password" }) }); assert.equal(response.status, 200); return response.headers.get("set-cookie")!; }
async function mark(cookie: string, className: string, subjectId: number | null = 10) { return request("/api/attendance/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ className, section: className === "1" ? "A" : "B", attendanceDate: "2026-01-10", subjectId, records: [{ studentId: className === "1" ? 1 : 2, status: "present" }] }) }, cookie); }
try {
  const staffCookie = await login("staff");
  assert.equal((await request("/api/attendance", {}, staffCookie)).status, 403);
  const teacherCookie = await login("teacher");
  assert.equal((await mark(teacherCookie, "1")).status, 201, "assigned class and subject must be markable");
  assert.equal((await mark(teacherCookie, "1")).status, 409, "duplicate attendance must be rejected");
  assert.equal((await mark(teacherCookie, "2")).status, 403, "unassigned class must be rejected");
  assert.equal((await mark(teacherCookie, "1", 11)).status, 403, "unassigned subject must be rejected");
  const adminCookie = await login("admin");
  assert.equal((await request("/api/attendance", {}, adminCookie)).status, 200);
  const principalCookie = await login("principal");
  assert.equal((await request("/api/attendance", {}, principalCookie)).status, 200);
  const studentCookie = await login("student");
  const own = await request("/api/attendance?studentId=2", {}, studentCookie);
  assert.equal(own.status, 200);
  assert.equal((await own.json()).length, 1, "student query must return only linked student's records");
  console.log("Attendance security tests passed.");
} finally { server.close(); }
