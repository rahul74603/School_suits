import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPut } from "@/lib/api";
import { Rocket, FlaskConical, Send } from "lucide-react";

// 📲 App Update (v3.0) — Master App se teeno apps ke update ka
// control. Server (app_versions) me SIRF version jaankari rehti
// hai — kisi school ka data isse kabhi nahi jata.
//
// Chal (staged rollout, user ka design):
//  1. Pehle [Publish — Testing]: update sirf Master ke paas
//     rehta hai, user khud naya version laga kar check karta hai.
//  2. Pasand aaye to USI app ka [Sirf … ko bhejo] — School aur
//     Parents ke stage bilkul alag hain; ek ko bhejne se dusra
//     nahi jata (parents ko be-wajah pareshan nahi karte).
//  3. Dono par asar ho to [✅ Dono Apps ko bhejo (Push to All)].
// Master app ki apni row seedha released hoti hai (wo user ki
// apni app hai).

type AppKey = "school" | "parent" | "master";

interface AppVersionResponse {
  app: string;
  versionName: string | null;
  versionCode: number;
  apkUrl: string | null;
  notes: string | null;
  mandatory: number;
  stage: string; // 'testing' | 'released' | 'none'
}

interface RowState {
  versionName: string;
  versionCode: string;
  apkUrl: string;
  notes: string;
  mandatory: boolean;
  stage: string;
}

const RELEASE_BASE =
  "https://github.com/rahul74603/School_suits/releases/download/v3.0";

const APPS: Array<{ key: AppKey; label: string; defaultApk: string }> = [
  {
    key: "school",
    label: "School App",
    defaultApk: `${RELEASE_BASE}/school-guardian-suite-v3.0.apk`,
  },
  {
    key: "parent",
    label: "Parents App",
    defaultApk: `${RELEASE_BASE}/school-guardian-parent-v3.0.apk`,
  },
  {
    key: "master",
    label: "Master App (tumhari)",
    defaultApk: `${RELEASE_BASE}/school-guardian-master-v3.0.apk`,
  },
];

function emptyRow(defaultApk: string): RowState {
  return {
    versionName: "3.0",
    versionCode: "14",
    apkUrl: defaultApk,
    notes: "",
    mandatory: false,
    stage: "none",
  };
}

function stageBadge(stage: string) {
  if (stage === "released") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        ✅ Sab ko gaya hua
      </Badge>
    );
  }
  if (stage === "testing") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        🧪 Testing me hai (sirf tumhare paas)
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">Abhi koi update nahi bheja</Badge>
  );
}

