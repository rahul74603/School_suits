import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { createServer } from "node:http";
import { hashPassword } from "../server/auth";
import type { IStorage } from "../server/storage";
import type { AcademicSession, User } from "@shared/schema";
process.env.DATABASE_URL ||= "postgres://financial-test:financial-test@127.0.0.1:5432/financial-test";
const passwordHash = await hashPassword("password"); const active: AcademicSession = { id: 100, schoolId: 10, name: "2026", startDate: null, endDate: null, isActive: true, createdAt: new Date(), updatedAt: new Date() };
const users: User[] = ["admin", "principal", "accountant", "teacher"].map((role, index) => ({ id: index + 1, username: role, passwordHash, role, name: role, schoolId: 10 }));
const fakeStorage = {
  getUserByUsername: async (username: string) => users.find(user => user.username === username), getActiveSession: async (schoolId: number) => schoolId === 10 ? active : undefined,
  getFinancialFeeIncome: async () => [{ amount: 150 }], getPaidPayroll: async () => [{ netSalary: 100 }], getExpenses: async () => [{ id: 1, categoryId: 1, amount: 25, status: "finalized" }, { id: 2, categoryId: 1, amount: 999, status: "draft" }], getExpenseCategories: async () => [{ id: 1, name: "Utilities" }],
} as unknown as IStorage;
const app = express(); app.use(express.json()); app.use(session({ secret: "financial-test", resave: false, saveUninitialized: false })); const { registerRoutes } = await import("../server/routes"); await registerRoutes(createServer(), app, fakeStorage); const server = app.listen(0); const address = server.address(); if (!address || typeof address === "string") throw new Error("Unable to start server"); const base = `http://127.0.0.1:${address.port}`;
async function request(path: string, init: RequestInit = {}, cookie?: string) { const headers = new Headers(init.headers); if (cookie) headers.set("cookie", cookie); return fetch(`${base}${path}`, { ...init, headers }); }
async function login(username: string) { const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password: "password" }) }); assert.equal(response.status, 200); return response.headers.get("set-cookie")!; }
try { const accountant = await login("accountant"); const summary = await request("/api/financial/summary", {}, accountant); assert.equal(summary.status, 200); const values = await summary.json(); assert.equal(values.totalFeeIncome, 150); assert.equal(values.totalPayrollExpense, 100); assert.equal(values.totalOtherExpenses, 25); assert.equal(values.totalExpenses, 125); assert.equal(values.netBalance, 25); const principal = await login("principal"); assert.equal((await request("/api/financial/summary", {}, principal)).status, 200); const admin = await login("admin"); assert.equal((await request("/api/financial/expenses", {}, admin)).status, 200); const teacher = await login("teacher"); assert.equal((await request("/api/financial/summary", {}, teacher)).status, 403); assert.equal((await request("/api/financial/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ categoryId: 1, description: "x", amount: 1, expenseDate: "2026-01-01" }) }, teacher)).status, 403); console.log("Financial security tests passed."); } finally { server.close(); }
