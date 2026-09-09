CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) THEN
    UPDATE users
    SET password_hash = crypt(password, gen_salt('bf', 12))
    WHERE password_hash IS NULL AND password IS NOT NULL;

    ALTER TABLE users DROP COLUMN password;
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);