export default function AppUpdateCard() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<AppKey, RowState>>({
    school: emptyRow(APPS[0].defaultApk),
    parent: emptyRow(APPS[1].defaultApk),
    master: emptyRow(APPS[2].defaultApk),
  });
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const next = {} as Record<AppKey, RowState>;
    for (const app of APPS) {
      try {
        const data = await apiGet<AppVersionResponse>(
          `/api/app-version?app=${app.key}`,
        );
        if (data && data.stage !== "none" && data.versionCode > 0) {
          next[app.key] = {
            versionName: data.versionName ?? "",
            versionCode: String(data.versionCode),
            apkUrl: data.apkUrl ?? app.defaultApk,
            notes: data.notes ?? "",
            mandatory: data.mandatory === 1,
            stage: data.stage,
          };
        } else {
          next[app.key] = { ...emptyRow(app.defaultApk), stage: data?.stage ?? "none" };
        }
      } catch {
        next[app.key] = emptyRow(app.defaultApk);
      }
    }
    setRows(next);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: AppKey, field: keyof RowState, value: string | boolean) => {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const publish = async (key: AppKey, stage: "testing" | "released") => {
    const row = rows[key];
    const code = Number(row.versionCode);
    if (!row.versionName.trim() || !Number.isInteger(code) || code <= 0) {
      toast({
        title: "Version naam/code theek bharein",
        description: "Version code ek number hona chahiye (jaise 14).",
        variant: "destructive",
      });
      return false;
    }
    if (!row.apkUrl.trim()) {
      toast({
        title: "APK link khaali hai",
        description: "Bina link ke update khulega hi nahi.",
        variant: "destructive",
      });
      return false;
    }
    setBusy(`${key}-${stage}`);
    try {
      const saved = await apiPut<AppVersionResponse>(`/api/app-version/${key}`, {
        versionName: row.versionName.trim(),
        versionCode: code,
        apkUrl: row.apkUrl.trim(),
        notes: row.notes.trim() || null,
        mandatory: row.mandatory,
        stage,
      });
      setRows((prev) => ({
        ...prev,
        [key]: { ...prev[key], stage: saved?.stage ?? stage },
      }));
      toast({
        title:
          stage === "released"
            ? "🚀 Update bhej diya gaya"
            : "🧪 Testing me daal diya",
        description:
          stage === "released"
            ? `${APPS.find((a) => a.key === key)?.label} ke sab users ko update dikhega.`
            : "Ye update abhi sirf tumhare paas hai — check karke phir sab ko bhejo.",
      });
      return true;
    } catch (error) {
      toast({
        title: "Update publish nahi ho paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const pushToAll = async () => {
    setBusy("all");
    try {
      const okSchool = await publish("school", "released");
      const okParent = await publish("parent", "released");
      if (okSchool && okParent) {
        toast({
          title: "✅ Dono apps ko update gaya",
          description: "School aur Parents — dono apps ko naya version milega.",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          App Update bhejo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Pehle update <b>Testing</b> me daalo aur khud check karo.
          Pasand aaye to usi app ko bhejo — School aur Parents bilkul
          alag-alag hain. Update me sirf version ki jaankari jati
          hai, kisi school ka data kabhi nahi.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {APPS.map((app) => {
          const row = rows[app.key];
          const isMaster = app.key === "master";
          return (
            <div
              key={app.key}
              className="space-y-3 rounded-lg border p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{app.label}</span>
                {stageBadge(row.stage)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Version naam</Label>
                  <Input
                    value={row.versionName}
                    onChange={(e) => setField(app.key, "versionName", e.target.value)}
                    placeholder="3.0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Version code (number)</Label>
                  <Input
                    type="number"
                    value={row.versionCode}
                    onChange={(e) => setField(app.key, "versionCode", e.target.value)}
                    placeholder="14"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>APK download link</Label>
                <Input
                  value={row.apkUrl}
                  onChange={(e) => setField(app.key, "apkUrl", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes (users ko dikhega — kya naya hai)</Label>
                <Textarea
                  value={row.notes}
                  onChange={(e) => setField(app.key, "notes", e.target.value)}
                  rows={2}
                  placeholder="Jaise: Homework aur Chutti ki suvidha aayi hai"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`mandatory-${app.key}`}>
                  Zaroori update (mandatory — "Baad me" nahi milega)
                </Label>
                <Switch
                  id={`mandatory-${app.key}`}
                  checked={row.mandatory}
                  onCheckedChange={(checked) =>
                    setField(app.key, "mandatory", checked)
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {!isMaster && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={busy != null}
                    onClick={() => publish(app.key, "testing")}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Publish — Testing (sirf mere paas)
                  </Button>
                )}
                <Button
                  className="gap-2"
                  disabled={busy != null}
                  onClick={() => publish(app.key, "released")}
                >
                  <Send className="h-4 w-4" />
                  {isMaster
                    ? "Master App ko bhejo"
                    : app.key === "school"
                      ? "Sirf School App ko bhejo"
                      : "Sirf Parents App ko bhejo"}
                </Button>
              </div>
            </div>
          );
        })}

        <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Dono apps me ek saath badlav ho (jaise server wala update)
            to ek hi baar me dono ko bhej do:
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full gap-2" disabled={busy != null}>
                <Rocket className="h-4 w-4" />
                ✅ Dono Apps ko bhejo (Push to All)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Sab ko update bhej dein?</AlertDialogTitle>
                <AlertDialogDescription>
                  School App aur Parents App — dono ke sab users ko
                  naya version dikhne lagega. Master App isme shamil
                  nahi hai. Kisi school ka data kahin nahi jata — sirf
                  version ki jaankari jati hai.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Ruko</AlertDialogCancel>
                <AlertDialogAction onClick={pushToAll}>
                  Haan, dono ko bhejo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
