import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const schema = await readFile("shared/schema.ts", "utf8"); const migration = await readFile("migrations/0006_exam_results_foundation.sql", "utf8"); const routes = await readFile("server/routes.ts", "utf8");
for (const token of ["examResults", "exam_results_marks_valid", "exam_results_status_valid", "exam_results_schedule_student_unique", "obtainedMarks", "isAbsent"]) assert.match(schema, new RegExp(token));
for (const token of ["exam_results_exam_scope_fk", "exam_results_schedule_scope_fk", "exam_results_student_school_fk", "exam_results_session_school_fk", "exam_results_schedule_student_unique"]) assert.match(migration, new RegExp(token));
for (const token of ["createExamResultsBulk", "teacherAllowsSchedule", "api.examResults.status", "result.status === \"published\""]) assert.match(routes, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
console.log("Exam results foundation tests passed.");
