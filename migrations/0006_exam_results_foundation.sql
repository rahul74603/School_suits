-- Step 5: secure exam results and marks entry
CREATE UNIQUE INDEX IF NOT EXISTS "exam_schedules_id_scope_unique" ON "exam_schedules" ("id", "exam_id", "school_id", "session_id");

CREATE TABLE IF NOT EXISTS "exam_results" (
  "id" serial PRIMARY KEY NOT NULL,
  "exam_id" integer NOT NULL,
  "schedule_id" integer NOT NULL,
  "student_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "obtained_marks" integer,
  "is_absent" boolean DEFAULT false NOT NULL,
  "remarks" text,
  "status" text NOT NULL DEFAULT 'draft',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exam_results_status_valid" CHECK ("status" IN ('draft', 'published')),
  CONSTRAINT "exam_results_marks_valid" CHECK (("is_absent" = true AND "obtained_marks" IS NULL) OR ("is_absent" = false AND "obtained_marks" IS NOT NULL AND "obtained_marks" >= 0)),
  CONSTRAINT "exam_results_exam_scope_fk" FOREIGN KEY ("exam_id", "school_id", "session_id") REFERENCES "exams"("id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "exam_results_schedule_scope_fk" FOREIGN KEY ("schedule_id", "exam_id", "school_id", "session_id") REFERENCES "exam_schedules"("id", "exam_id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "exam_results_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "exam_results_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_results_schedule_student_unique" ON "exam_results" ("schedule_id", "student_id", "school_id", "session_id");
CREATE INDEX IF NOT EXISTS "exam_results_student_idx" ON "exam_results" ("school_id", "session_id", "student_id", "exam_id");
CREATE INDEX IF NOT EXISTS "exam_results_exam_idx" ON "exam_results" ("school_id", "session_id", "exam_id", "schedule_id");
