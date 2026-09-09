import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const routes = await readFile("server/routes.ts", "utf8"); const page = await readFile("client/src/pages/StudentIdCards.tsx", "utf8");
assert.match(routes, /api\.studentIdCards\.get\.path/); assert.match(routes, /getStudentForUser/); assert.match(routes, /photoAvailable: false/); assert.match(routes, /admissionNo/); assert.doesNotMatch(routes, /aadhaar: student\.aadhaar/); assert.doesNotMatch(page, /aadhaar/i); assert.match(page, /window\.print/); assert.match(page, /photoAvailable/);
console.log("Student ID card foundation tests passed.");
