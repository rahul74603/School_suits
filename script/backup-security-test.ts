import assert from "node:assert/strict";
import { newBackupKey, safeBackupPath } from "../server/backup";
const key = newBackupKey();
assert.match(key, /^backup-[0-9a-f-]{36}\.dump$/);
assert.equal(safeBackupPath(key).endsWith(key), true);
for (const value of ["../../etc/passwd", "/tmp/backup.dump", "backup-evil.dump", "backup-00000000-0000-0000-0000-000000000000.sql"]) assert.throws(() => safeBackupPath(value));
assert.equal(JSON.stringify({ key }).includes("DATABASE_URL"), false);
console.log("Backup security foundation tests passed.");
