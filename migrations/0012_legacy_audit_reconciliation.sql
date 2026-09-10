-- Step 13: preserve audited student/staff fields and add school/session-scoped dues.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "birth_certificate_no" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previous_school_name" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "previous_class" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tc_number" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tc_issue_date" date;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tc_submitted" boolean DEFAULT false NOT NULL;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "report_card_submitted" boolean DEFAULT false NOT NULL;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "photo" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "is_promoted" boolean DEFAULT false NOT NULL;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "employee_id" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "qualification" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "department" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "advance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "staff_school_employee_id_unique" ON "staff" ("school_id", "employee_id") WHERE "employee_id" IS NOT NULL;
CREATE TABLE IF NOT EXISTS "student_dues" (
  "id" serial PRIMARY KEY NOT NULL, "student_id" integer NOT NULL, "school_id" integer NOT NULL, "session_id" integer NOT NULL,
  "description" text NOT NULL, "amount" integer NOT NULL, "due_date" date, "status" text DEFAULT 'open' NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "student_dues_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "student_dues_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "student_dues_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "student_dues_status_check" CHECK ("status" IN ('open', 'settled', 'void'))
);
CREATE INDEX IF NOT EXISTS "student_dues_school_session_student_idx" ON "student_dues" ("school_id", "session_id", "student_id");
