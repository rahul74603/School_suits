-- Step 2: multi-role and teacher assignment foundation
CREATE UNIQUE INDEX IF NOT EXISTS "users_id_school_unique" ON "users" ("id", "school_id");
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "name" text NOT NULL,
  "code" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "subjects_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_session_name_unique" ON "subjects" ("school_id", "session_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_session_code_unique" ON "subjects" ("school_id", "session_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_id_school_session_unique" ON "subjects" ("id", "school_id", "session_id");

CREATE TABLE IF NOT EXISTS "teacher_subject_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_user_id" integer NOT NULL,
  "subject_id" integer NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_subject_assignments_teacher_school_fk" FOREIGN KEY ("teacher_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "teacher_subject_assignments_subject_scope_fk" FOREIGN KEY ("subject_id", "school_id", "session_id") REFERENCES "subjects"("id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "teacher_subject_assignments_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_subject_assignments_unique" ON "teacher_subject_assignments" ("teacher_user_id", "subject_id", "school_id", "session_id");

CREATE TABLE IF NOT EXISTS "teacher_class_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "teacher_user_id" integer NOT NULL,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_class_assignments_teacher_school_fk" FOREIGN KEY ("teacher_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "teacher_class_assignments_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_class_assignments_unique" ON "teacher_class_assignments" ("teacher_user_id", "class_name", "section", "school_id", "session_id");

CREATE TABLE IF NOT EXISTS "student_user_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "student_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE restrict,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "student_user_links_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "student_user_links_user_school_fk" FOREIGN KEY ("user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "student_user_links_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "student_user_links_unique" ON "student_user_links" ("student_id", "user_id", "school_id", "session_id");
