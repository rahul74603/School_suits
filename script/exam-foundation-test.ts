import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const schema = await readFile("shared/schema.ts", "utf8");
const migration = await readFile("migrations/0005_exams_foundation.sql", "utf8");
const routes = await readFile("shared/routes.ts", "utf8");
for (const token of ["exams", "examClassScopes", "examSchedules", "exams_date_order_valid", "exams_status_valid", "exam_schedules_marks_valid", "exam_schedules_unique"]) assert.match(schema, new RegExp(token));
for (const token of ["exams_session_school_fk", "exam_class_scopes_exam_scope_fk", "exam_schedules_subject_scope_fk", "exam_schedules_class_scope_fk", "exam_schedules_unique"]) assert.match(migration, new RegExp(token));
for (const token of ["create: { method", "status: { method", "addSchedule: { method", "updateSchedule: { method"]) assert.match(routes, new RegExp(token));
console.log("Exam foundation tests passed.");
