-- Step 8: school/session scoped salary structures and payroll
CREATE UNIQUE INDEX IF NOT EXISTS "staff_id_school_unique" ON "staff" ("id", "school_id");

CREATE TABLE IF NOT EXISTS "staff_user_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "staff_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "staff_user_links_staff_school_fk" FOREIGN KEY ("staff_id", "school_id") REFERENCES "staff"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "staff_user_links_user_school_fk" FOREIGN KEY ("user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_user_links_staff_unique" ON "staff_user_links" ("staff_id", "school_id");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_user_links_user_unique" ON "staff_user_links" ("user_id", "school_id");

CREATE TABLE IF NOT EXISTS "salary_structures" (
  "id" serial PRIMARY KEY NOT NULL,
  "staff_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "basic_salary" integer NOT NULL,
  "allowances" integer DEFAULT 0 NOT NULL,
  "deductions" integer DEFAULT 0 NOT NULL,
  "advance_outstanding" integer DEFAULT 0 NOT NULL,
  "effective_date" date NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "salary_structures_amounts_nonnegative" CHECK ("basic_salary" >= 0 AND "allowances" >= 0 AND "deductions" >= 0 AND "advance_outstanding" >= 0),
  CONSTRAINT "salary_structures_staff_school_fk" FOREIGN KEY ("staff_id", "school_id") REFERENCES "staff"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "salary_structures_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "salary_structures_staff_session_idx" ON "salary_structures" ("school_id", "session_id", "staff_id");

CREATE TABLE IF NOT EXISTS "payroll_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "staff_id" integer NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "payroll_month" integer NOT NULL,
  "payroll_year" integer NOT NULL,
  "basic_amount" integer NOT NULL,
  "allowances" integer NOT NULL,
  "deductions" integer NOT NULL,
  "advance_deduction" integer DEFAULT 0 NOT NULL,
  "net_salary" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "payment_date" timestamp,
  "remarks" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_amounts_nonnegative" CHECK ("basic_amount" >= 0 AND "allowances" >= 0 AND "deductions" >= 0 AND "advance_deduction" >= 0 AND "net_salary" >= 0),
  CONSTRAINT "payroll_month_year_valid" CHECK ("payroll_month" BETWEEN 1 AND 12 AND "payroll_year" BETWEEN 1900 AND 2200),
  CONSTRAINT "payroll_status_valid" CHECK ("status" IN ('draft', 'finalized', 'paid')),
  CONSTRAINT "payroll_staff_school_fk" FOREIGN KEY ("staff_id", "school_id") REFERENCES "staff"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "payroll_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_staff_month_unique" ON "payroll_records" ("staff_id", "school_id", "session_id", "payroll_month", "payroll_year");
CREATE INDEX IF NOT EXISTS "payroll_school_month_idx" ON "payroll_records" ("school_id", "session_id", "payroll_year", "payroll_month");
