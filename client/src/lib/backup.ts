// 💾 Backup helpers (v3.0) — ek-tap Google Drive backup.
// IMAANDARI WALA NOTE: Server se seedha user ke Drive me khamoshi
// se upload karne ke liye Google Cloud OAuth project chahiye jo
// sirf account-malik (user) bana sakta hai — wo is batch me NAHI
// hai. Jo hai wo ye hai: backup file banti hai, phone ka share
// sheet khulta hai, user wahan "Google Drive" chunta hai — file
// USKE APNE Drive me save hoti hai. Koi nakli "connected" halat
// kabhi nahi dikhayi jati.

export function backupStorageKey(schoolId?: number | null): string {
  return schoolId != null
    ? `sgs_last_backup_at_${schoolId}`
    : "sgs_last_backup_at";
}

export function getLastBackupAt(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function markBackupDone(key: string): string {
  const now = new Date().toISOString();
  try {
    window.localStorage.setItem(key, now);
  } catch {
    // localStorage na mile to bhi backup to ho gaya — yaad sirf
    // isi phone par rehti hai, koi nuksan nahi.
  }
  return now;
}

// Backup file ko share sheet (Drive) se bhejo; share na mile to
// seedha download. User share beech me band kar de to "cancelled".
export async function shareOrDownloadBackup(
  data: unknown,
  filename: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const text = JSON.stringify(data, null, 2);
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  try {
    const file = new File([text], filename, { type: "application/json" });
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "School Backup" });
        return "shared";
      } catch {
        return "cancelled";
      }
    }
  } catch {
    // File/share API na mile to download wala rasta neeche hai.
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

export function backupFileName(schoolId?: number | null): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return schoolId != null
    ? `school-backup-${schoolId}-${stamp}.json`
    : `school-backup-${stamp}.json`;
}
