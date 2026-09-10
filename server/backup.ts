import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);
const MAX_BACKUP_BYTES = Number(process.env.BACKUP_MAX_BYTES || 1024 * 1024 * 1024);
export const backupDirectory = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
export let restoreInProgress = false;

export function newBackupKey(): string { return `backup-${randomUUID()}.dump`; }
export function safeBackupPath(storageKey: string): string {
  if (!/^backup-[0-9a-f-]{36}\.dump$/.test(storageKey)) throw new Error("Invalid backup identifier");
  const resolved = path.resolve(backupDirectory, storageKey);
  if (path.dirname(resolved) !== backupDirectory) throw new Error("Invalid backup identifier");
  return resolved;
}
export async function createNativeDump(storageKey: string): Promise<number> {
  const output = safeBackupPath(storageKey); await mkdir(backupDirectory, { recursive: true });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  try { await execFileAsync("pg_dump", ["--format=custom", "--no-owner", "--file", output, process.env.DATABASE_URL], { timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 }); }
  catch (error: any) { await unlink(output).catch(() => undefined); if (error?.code === "ENOENT") throw new Error("PostgreSQL pg_dump is not installed"); throw new Error("PostgreSQL backup command failed"); }
  const size = (await stat(output)).size; if (size <= 0 || size > MAX_BACKUP_BYTES) { await unlink(output).catch(() => undefined); throw new Error("Backup exceeds the configured size limit"); } return size;
}
export async function restoreNativeDump(storageKey: string): Promise<void> {
  const input = safeBackupPath(storageKey); const info = await stat(input).catch(() => undefined); if (!info || info.size <= 0 || info.size > MAX_BACKUP_BYTES) throw new Error("Backup file is missing or invalid");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (restoreInProgress) throw new Error("Another restore is already in progress"); restoreInProgress = true;
  try { await execFileAsync("pg_restore", ["--clean", "--if-exists", "--no-owner", "--exit-on-error", "--dbname", process.env.DATABASE_URL, input], { timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 }); }
  catch (error: any) { if (error?.code === "ENOENT") throw new Error("PostgreSQL pg_restore is not installed"); throw new Error("PostgreSQL restore command failed"); }
  finally { restoreInProgress = false; }
}
export async function removeBackup(storageKey: string): Promise<void> { await unlink(safeBackupPath(storageKey)).catch(() => undefined); }
