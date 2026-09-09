-- Step 3: school/session scoped attendance foundation
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "student_id" integer NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  "attendance_date" date NOT NULL,
  "subject_id" integer,
  "status" text NOT NULL,
  "marked_by_user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "attendance_status_valid" CHECK ("status" IN ('present', 'absent', 'late', 'leave')),
  CONSTRAINT "attendance_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "attendance_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "attendance_subject_scope_fk" FOREIGN KEY ("subject_id", "school_id", "session_id") REFERENCES "subjects"("id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "attendance_marker_school_fk" FOREIGN KEY ("marked_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "attendance_school_date_class_idx" ON "attendance_records" ("school_id", "session_id", "attendance_date", "class_name", "section");
CREATE INDEX IF NOT EXISTS "attendance_student_history_idx" ON "attendance_records" ("school_id", "session_id", "student_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "attendance_subject_history_idx" ON "attendance_records" ("school_id", "session_id", "subject_id", "attendance_date");
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_student_subject_unique" ON "attendance_records" ("school_id", "session_id", "attendance_date", "student_id", "subject_id") WHERE "subject_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_student_daily_unique" ON "attendance_records" ("school_id", "session_id", "attendance_date", "student_id") WHERE "subject_id" IS NULL;
