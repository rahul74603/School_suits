-- Step 4: school/session scoped exams and schedules
CREATE TABLE IF NOT EXISTS "exams" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "name" text NOT NULL,
  "exam_type" text NOT NULL DEFAULT 'general',
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "exams_date_order_valid" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "exams_status_valid" CHECK ("status" IN ('draft', 'published', 'completed', 'archived')),
  CONSTRAINT "exams_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "exams_school_session_name_unique" ON "exams" ("school_id", "session_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "exams_id_scope_unique" ON "exams" ("id", "school_id", "session_id");
CREATE INDEX IF NOT EXISTS "exams_school_session_idx" ON "exams" ("school_id", "session_id", "status", "start_date");

CREATE TABLE IF NOT EXISTS "exam_class_scopes" (
  "id" serial PRIMARY KEY NOT NULL,
  "exam_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  CONSTRAINT "exam_class_scopes_exam_scope_fk" FOREIGN KEY ("exam_id", "school_id", "session_id") REFERENCES "exams"("id", "school_id", "session_id") ON DELETE cascade,
  CONSTRAINT "exam_class_scopes_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_class_scopes_unique" ON "exam_class_scopes" ("exam_id", "school_id", "session_id", "class_name", "section");

CREATE TABLE IF NOT EXISTS "exam_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "exam_id" integer NOT NULL,
  "subject_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  "exam_date" date NOT NULL,
  "max_marks" integer NOT NULL,
  "passing_marks" integer NOT NULL,
  "start_time" text,
  "end_time" text,
  CONSTRAINT "exam_schedules_marks_valid" CHECK ("max_marks" > 0 AND "passing_marks" >= 0 AND "passing_marks" <= "max_marks"),
  CONSTRAINT "exam_schedules_exam_scope_fk" FOREIGN KEY ("exam_id", "school_id", "session_id") REFERENCES "exams"("id", "school_id", "session_id") ON DELETE cascade,
  CONSTRAINT "exam_schedules_class_scope_fk" FOREIGN KEY ("exam_id", "school_id", "session_id", "class_name", "section") REFERENCES "exam_class_scopes"("exam_id", "school_id", "session_id", "class_name", "section") ON DELETE cascade,
  CONSTRAINT "exam_schedules_subject_scope_fk" FOREIGN KEY ("subject_id", "school_id", "session_id") REFERENCES "subjects"("id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "exam_schedules_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "exam_schedules_unique" ON "exam_schedules" ("exam_id", "subject_id", "school_id", "session_id", "class_name", "section");
