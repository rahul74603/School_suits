import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("migrations/0002_database_foundation.sql", "utf8");
const runner = await readFile("script/migrate.ts", "utf8");
const stepTwoMigration = await readFile("migrations/0003_multi_role_assignment_foundation.sql", "utf8");

assert.match(migration, /CREATE TABLE IF NOT EXISTS academic_sessions/);
assert.match(migration, /academic_sessions_one_active_per_school/);
assert.match(migration, /students_school_session_admission_unique/);
assert.match(migration, /fee_payments_school_receipt_unique/);
assert.match(migration, /fee_payments_student_school_fk/);
assert.match(migration, /amount_positive/);
assert.match(migration, /Duplicate student admission numbers/);
assert.match(migration, /Duplicate fee receipt numbers/);
assert.match(migration, /Duplicate fee structures/);
assert.match(runner, /pg_advisory_lock/);
assert.match(runner, /BEGIN/);
assert.match(runner, /COMMIT/);
assert.match(runner, /ROLLBACK/);
assert.match(runner, /schema_migrations/);
assert.match(stepTwoMigration, /CREATE TABLE IF NOT EXISTS "subjects"/);
assert.match(stepTwoMigration, /teacher_subject_assignments_subject_scope_fk/);
assert.match(stepTwoMigration, /teacher_class_assignments/);
assert.match(stepTwoMigration, /student_user_links_user_school_fk/);

console.log("Database foundation migration tests passed.");
