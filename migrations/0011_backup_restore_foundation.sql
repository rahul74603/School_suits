-- Step 12: PostgreSQL-native backup and restore metadata.
CREATE TABLE IF NOT EXISTS "backup_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "backup_type" text DEFAULT 'postgres-custom' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "size_bytes" integer,
  "storage_key" text NOT NULL,
  "restore_status" text,
  "restore_started_at" timestamp,
  "restore_completed_at" timestamp,
  "error_message" text,
  CONSTRAINT "backup_records_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict,
  CONSTRAINT "backup_records_creator_school_fk" FOREIGN KEY ("created_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "backup_records_type_check" CHECK ("backup_type" = 'postgres-custom'),
  CONSTRAINT "backup_records_status_check" CHECK ("status" IN ('pending', 'completed', 'failed', 'deleted'))
);
CREATE INDEX IF NOT EXISTS "backup_records_school_created_idx" ON "backup_records" ("school_id", "created_at");
