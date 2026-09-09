import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("shared/schema.ts", "utf8");
const routes = await readFile("server/routes.ts", "utf8");
const migration = await readFile("migrations/0004_attendance_foundation.sql", "utf8");

for (const token of ["attendanceRecords", "attendanceDate", "subjectId", "attendanceStatusSchema", "attendance_status_valid", "attendance_student_subject_unique", "attendance_student_daily_unique"]) {
  assert.match(schema, new RegExp(token), `schema must define ${token}`);
}
for (const token of ["attendance_student_school_fk", "attendance_session_school_fk", "attendance_subject_scope_fk", "attendance_marker_school_fk", "attendance_school_date_class_idx"]) {
  assert.match(migration, new RegExp(token), `migration must define ${token}`);
}
assert.match(routes, /app\.post\(api\.attendance\.mark\.path, attendanceManagers/);
assert.match(routes, /app\.get\(api\.attendance\.list\.path, attendanceReaders/);
assert.match(routes, /app\.get\(api\.attendance\.summary\.path, attendanceReaders/);
assert.match(routes, /hasTeacherScope/);
assert.match(routes, /getStudentForUser/);
assert.match(routes, /subjectId.*subjectIds|subjectIds.*subjectId/);
assert.match(routes, /createAttendanceBulk/);

console.log("Attendance foundation tests passed.");
