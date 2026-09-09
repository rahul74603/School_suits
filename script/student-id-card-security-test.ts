import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, Student, User } from "@shared/schema";
process.env.DATABASE_URL ||= "postgres://id-card-test:id-card-test@127.0.0.1:5432/id-card-test";
const passwordHash = await hashPassword("password");
const sessionRecord: AcademicSession = { id: 100, schoolId: 10, name: "2026", startDate: null, endDate: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
const student: Student = { id: 1, admissionNo: "A1", name: "Student A", fatherName: "Parent", motherName: null, class: "1", section: "A", rollNo: "1", aadhaar: "SECRET", category: null, dob: null, contact: "private", address: "private", isActive: true, schoolId: 10, sessionId: 100, createdAt: new Date(), updatedAt: new Date() };
const users: User[] = ["admin", "principal", "teacher", "student", "staff"].map((role, index) => ({ id: index + 1, username: role, passwordHash, role, name: role, schoolId: 10 }));
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find(user => user.username === username), getActiveSession: async (schoolId: number) => schoolId === 10 ? sessionRecord : undefined,
  getStudent: async (id: number, schoolId: number) => id === 1 && schoolId === 10 ? student : undefined,
  getStudentForUser: async (id: number, schoolId: number, sessionId: number) => id === 4 && schoolId === 10 && sessionId === 100 ? student : undefined,
  getTeacherClassAssignments: async (_school: number, _session: number, id?: number) => id === 3 ? [{ id: 1, teacherUserId: 3, className: "1", section: "A", schoolId: 10, sessionId: 100, createdAt: new Date() }] : [],
  getSchool: async () => ({ id: 10, name: "School", address: "Address", logo: null, contact: "Contact", createdAt: new Date() }),
} as unknown as IStorage;
const app = express(); app.use(express.json()); app.use(session({ secret: "id-card-test", resave: false, saveUninitialized: false })); const { registerRoutes } = await import("../server/routes"); await registerRoutes(createServer(), app, fakeStorage); const server = app.listen(0); const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start server"); const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, init: RequestInit = {}, cookie?: string) { const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); return fetch(`${base}${path}`, { ...init, headers }); }
async function login(username: string) { const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "password" }) }); assert.equal(response.status, 200); return response.headers.get("set-cookie")!; }
try { const admin = await login("admin"); const adminResponse = await request("/api/student-id-cards/1", {}, admin); assert.equal(adminResponse.status, 200); const adminBody = await adminResponse.json(); assert.equal("aadhaar" in adminBody.card.student, false); assert.equal(adminBody.card.photoAvailable, false); const principal = await login("principal"); assert.equal((await request("/api/student-id-cards/1", {}, principal)).status, 200); const teacher = await login("teacher"); assert.equal((await request("/api/student-id-cards/1", {}, teacher)).status, 200); assert.equal((await request("/api/student-id-cards/2", {}, teacher)).status, 404); const studentCookie = await login("student"); assert.equal((await request("/api/student-id-cards/1", {}, studentCookie)).status, 200); assert.equal((await request("/api/student-id-cards/2", {}, studentCookie)).status, 404); const staff = await login("staff"); assert.equal((await request("/api/student-id-cards/1", {}, staff)).status, 403); console.log("Student ID card security tests passed."); } finally { server.close(); }
