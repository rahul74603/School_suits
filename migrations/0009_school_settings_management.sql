-- Step 10: school/session scoped academic classes and sections
CREATE TABLE IF NOT EXISTS "school_classes" (
  "id" serial PRIMARY KEY NOT NULL, "school_id" integer NOT NULL, "session_id" integer NOT NULL,
  "name" text NOT NULL, "display_order" integer DEFAULT 0 NOT NULL, "is_active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "school_classes_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_classes_scope_name_unique" ON "school_classes" ("school_id", "session_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "school_classes_id_scope_unique" ON "school_classes" ("id", "school_id", "session_id");
CREATE TABLE IF NOT EXISTS "school_sections" (
  "id" serial PRIMARY KEY NOT NULL, "class_id" integer NOT NULL, "school_id" integer NOT NULL, "session_id" integer NOT NULL,
  "name" text NOT NULL, "display_order" integer DEFAULT 0 NOT NULL, "is_active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "school_sections_class_scope_fk" FOREIGN KEY ("class_id", "school_id", "session_id") REFERENCES "school_classes"("id", "school_id", "session_id") ON DELETE restrict,
  CONSTRAINT "school_sections_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_sections_class_name_unique" ON "school_sections" ("class_id", "school_id", "session_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "school_sections_id_scope_unique" ON "school_sections" ("id", "class_id", "school_id", "session_id");
