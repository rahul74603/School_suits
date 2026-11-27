import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { HardDriveDownload } from "lucide-react";

// 💾 Backup Card (v3.0) — Master App me Super Admin ki testing ke
// liye: school chuno → usi school ka backup banta hai (server
// ?schoolId= ke saath sirf wahi school deta hai, data mix nahi).
// School App me yehi kaam Settings ke Backup card se hota hai.
// File share sheet se Google Drive me save hoti hai — backup
// hamesha USER ke apne Drive me rehta hai.

interface SchoolLite {
  id: number;
  name: string;
}

export default function BackupCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [schools, setSchools] = useState<SchoolLite[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [lastAt, setLastAt] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      try {
        const data = await apiGet<SchoolLite[]>("/api/schools");
        setSchools(data ?? []);
        if (data && data.length > 0) setSchoolId(String(data[0].id));
      } catch {
        setSchools([]);
      }
    })();
  }, [isSuperAdmin]);

  const effectiveSchoolId = isSuperAdmin
    ? schoolId
      ? Number(schoolId)
      : null
    : (user?.schoolId ?? null);
  const storageKey = backupStorageKey(effectiveSchoolId);

  useEffect(() => {
    setLastAt(getLastBackupAt(storageKey));
  }, [storageKey]);

  const makeBackup = async () => {
    if (isSuperAdmin && effectiveSchoolId == null) {
      toast({
        title: "Pehle school chunein",
        description: "Backup sirf ek school ka banta hai — data mix nahi hota.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const path = isSuperAdmin
        ? `/api/export/school?schoolId=${effectiveSchoolId}`
        : "/api/export/school";
      const data = await apiGet<unknown>(path);
      const result = await shareOrDownloadBackup(
        data,
        backupFileName(effectiveSchoolId),
      );
      if (result === "cancelled") {
        toast({
          title: "Backup ruka",
          description: "Share band kar diya gaya — file save nahi hui.",
        });
        return;
      }
      setLastAt(markBackupDone(storageKey));
      toast({
        title: "✅ Backup taiyaar hai",
        description:
          result === "shared"
            ? "Share sheet me Google Drive chunein — backup aapke apne Drive me save hoga."
            : "Backup file download ho gayi — use apne Google Drive me upload karke sambhal lein.",
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

  const due = isBackupDue(lastAt, new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDriveDownload className="h-5 w-5" />
          Backup — Google Drive me
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          School ka poora data ek file me banta hai.{" "}
          <b>"Backup banao"</b> dabane par phone ka share sheet
          khulega — wahan <b>Google Drive</b> chunein, backup aapke
          apne Drive me save ho jayega. (Account/password backup me
          kabhi nahi hote.)
        </p>
        {isSuperAdmin && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Kis school ka backup?</p>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger>
                <SelectValue placeholder="School chunein" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((school) => (
                  <SelectItem key={school.id} value={String(school.id)}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Backup sirf chune hue school ka banta hai — dusre
              school ka data isme nahi aata.
            </p>
          </div>
        )}
        <p className="text-sm">
          Aakhri backup:{" "}
          <b>
            {lastAt
              ? new Date(lastAt).toLocaleString("hi-IN")
              : "abhi tak koi backup nahi (is phone par)"}
          </b>
          {due && (
            <span className="ml-2 font-medium text-amber-700">
              — Backup due hai!
            </span>
          )}
        </p>
        <Button onClick={makeBackup} disabled={busy} className="gap-2">
          <HardDriveDownload className="h-4 w-4" />
          {busy ? "Backup ban raha hai…" : "Backup banao — Drive me save karein"}
        </Button>
      </CardContent>
    </Card>
  );
}
