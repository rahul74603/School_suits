-- Step 16: PostgreSQL transport / bus route foundation.

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL,
  "route_name" text NOT NULL,
  "amount" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),

  CONSTRAINT "transport_routes_school_fk"
    FOREIGN KEY ("school_id")
    REFERENCES "schools"("id")
    ON DELETE RESTRICT,

  CONSTRAINT "transport_routes_amount_positive"
    CHECK ("amount" > 0),

  CONSTRAINT "transport_routes_school_name_unique"
    UNIQUE ("school_id", "route_name"),

  CONSTRAINT "transport_routes_id_school_unique"
    UNIQUE ("id", "school_id")
);

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "transport_id" integer;

ALTER TABLE "students"
  DROP CONSTRAINT IF EXISTS "students_transport_school_fk";

ALTER TABLE "students"
  ADD CONSTRAINT "students_transport_school_fk"
  FOREIGN KEY ("transport_id", "school_id")
  REFERENCES "transport_routes"("id", "school_id")
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "transport_routes_school_active_idx"
  ON "transport_routes" ("school_id", "is_active");

CREATE INDEX IF NOT EXISTS "students_school_transport_idx"
  ON "students" ("school_id", "transport_id");