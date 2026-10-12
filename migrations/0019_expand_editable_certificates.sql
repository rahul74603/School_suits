-- Step 20: Expand Official School Certificates (8 Types) and Editable Certificate Fields

ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_type_check";

ALTER TABLE "certificates"
  ADD CONSTRAINT "certificates_type_check"
  CHECK ("certificate_type" IN ('transfer', 'bonafide', 'character', 'fee', 'dob', 'migration', 'passing', 'sports'));

ALTER TABLE "certificates"
  ADD COLUMN IF NOT EXISTS "promoted_to_class" text,
  ADD COLUMN IF NOT EXISTS "dues_status" text DEFAULT 'No Dues Pending',
  ADD COLUMN IF NOT EXISTS "last_attendance_date" date,
  ADD COLUMN IF NOT EXISTS "custom_body" text;
