-- Step 18: Higher Secondary Streams & Student Subject Electives (MP Board / CBSE / State Boards)

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "board_affiliation" text NOT NULL DEFAULT 'MP Board (MPBSE)';

ALTER TABLE "subjects"
  ADD COLUMN IF NOT EXISTS "stream" text DEFAULT 'All',
  ADD COLUMN IF NOT EXISTS "subject_type" text NOT NULL DEFAULT 'core',
  ADD COLUMN IF NOT EXISTS "applicable_classes" text NOT NULL DEFAULT 'All';

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "stream" text,
  ADD COLUMN IF NOT EXISTS "stream_id" integer,
  ADD COLUMN IF NOT EXISTS "elected_subjects" text;

CREATE TABLE IF NOT EXISTS "academic_streams" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "board_pattern" text NOT NULL DEFAULT 'MPBSE',
  "applicable_classes" text NOT NULL DEFAULT '11,12',
  "compulsory_subjects" text NOT NULL DEFAULT '',
  "core_subjects" text NOT NULL DEFAULT '',
  "elective_options" text NOT NULL DEFAULT '',
  "max_electives" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "academic_streams_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_streams_school_session_code_unique"
  ON "academic_streams" ("school_id", "session_id", "code");
