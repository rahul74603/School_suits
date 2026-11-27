import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { RefreshCw, School, ScrollText } from "lucide-react";

// 📜 Audit Log (v3.3) — school me kisne, kab, kya badla — iska
// record. Sirf Principal dekhta hai (sidebar link bhi sirf usi ko
// dikhta hai; page khud bhi role jaanchta hai).
// API: GET /api/audit-logs — jawab ke field-naam lachile rakhe
// hain (actor/action/details ke aam badlav), jo aayega wahi
// saaf karke dikhega.

interface AuditRow {
  id: number | string;
  actor: string;
  role: string;
  action: string;
  detail: string;
  timeText: string;
}

function adaptEntry(l: any, idx: number): AuditRow {
  const when = l?.createdAt ?? l?.timestamp ?? l?.time ?? "";
  return {
    id: l?.id ?? idx,
    actor:
      l?.userName ?? l?.actor ?? l?.username ?? l?.user?.name ?? "—",
    role: l?.userRole ?? l?.role ?? l?.user?.role ?? "",
    action: l?.action ?? l?.event ?? "—",
    detail:
      l?.details ?? l?.description ?? l?.entity ?? l?.summary ?? "",
    timeText: when
      ? new Date(when).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
  };
}

export default function AuditLog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPrincipal = user?.role === "principal";
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isPrincipal) return;
    setLoading(true);
    try {
      const data = await apiGet<any>("/api/audit-logs?limit=200");
      const list = Array.isArray(data) ? data : (data?.logs ?? data?.entries ?? []);
      setEntries(list.map(adaptEntry));
    } catch (e: any) {
      toast({
        title: "Audit log load nahi hua",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
      setEntries([]);
    }
    setLoading(false);
  }, [isPrincipal, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isPrincipal) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> Audit Log sirf Principal ke
              liye hai
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Kisne kab kya badla — ye record sirf school ke Principal
              ko dikhta hai, taaki galti ya gadbad par nazar rakhi ja
              sake. Aapke role par ye page uplabdh nahi hai.
            </p>
            <Link href="/">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Dashboard par jayein
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
            <ScrollText className="h-8 w-8 text-slate-600" /> Audit Log —
            Kisne Kya Badla
          </h1>
          <p className="text-gray-500 mt-1">
            School ke data me hue badlavon ka record (sabse naya pehle)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading && entries.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Load ho raha hai…
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              Abhi koi record nahi hai — jaise-jaise school me badlav
              honge, yahan dikhne lagenge.
            </p>
          ) : (
            <div className="divide-y">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="py-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3"
                >
                  <div className="shrink-0 sm:w-40">
                    <p className="text-sm font-medium break-words">
                      {e.actor}
                    </p>
                    {e.role && (
                      <Badge variant="outline" className="mt-0.5">
                        {e.role}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 break-words">
                      {e.action}
                    </p>
                    {e.detail && (
                      <p className="text-sm text-gray-600 break-words">
                        {e.detail}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-gray-400 sm:text-right">
                    {e.timeText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-400">
        Ye record sirf dekhne ke liye hai — yahan se kuch badla ya
        mitaya nahi ja sakta.
      </p>
    </div>
  );
}
