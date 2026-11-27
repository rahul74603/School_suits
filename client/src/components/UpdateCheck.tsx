import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { APP_FLAVOR, APP_VERSION_CODE } from "@/lib/appVersion";
import { shouldPromptUpdate } from "@/lib/updateLogic";
import { Download } from "lucide-react";

// 🔄 Update Check (v3.0) — teeno apps (School/Parent/Master) ke har
// shell me ek baar mount hota hai. Server se apne app ka latest
// version poochta hai (GET /api/app-version — public, sirf version
// jaankari, kisi school ka data nahi). Server code apne code se
// bada ho to sandesh: [Update karo] APK link kholta hai — wahi
// signing key hone se naya version purane ke UPAR install hota
// hai, data nahi jata.
// Staged rollout server par hai: school/parent ko update tabhi
// dikhta hai jab Master ne use 'released' kiya ho (testing wala
// sirf Master ke paas rehta hai).
// "Baad me" = is version ke liye snooze (localStorage); mandatory
// update me "Baad me" hai hi nahi — band karna bhi nahi banta.

interface AppVersionResponse {
  app: string;
  versionName: string | null;
  versionCode: number;
  apkUrl: string | null;
  notes: string | null;
  mandatory: number;
  stage: string;
}

const snoozeKey = () => `sgs_update_snooze_${APP_FLAVOR}`;

export default function UpdateCheck() {
  const [update, setUpdate] = useState<AppVersionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<AppVersionResponse>(
          `/api/app-version?app=${APP_FLAVOR}`,
        );
        if (cancelled || !data) return;
        let snoozed: number | null = null;
        try {
          const raw = window.localStorage.getItem(snoozeKey());
          snoozed = raw ? Number(raw) : null;
          if (snoozed != null && Number.isNaN(snoozed)) snoozed = null;
        } catch {
          snoozed = null;
        }
        if (
          shouldPromptUpdate({
            serverCode: data.versionCode,
            ownCode: APP_VERSION_CODE,
            mandatory: data.mandatory === 1,
            snoozedCode: snoozed,
          })
        ) {
          setUpdate(data);
        }
      } catch {
        // Update check fail ho to app chup chaap chalta rehta hai —
        // ye kabhi kaam rokne wali cheez nahi hai.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;
  const mandatory = update.mandatory === 1;

  const doUpdate = () => {
    if (update.apkUrl) {
      // APK phone ke browser me download hota hai aur wahi key
      // hone se purani app ke upar install ho jata hai.
      window.open(update.apkUrl, "_blank");
    }
    if (!mandatory) setUpdate(null);
  };

  const snooze = () => {
    try {
      window.localStorage.setItem(snoozeKey(), String(update.versionCode));
    } catch {
      // localStorage na mile to bhi band kar do (is session ke liye).
    }
    setUpdate(null);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Mandatory update band nahi hota; aam update bhi sirf
        // "Baad me" se band hoga (snooze yaad rahe).
        if (!open && !mandatory) snooze();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            🎉 Naya version {update.versionName ?? ""} aa gaya hai
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {update.notes ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {update.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              App ka naya version taiyaar hai. Update karne se aapka
              data bilkul surakshit rahega — naya version purane ke
              upar hi install hota hai.
            </p>
          )}
          {mandatory && (
            <p className="text-sm font-medium text-red-700">
              Ye update zaroori hai — kripya abhi update karein.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={doUpdate} className="gap-2">
              <Download className="h-4 w-4" />
              Update karo
            </Button>
            {!mandatory && (
              <Button variant="outline" onClick={snooze}>
                Baad me
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
