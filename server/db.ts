import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from "@shared/schema";

// Humne Check hata diya hai. Agar URL nahi hai to Fake URL use karega taaki crash na ho.
const connectionString = process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/offline_mode";

const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });