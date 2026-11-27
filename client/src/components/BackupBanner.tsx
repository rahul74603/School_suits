import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  backupFileName,
  backupStorageKey,
  getLastBackupAt,
  markBackupDone,
  shareOrDownloadBackup,
} from "@/lib/backup";
import { isBackupDue } from "@/lib/updateLogic";
import { HardDriveDownload, X } from "lucide-react";

// 💾 Backup Banner (v3.0) — School App khulne par halki si yaad:
// aakhri backup 24 ghante se purana ho (ya kabhi hua hi na ho) to
// upar ek patti dikhti hai — ek tap me wahi Drive-wala backup.
// Sirf Principal ko (backup endpoint bhi sirf unhi ke liye hai).
// Band karne par is baar ke liye chhup jati hai; agli baar app
// khulne par due ho to phir dikhegi.
export default function BackupBanner() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!user || user.role !== "principal") return null;
  if (dismissed || done) return null;

  const storageKey = backupStorageKey(user.schoolId ?? null);
  if (!isBackupDue(getLastBackupAt(storageKey), new Date())) return null;

  const makeBackup = async () => {
    setBusy(true);
    try {
      const data = await apiGet<unknown>("/api/export/school");
      const result = await shareOrDownloadBackup(
        data,
        backupFileName(user.schoolId ?? null),
      );
      if (result === "cancelled") return;
      markBackupDone(storageKey);
      setDone(true);
      toast({
        title: "✅ Backup taiyaar hai",
        description:
          result === "shared"
            ? "Share sheet me Google Drive chunein — backup aapke Drive me save hoga."
            : "Backup file download ho gayi — use Google Drive me sambhal lein.",
      });
    } catch (error) {
      toast({
        title: "Backup nahi ban paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
      <HardDriveDownload className="h-4 w-4 shrink-0" />
      <span className="text-sm">
        <b>Backup due hai</b> — school ke data ka backup 24 ghante se
        nahi hua. Ek tap me apne Google Drive me save karein.
      </span>
      <Button
        size="sm"
        onClick={makeBackup}
        disabled={busy}
        className="bg-amber-600 hover:bg-amber-700"
      >
        {busy ? "Ban raha hai…" : "Backup banao"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDismissed(true)}
        aria-label="Band karein"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
