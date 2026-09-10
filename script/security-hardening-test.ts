import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import { csrfProtection, hashPassword, verifyPassword } from "../server/auth";

const app = express();
app.use(session({ secret: "hardening-test", resave: false, saveUninitialized: true }));
app.get("/seed", (req, res) => { req.session.user = { id: 1, username: "admin", role: "admin", name: "Admin", schoolId: 10 }; res.sendStatus(204); });
app.use(csrfProtection);
app.post("/mutate", (_req, res) => res.sendStatus(204));
const server = app.listen(0); const address = server.address(); if (!address || typeof address === "string") throw new Error("server failed"); const base = `http://127.0.0.1:${address.port}`;
try {
  const seed = await fetch(`${base}/seed`); const cookie = seed.headers.get("set-cookie")?.split(";")[0]; assert.ok(cookie);
  const rejected = await fetch(`${base}/mutate`, { method: "POST", headers: { cookie: cookie!, Origin: "https://evil.example" } }); assert.equal(rejected.status, 403);
  const accepted = await fetch(`${base}/mutate`, { method: "POST", headers: { cookie: cookie!, Origin: `http://127.0.0.1:${address.port}` } }); assert.equal(accepted.status, 204);
} finally { server.close(); }
const passwordHash = await hashPassword("Strong-Password-123!"); assert.equal(await verifyPassword("Strong-Password-123!", passwordHash), true); assert.equal(await verifyPassword("old-password", passwordHash), false); assert.equal(passwordHash.includes("Strong-Password"), false);
console.log("Security hardening tests passed.");
