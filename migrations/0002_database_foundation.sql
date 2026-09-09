CREATE TABLE IF NOT EXISTS academic_sessions (
  id serial PRIMARY KEY,
  school_id integer NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name text NOT NULL,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT academic_sessions_date_order_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT academic_sessions_school_name_unique UNIQUE (school_id, name),
  CONSTRAINT academic_sessions_id_school_unique UNIQUE (id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_active_per_school
  ON academic_sessions (school_id)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS academic_sessions_school_active_idx
  ON academic_sessions (school_id, is_active);

INSERT INTO academic_sessions (school_id, name, is_active)
SELECT id, 'Initial Session', true
FROM schools
ON CONFLICT (school_id, name) DO NOTHING;

ALTER TABLE students ADD COLUMN IF NOT EXISTS session_id integer;
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS session_id integer;
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS session_id integer;

ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

UPDATE students AS records
SET session_id = sessions.id
FROM academic_sessions AS sessions
WHERE sessions.school_id = records.school_id AND sessions.is_active = true;

UPDATE fee_structures AS records
SET session_id = sessions.id
FROM academic_sessions AS sessions
WHERE sessions.school_id = records.school_id AND sessions.is_active = true;

UPDATE fee_payments AS records
SET session_id = sessions.id
FROM academic_sessions AS sessions
WHERE sessions.school_id = records.school_id AND sessions.is_active = true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE session_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill students.session_id: one or more schools has no active academic session';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_structures WHERE session_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill fee_structures.session_id: one or more schools has no active academic session';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_payments WHERE session_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill fee_payments.session_id: one or more schools has no active academic session';
  END IF;
  IF EXISTS (
    SELECT school_id, session_id, admission_no FROM students
    GROUP BY school_id, session_id, admission_no HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate student admission numbers exist within a school/session; resolve them before migration';
  END IF;
  IF EXISTS (
    SELECT school_id, receipt_no FROM fee_payments
    GROUP BY school_id, receipt_no HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate fee receipt numbers exist within a school; resolve them before migration';
  END IF;
  IF EXISTS (
    SELECT school_id, session_id, class FROM fee_structures
    GROUP BY school_id, session_id, class HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate fee structures exist within a school/session/class; resolve them before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_payments WHERE amount <= 0) THEN
    RAISE EXCEPTION 'Invalid fee payment amount exists; all payment amounts must be positive';
  END IF;
  IF EXISTS (SELECT 1 FROM fee_structures WHERE monthly_fee < 0 OR admission_fee < 0 OR exam_fee < 0 OR other_fee < 0) THEN
    RAISE EXCEPTION 'Invalid negative fee amount exists; resolve it before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM staff WHERE basic_salary < 0) THEN
    RAISE EXCEPTION 'Invalid negative staff salary exists; resolve it before migration';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM fee_payments AS payments
    JOIN students AS student_records ON student_records.id = payments.student_id
    WHERE student_records.school_id <> payments.school_id
  ) THEN
    RAISE EXCEPTION 'Fee payments reference a student from another school; resolve orphan or cross-school records before migration';
  END IF;
END $$;

ALTER TABLE students ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE fee_structures ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE fee_payments ALTER COLUMN session_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_session_school_fk') THEN
    ALTER TABLE students ADD CONSTRAINT students_session_school_fk FOREIGN KEY (session_id, school_id) REFERENCES academic_sessions(id, school_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_structures_session_school_fk') THEN
    ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_session_school_fk FOREIGN KEY (session_id, school_id) REFERENCES academic_sessions(id, school_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_session_school_fk') THEN
    ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_session_school_fk FOREIGN KEY (session_id, school_id) REFERENCES academic_sessions(id, school_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS students_id_school_unique ON students (id, school_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_student_school_fk') THEN
    ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_student_school_fk FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS students_school_session_admission_unique
  ON students (school_id, session_id, admission_no);
CREATE INDEX IF NOT EXISTS students_school_session_class_idx
  ON students (school_id, session_id, class, section);
CREATE INDEX IF NOT EXISTS students_admission_lookup_idx
  ON students (school_id, admission_no);

CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_school_session_class_unique
  ON fee_structures (school_id, session_id, class);
CREATE INDEX IF NOT EXISTS fee_structures_school_session_class_idx
  ON fee_structures (school_id, session_id, class);

CREATE UNIQUE INDEX IF NOT EXISTS fee_payments_school_receipt_unique
  ON fee_payments (school_id, receipt_no);
CREATE INDEX IF NOT EXISTS fee_payments_student_period_idx
  ON fee_payments (student_id, session_id, year, month);
CREATE INDEX IF NOT EXISTS fee_payments_school_period_idx
  ON fee_payments (school_id, session_id, payment_date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_structures_amounts_nonnegative') THEN
    ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_amounts_nonnegative CHECK (monthly_fee >= 0 AND admission_fee >= 0 AND exam_fee >= 0 AND other_fee >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_amount_positive') THEN
    ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_amount_positive CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_payments_year_valid') THEN
    ALTER TABLE fee_payments ADD CONSTRAINT fee_payments_year_valid CHECK (year BETWEEN 1900 AND 2200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_basic_salary_nonnegative') THEN
    ALTER TABLE staff ADD CONSTRAINT staff_basic_salary_nonnegative CHECK (basic_salary >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS staff_school_idx ON staff (school_id);
