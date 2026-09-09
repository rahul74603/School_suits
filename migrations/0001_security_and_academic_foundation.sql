BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Password security
-- ------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password'
  ) THEN
    UPDATE users
    SET password_hash = crypt(password, gen_salt('bf', 12))
    WHERE password_hash IS NULL
      AND password IS NOT NULL;

    ALTER TABLE users
      DROP COLUMN password;
  END IF;
END $$;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL;

-- ------------------------------------------------------------
-- 2. PostgreSQL session store
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
  ON user_sessions (expire);

-- ------------------------------------------------------------
-- 3. Academic sessions
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS academic_sessions (
  id serial PRIMARY KEY,
  school_id integer NOT NULL,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT academic_sessions_date_order_check
    CHECK (
      end_date IS NULL
      OR start_date IS NULL
      OR end_date >= start_date
    ),

  CONSTRAINT academic_sessions_school_name_unique
    UNIQUE (school_id, name),

  CONSTRAINT academic_sessions_id_school_unique
    UNIQUE (id, school_id),

  CONSTRAINT academic_sessions_school_fk
    FOREIGN KEY (school_id)
    REFERENCES schools(id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS
  academic_sessions_one_active_per_school
  ON academic_sessions (school_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS
  academic_sessions_school_active_idx
  ON academic_sessions (school_id, is_active);

-- Every existing school gets one initial session.
INSERT INTO academic_sessions (school_id, name, is_active)
SELECT id, 'Initial Session', true
FROM schools
WHERE NOT EXISTS (
  SELECT 1
  FROM academic_sessions s
  WHERE s.school_id = schools.id
);

-- ------------------------------------------------------------
-- 4. Add session columns
-- ------------------------------------------------------------

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS session_id integer;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS session_id integer;

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS session_id integer;

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- ------------------------------------------------------------
-- 5. Backfill existing records
-- ------------------------------------------------------------

UPDATE students st
SET session_id = s.id
FROM academic_sessions s
WHERE st.session_id IS NULL
  AND st.school_id = s.school_id
  AND s.is_active = true;

UPDATE fee_structures fs
SET session_id = s.id
FROM academic_sessions s
WHERE fs.session_id IS NULL
  AND fs.school_id = s.school_id
  AND s.is_active = true;

UPDATE fee_payments fp
SET session_id = st.session_id
FROM students st
WHERE fp.session_id IS NULL
  AND fp.student_id = st.id
  AND fp.school_id = st.school_id
  AND st.session_id IS NOT NULL;

-- Any payment still missing session must use the school's active session.
UPDATE fee_payments fp
SET session_id = s.id
FROM academic_sessions s
WHERE fp.session_id IS NULL
  AND fp.school_id = s.school_id
  AND s.is_active = true;

-- ------------------------------------------------------------
-- 6. Validate before making columns required
-- ------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM students
    WHERE school_id IS NULL
       OR session_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot make students school_id/session_id NOT NULL: unresolved rows exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM fee_structures
    WHERE school_id IS NULL
       OR session_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot make fee_structures school_id/session_id NOT NULL: unresolved rows exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM fee_payments
    WHERE school_id IS NULL
       OR student_id IS NULL
       OR session_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot make fee_payments ownership/session columns NOT NULL: unresolved rows exist';
  END IF;
END $$;

ALTER TABLE students
  ALTER COLUMN school_id SET NOT NULL,
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE fee_structures
  ALTER COLUMN school_id SET NOT NULL,
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE fee_payments
  ALTER COLUMN school_id SET NOT NULL,
  ALTER COLUMN student_id SET NOT NULL,
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE staff
  ALTER COLUMN school_id SET NOT NULL;

-- ------------------------------------------------------------
-- 7. Remove unsafe global uniqueness
-- ------------------------------------------------------------

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_admission_no_unique;

ALTER TABLE fee_payments
  DROP CONSTRAINT IF EXISTS fee_payments_receipt_no_unique;

-- ------------------------------------------------------------
-- 8. Scope uniqueness to school/session
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS
  students_school_session_admission_unique
  ON students (school_id, session_id, admission_no);

CREATE UNIQUE INDEX IF NOT EXISTS
  students_id_school_unique
  ON students (id, school_id);

CREATE UNIQUE INDEX IF NOT EXISTS
  fee_structures_school_session_class_unique
  ON fee_structures (school_id, session_id, class);

CREATE UNIQUE INDEX IF NOT EXISTS
  fee_payments_school_receipt_unique
  ON fee_payments (school_id, receipt_no);

-- ------------------------------------------------------------
-- 9. Ownership foreign keys
-- ------------------------------------------------------------

ALTER TABLE students
  ADD CONSTRAINT students_session_school_fk
  FOREIGN KEY (session_id, school_id)
  REFERENCES academic_sessions(id, school_id)
  ON DELETE RESTRICT;

ALTER TABLE fee_structures
  ADD CONSTRAINT fee_structures_session_school_fk
  FOREIGN KEY (session_id, school_id)
  REFERENCES academic_sessions(id, school_id)
  ON DELETE RESTRICT;

ALTER TABLE fee_payments
  ADD CONSTRAINT fee_payments_session_school_fk
  FOREIGN KEY (session_id, school_id)
  REFERENCES academic_sessions(id, school_id)
  ON DELETE RESTRICT;

ALTER TABLE fee_payments
  ADD CONSTRAINT fee_payments_student_school_fk
  FOREIGN KEY (student_id, school_id)
  REFERENCES students(id, school_id)
  ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- 10. Supporting indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS
  students_school_session_class_idx
  ON students (school_id, session_id, class, section);

CREATE INDEX IF NOT EXISTS
  students_admission_lookup_idx
  ON students (school_id, admission_no);

CREATE INDEX IF NOT EXISTS
  fee_structures_school_session_class_idx
  ON fee_structures (school_id, session_id, class);

CREATE INDEX IF NOT EXISTS
  fee_payments_student_period_idx
  ON fee_payments (student_id, session_id, year, month);

CREATE INDEX IF NOT EXISTS
  fee_payments_school_period_idx
  ON fee_payments (school_id, session_id, payment_date);

CREATE INDEX IF NOT EXISTS
  staff_school_idx
  ON staff (school_id);

-- ------------------------------------------------------------
-- 11. Financial integrity checks
-- ------------------------------------------------------------

ALTER TABLE fee_structures
  ADD CONSTRAINT fee_structures_amounts_nonnegative
  CHECK (
    monthly_fee >= 0
    AND admission_fee >= 0
    AND exam_fee >= 0
    AND other_fee >= 0
  );

ALTER TABLE fee_payments
  ADD CONSTRAINT fee_payments_amount_positive
  CHECK (amount > 0);

ALTER TABLE fee_payments
  ADD CONSTRAINT fee_payments_year_valid
  CHECK (year BETWEEN 1900 AND 2200);

ALTER TABLE staff
  ADD CONSTRAINT staff_basic_salary_nonnegative
  CHECK (basic_salary >= 0);

COMMIT;