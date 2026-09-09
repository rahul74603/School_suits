-- Step 9: school/session scoped expense management; fee/payroll income is derived
CREATE TABLE IF NOT EXISTS "expense_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "expense_categories_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict
);
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_school_name_unique" ON "expense_categories" ("school_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_id_school_unique" ON "expense_categories" ("id", "school_id");

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" serial PRIMARY KEY NOT NULL,
  "school_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "category_id" integer NOT NULL,
  "description" text NOT NULL,
  "amount" integer NOT NULL,
  "expense_date" date NOT NULL,
  "payment_reference" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "remarks" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "expenses_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "expenses_status_valid" CHECK ("status" IN ('draft', 'finalized')),
  CONSTRAINT "expenses_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "expenses_category_school_fk" FOREIGN KEY ("category_id", "school_id") REFERENCES "expense_categories"("id", "school_id") ON DELETE restrict,
  CONSTRAINT "expenses_creator_school_fk" FOREIGN KEY ("created_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE restrict
);
CREATE INDEX IF NOT EXISTS "expenses_school_session_date_idx" ON "expenses" ("school_id", "session_id", "expense_date");
CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("school_id", "session_id", "category_id");
