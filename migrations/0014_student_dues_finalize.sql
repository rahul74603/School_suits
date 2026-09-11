-- Step 15: finalize student_dues schema after legacy reconciliation.

ALTER TABLE "student_dues"
  ALTER COLUMN "student_id" SET NOT NULL;

ALTER TABLE "student_dues"
  ALTER COLUMN "school_id" SET NOT NULL;

ALTER TABLE "student_dues"
  ALTER COLUMN "session_id" SET NOT NULL;

ALTER TABLE "student_dues"
  ALTER COLUMN "description" SET NOT NULL;

ALTER TABLE "student_dues"
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "student_dues"
  DROP COLUMN IF EXISTS "fee_name";

ALTER TABLE "student_dues"
  DROP COLUMN IF EXISTS "is_paid";

ALTER TABLE "student_dues"
  ALTER COLUMN "due_date" TYPE date
  USING "due_date"::date;

ALTER TABLE "student_dues"
  DROP CONSTRAINT IF EXISTS "student_dues_student_id_students_id_fk";

ALTER TABLE "student_dues"
  DROP CONSTRAINT IF EXISTS "student_dues_student_school_fk";

ALTER TABLE "student_dues"
  DROP CONSTRAINT IF EXISTS "student_dues_session_school_fk";

ALTER TABLE "student_dues"
  ADD CONSTRAINT "student_dues_student_school_fk"
  FOREIGN KEY ("student_id", "school_id")
  REFERENCES "students"("id", "school_id")
  ON DELETE RESTRICT;

ALTER TABLE "student_dues"
  ADD CONSTRAINT "student_dues_session_school_fk"
  FOREIGN KEY ("session_id", "school_id")
  REFERENCES "academic_sessions"("id", "school_id")
  ON DELETE RESTRICT;

ALTER TABLE "student_dues"
  DROP CONSTRAINT IF EXISTS "student_dues_amount_positive";

ALTER TABLE "student_dues"
  ADD CONSTRAINT "student_dues_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "student_dues"
  DROP CONSTRAINT IF EXISTS "student_dues_status_check";

ALTER TABLE "student_dues"
  ADD CONSTRAINT "student_dues_status_check"
  CHECK ("status" IN ('open', 'settled', 'void'));

CREATE INDEX IF NOT EXISTS "student_dues_school_session_student_idx"
ON "student_dues" ("school_id", "session_id", "student_id");