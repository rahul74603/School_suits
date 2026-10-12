-- Step 16: Complete School ERP Modules (Notices, Homework, Timetable, Leave Requests, Certificates, Transport)

CREATE TABLE IF NOT EXISTS "notices" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "target_audience" text NOT NULL DEFAULT 'all',
  "target_class" text,
  "target_section" text,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "publish_date" date NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "notices_category_check" CHECK ("category" IN ('general', 'academic', 'exam', 'holiday', 'event', 'emergency')),
  CONSTRAINT "notices_audience_check" CHECK ("target_audience" IN ('all', 'students', 'teachers', 'staff', 'class')),
  CONSTRAINT "notices_creator_school_fk" FOREIGN KEY ("created_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "notices_school_active_idx"
  ON "notices" ("school_id", "is_active", "is_pinned", "publish_date");

CREATE TABLE IF NOT EXISTS "homework_assignments" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  "subject_id" integer NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "assigned_date" date NOT NULL,
  "due_date" date NOT NULL,
  "assigned_by_user_id" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "homework_status_check" CHECK ("status" IN ('active', 'archived')),
  CONSTRAINT "homework_date_order_check" CHECK ("due_date" >= "assigned_date"),
  CONSTRAINT "homework_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "homework_subject_scope_fk" FOREIGN KEY ("subject_id", "school_id", "session_id") REFERENCES "subjects"("id", "school_id", "session_id") ON DELETE RESTRICT,
  CONSTRAINT "homework_teacher_school_fk" FOREIGN KEY ("assigned_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "homework_class_due_idx"
  ON "homework_assignments" ("school_id", "session_id", "class_name", "section", "due_date");

CREATE TABLE IF NOT EXISTS "timetable_entries" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "class_name" text NOT NULL,
  "section" text NOT NULL,
  "day_of_week" text NOT NULL,
  "period_no" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "subject_id" integer NOT NULL,
  "teacher_user_id" integer,
  "room_no" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "timetable_day_check" CHECK ("day_of_week" IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
  CONSTRAINT "timetable_period_check" CHECK ("period_no" BETWEEN 1 AND 12),
  CONSTRAINT "timetable_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "timetable_subject_scope_fk" FOREIGN KEY ("subject_id", "school_id", "session_id") REFERENCES "subjects"("id", "school_id", "session_id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "timetable_class_slot_unique"
  ON "timetable_entries" ("school_id", "session_id", "class_name", "section", "day_of_week", "period_no");

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "applicant_type" text NOT NULL,
  "student_id" integer,
  "user_id" integer NOT NULL,
  "applicant_name" text NOT NULL,
  "class_name" text,
  "section" text,
  "leave_type" text NOT NULL DEFAULT 'sick',
  "from_date" date NOT NULL,
  "to_date" date NOT NULL,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by_user_id" integer,
  "review_remarks" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "leave_requests_applicant_type_check" CHECK ("applicant_type" IN ('student', 'staff')),
  CONSTRAINT "leave_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "leave_requests_date_order_check" CHECK ("to_date" >= "from_date"),
  CONSTRAINT "leave_requests_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "leave_requests_user_school_fk" FOREIGN KEY ("user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "leave_requests_school_session_idx"
  ON "leave_requests" ("school_id", "session_id", "status", "from_date");

CREATE TABLE IF NOT EXISTS "certificates" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "student_id" integer NOT NULL,
  "certificate_type" text NOT NULL,
  "certificate_no" text NOT NULL,
  "issue_date" date NOT NULL,
  "reason" text,
  "conduct" text DEFAULT 'Good',
  "remarks" text,
  "issued_by_user_id" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'issued',
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "certificates_type_check" CHECK ("certificate_type" IN ('transfer', 'bonafide', 'character', 'fee')),
  CONSTRAINT "certificates_status_check" CHECK ("status" IN ('issued', 'revoked')),
  CONSTRAINT "certificates_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "certificates_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "certificates_issuer_school_fk" FOREIGN KEY ("issued_by_user_id", "school_id") REFERENCES "users"("id", "school_id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_school_cert_no_unique"
  ON "certificates" ("school_id", "certificate_no");

CREATE INDEX IF NOT EXISTS "certificates_school_student_idx"
  ON "certificates" ("school_id", "session_id", "student_id");

CREATE TABLE IF NOT EXISTS "transport_routes" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "route_name" text NOT NULL,
  "vehicle_no" text NOT NULL,
  "driver_name" text NOT NULL,
  "driver_contact" text NOT NULL,
  "stops" text NOT NULL,
  "monthly_fee" integer NOT NULL DEFAULT 0,
  "capacity" integer NOT NULL DEFAULT 40,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "transport_routes_fee_nonnegative" CHECK ("monthly_fee" >= 0 AND "capacity" > 0),
  CONSTRAINT "transport_routes_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_id_scope_unique"
  ON "transport_routes" ("id", "school_id", "session_id");

CREATE UNIQUE INDEX IF NOT EXISTS "transport_routes_school_session_name_unique"
  ON "transport_routes" ("school_id", "session_id", "route_name");

CREATE TABLE IF NOT EXISTS "student_transport_allocations" (
  "id" serial PRIMARY KEY,
  "school_id" integer NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "session_id" integer NOT NULL REFERENCES "academic_sessions"("id") ON DELETE RESTRICT,
  "student_id" integer NOT NULL,
  "route_id" integer NOT NULL,
  "stop_name" text NOT NULL,
  "monthly_fee" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "student_transport_route_scope_fk" FOREIGN KEY ("route_id", "school_id", "session_id") REFERENCES "transport_routes"("id", "school_id", "session_id") ON DELETE RESTRICT,
  CONSTRAINT "student_transport_student_school_fk" FOREIGN KEY ("student_id", "school_id") REFERENCES "students"("id", "school_id") ON DELETE RESTRICT,
  CONSTRAINT "student_transport_session_school_fk" FOREIGN KEY ("session_id", "school_id") REFERENCES "academic_sessions"("id", "school_id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_transport_student_session_unique"
  ON "student_transport_allocations" ("school_id", "session_id", "student_id");
