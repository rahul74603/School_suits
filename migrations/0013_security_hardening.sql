-- Step 14: persistent security state and school-scoped audit events.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_version" integer DEFAULT 1 NOT NULL;
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer,
  "session_id" integer,
  "actor_user_id" integer,
  "actor_role" text,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" integer,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict,
  CONSTRAINT "audit_events_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "audit_events_actor_school_fk" FOREIGN KEY ("actor_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "audit_events_school_created_idx" ON "audit_events" ("school_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_events_actor_idx" ON "audit_events" ("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events" ("school_id", "action", "created_at");
