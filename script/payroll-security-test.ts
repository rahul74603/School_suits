import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, PayrollRecord, User } from "@shared/schema";
process.env.DATABASE_URL ||= "postgres://payroll-test:payroll-test@127.0.0.1:5432/payroll-test";
const passwordHash = await hashPassword("password"); const sessionRecord: AcademicSession = { id: 100, schoolId: 10, name: "2026", startDate: null, endDate: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
const users: User[] = ["admin", "principal", "accountant", "teacher", "student"].map((role, index) => ({ id: index + 1, username: role, passwordHash, role, name: role, schoolId: 10 }));
const payroll: PayrollRecord[] = [{ id: 1, staffId: 11, schoolId: 10, sessionId: 100, payrollMonth: 1, payrollYear: 2026, basicAmount: 30000, allowances: 2000, deductions: 1000, advanceDeduction: 0, netSalary: 31000, status: "draft", paymentDate: null, remarks: null, createdAt: new Date(), updatedAt: new Date() }];
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find(user => user.username === username), getActiveSession: async (schoolId: number) => schoolId === 10 ? sessionRecord : undefined,
  getStaffForUser: async (userId: number) => userId === 4 ? { id: 11, schoolId: 10 } : undefined,
  getPayroll: async (_school: number, _session: number, filters: any = {}) => payroll.filter(row => filters.staffId === undefined || row.staffId === filters.staffId), getPayrollRecord: async (id: number) => payroll.find(row => row.id === id),
  getSalaryStructures: async () => [], createPayroll: async (input: any) => ({ ...input, id: 2, basicAmount: 30000, netSalary: 30000, status: "draft", createdAt: new Date(), updatedAt: new Date() }),
} as unknown as IStorage;
const app = express(); app.use(express.json()); app.use(session({ secret: "payroll-test", resave: false, saveUninitialized: false })); const { registerRoutes } = await import("../server/routes"); await registerRoutes(createServer(), app, fakeStorage); const server = app.listen(0); const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start server"); const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, init: RequestInit = {}, cookie?: string) { const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); return fetch(`${base}${path}`, { ...init, headers }); }
async function login(username: string) { const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "password" }) }); assert.equal(response.status, 200); return response.headers.get("set-cookie")!; }
try { const staff = await login("teacher"); const own = await request("/api/payroll?staffId=999", {}, staff); assert.equal(own.status, 200); assert.equal((await own.json()).length, 1); const student = await login("student"); assert.equal((await request("/api/payroll", {}, student)).status, 403); const admin = await login("admin"); assert.equal((await request("/api/payroll", {}, admin)).status, 200); const principal = await login("principal"); assert.equal((await request("/api/payroll", {}, principal)).status, 200); const accountant = await login("accountant"); assert.equal((await request("/api/payroll/summary", {}, accountant)).status, 200); const forbidden = await request("/api/payroll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffId: 11, payrollMonth: 1, payrollYear: 2026, allowances: 0, deductions: 0, advanceDeduction: 0 }) }, staff); assert.equal(forbidden.status, 403); console.log("Payroll security tests passed."); } finally { server.close(); }
