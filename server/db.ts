import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from "@shared/schema";

// DATABASE_URL must be provided through the server environment.
// There is deliberately NO hardcoded fallback connection string:
// a connection string committed to source code is a leaked credential.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Configure it in the server environment before starting."
  );
}

const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });
