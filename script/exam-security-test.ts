import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, Exam, ExamClassScope, ExamSchedule, User } from "@shared/schema";
process.env.DATABASE_URL ||= "postgres://exam-test:exam-test@127.0.0.1:5432/exam-test";
const passwordHash = await hashPassword("password");
const sessionRecord: AcademicSession = { id: 100, schoolId: 10, name: "2026", startDate: null, endDate: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
const users: User[] = ["admin", "principal", "teacher", "student", "staff"].map((role, index) => ({ id: index + 1, username: role, passwordHash, role, name: role, schoolId: 10 }));
const exam: Exam = { id: 1, schoolId: 10, sessionId: 100, name: "Midterm", examType: "general", startDate: "2026-01-01", endDate: "2026-01-31", status: "draft", isActive: true, createdAt: new Date(), updatedAt: new Date() };
const scopes: ExamClassScope[] = [{ id: 1, examId: 1, schoolId: 10, sessionId: 100, className: "1", section: "A" }, { id: 2, examId: 1, schoolId: 10, sessionId: 100, className: "2", section: "B" }];
const schedules: ExamSchedule[] = [{ id: 1, examId: 1, subjectId: 10, schoolId: 10, sessionId: 100, className: "1", section: "A", examDate: "2026-01-10", maxMarks: 100, passingMarks: 33, startTime: null, endTime: null }, { id: 2, examId: 1, subjectId: 11, schoolId: 10, sessionId: 100, className: "2", section: "B", examDate: "2026-01-11", maxMarks: 100, passingMarks: 33, startTime: null, endTime: null }];
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find(user => user.username === username),
  getActiveSession: async (schoolId: number) => schoolId === 10 ? sessionRecord : undefined,
  getExams: async () => [exam], getExam: async (id: number) => id === 1 ? exam : undefined,
  getExamScopes: async () => scopes, getExamSchedules: async () => schedules,
  createExam: async (input: any, newScopes: any[]) => ({ exam: { ...exam, ...input, id: 2 }, scopes: newScopes.map((scope, index) => ({ ...scope, id: index + 10, examId: 2 })) }),
  getTeacherClassAssignments: async (_school: number, _session: number, id?: number) => id === 3 ? [{ id: 1, teacherUserId: 3, className: "1", section: "A", schoolId: 10, sessionId: 100, createdAt: new Date() }] : [],
  getTeacherSubjectAssignments: async (_school: number, _session: number, id?: number) => id === 3 ? [{ id: 1, teacherUserId: 3, subjectId: 10, schoolId: 10, sessionId: 100, createdAt: new Date() }] : [],
  getStudentForUser: async (id: number) => id === 4 ? { id: 1, class: "1", section: "A", schoolId: 10, sessionId: 100 } : undefined,
} as unknown as IStorage;
const app = express(); app.use(express.json()); app.use(session({ secret: "exam-test", resave: false, saveUninitialized: false }));
const { registerRoutes } = await import("../server/routes"); await registerRoutes(createServer(), app, fakeStorage);
const server = app.listen(0); const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start test server"); const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, init: RequestInit = {}, cookie?: string) { const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); return fetch(`${base}${path}`, { ...init, headers }); }
async function login(username: string) { const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "password" }) }); assert.equal(response.status, 200); return response.headers.get("set-cookie")!; }
try {
  const staff = await login("staff"); assert.equal((await request("/api/exams", {}, staff)).status, 403);
  const teacher = await login("teacher"); const teacherResponse = await request("/api/exams/1", {}, teacher); assert.equal(teacherResponse.status, 200); const teacherDetail = await teacherResponse.json(); assert.deepEqual(teacherDetail.scopes.map((scope: any) => scope.className), ["1"]); assert.deepEqual(teacherDetail.schedules.map((schedule: any) => schedule.subjectId), [10]);
  const student = await login("student"); assert.equal((await request("/api/exams/1", {}, student)).status, 404, "draft exam must be hidden from students");
  const admin = await login("admin"); const create = await request("/api/exams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "New", examType: "unit", startDate: "2026-02-01", endDate: "2026-02-10", scopes: [{ className: "1", section: "A" }] }) }, admin); assert.equal(create.status, 201);
  const principal = await login("principal"); assert.equal((await request("/api/exams", {}, principal)).status, 200);
  console.log("Exam security tests passed.");
} finally { server.close(); }
