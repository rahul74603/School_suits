-- Step 11: privacy-safe document metadata foundation. Binary storage is external/adapter-owned.
CREATE TABLE IF NOT EXISTS "documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer,
  "owner_type" text NOT NULL,
  "owner_id" integer,
  "document_type" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "uploaded_by_user_id" integer NOT NULL,
  "uploaded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "documents_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict,
  CONSTRAINT "documents_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "documents_uploader_school_fk" FOREIGN KEY ("uploaded_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "documents_owner_type_check" CHECK ("owner_type" IN ('student', 'staff', 'school')),
  CONSTRAINT "documents_size_positive" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760)
);
CREATE INDEX IF NOT EXISTS "documents_school_owner_idx" ON "documents" ("school_id", "owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "documents_school_session_idx" ON "documents" ("school_id", "session_id");
