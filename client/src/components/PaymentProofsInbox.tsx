import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPatch } from "@/lib/api";
import {
  CheckCircle2,
  Image as ImageIcon,
  ImageOff,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// 🧾 Payment Proofs Inbox (v3.3) — Parents App se aaye UPI payment
// screenshots yahan jama hote hain. Office har proof dekh kar
// Approve (asal payment ban jata hai — server PATCH decision par
// payment record khud banata hai) ya Reject karta hai.
// API (server contract, v3.3):
//   GET   /api/payment-proofs?status=pending|approved|rejected
//         (list me tasveer NAHI aati — sirf hasImage flag)
//   GET   /api/payment-proofs/:id  (ek proof, tasveer ke saath —
//         viewer khulne par yahi se aati hai, merge fix v3.3)
//   PATCH /api/payment-proofs/:id/decision { decision, status }
// Jawab ke field-naam lachile rakhe hain (studentName/class/amount/
// date/screenshot ke aam badlav) taaki server ke chhote naam-fark
// par screen na tute — asal rakam/naam jo aayega wahi dikhega.

type ProofStatus = "pending" | "approved" | "rejected";

interface ProofRow {
  id: number;
  studentName: string;
  classText: string;
  amount: number | null;
  dateText: string;
  note: string;
  imageSrc: string;
  hasImage: boolean;
  status: ProofStatus;
  raw: any;
}

function proofImageSrc(p: any): string {
  const raw =
    p?.screenshotData ?? p?.screenshot ?? p?.imageData ?? p?.image ?? "";
  if (!raw || typeof raw !== "string") return "";
  if (raw.startsWith("data:")) return raw;
  const mime = p?.screenshotMime ?? p?.mimeType ?? "image/jpeg";
  return `data:${mime};base64,${raw}`;
}

function adaptProof(p: any): ProofRow {
  const status: ProofStatus =
    p?.status === "approved" || p?.status === "rejected" ? p.status : "pending";
  const classPart = p?.className ?? p?.studentClass ?? p?.class ?? "";
  const sectionPart = p?.section ?? p?.studentSection ?? "";
  const dateRaw = p?.paymentDate ?? p?.date ?? p?.createdAt ?? "";
  return {
    id: p?.id,
    studentName: p?.studentName ?? p?.student?.name ?? "—",
    classText: classPart
      ? `Class ${classPart}${sectionPart ? `-${sectionPart}` : ""}`
      : "",
    amount:
      p?.amount != null && Number.isFinite(Number(p.amount))
        ? Number(p.amount)
        : null,
    dateText: dateRaw
      ? new Date(dateRaw).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
    note: p?.txnRef ?? p?.utr ?? p?.reference ?? p?.note ?? p?.remarks ?? "",
    imageSrc: proofImageSrc(p),
    hasImage: !!(p?.hasImage ?? proofImageSrc(p)),
    status,
    raw: p,
  };
}

const STATUS_TABS: Array<{ key: ProofStatus; label: string }> = [
  { key: "pending", label: "Pending ⏳" },
  { key: "approved", label: "Approved ✅" },
  { key: "rejected", label: "Rejected ❌" },
];

export default function PaymentProofsInbox({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ProofStatus>("pending");
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  // v1.3 wala photo viewer pattern — screenshot bada karke dekhna.
  const [viewer, setViewer] = useState<{ src: string; title: string } | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [viewerBusyId, setViewerBusyId] = useState<number | null>(null);

  // List me tasveer nahi aati (bhaari hai) — viewer khulne par ek
  // proof alag se laakar (GET /:id) uski tasveer dikhao. List row
  // me tasveer pehle se ho (purana jawab) to wahi chalegi.
  const openViewer = async (proof: ProofRow) => {
    if (proof.imageSrc) {
      setZoom(1);
      setViewer({
        src: proof.imageSrc,
        title: `${proof.studentName} — Payment Screenshot`,
      });
      return;
    }
    setViewerBusyId(proof.id);
    try {
      const full = await apiGet<any>(`/api/payment-proofs/${proof.id}`);
      const src = proofImageSrc(full);
      if (src) {
        setProofs((prev) =>
          prev.map((p) => (p.id === proof.id ? { ...p, imageSrc: src } : p)),
        );
        setZoom(1);
        setViewer({
          src,
          title: `${proof.studentName} — Payment Screenshot`,
        });
      } else {
        toast({
          title: "Screenshot nahi mila",
          description: "Is proof ke saath koi photo nahi aayi hai.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Screenshot load nahi hua",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setViewerBusyId(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>(
        `/api/payment-proofs?status=${tab}`,
      );
      setProofs((data || []).map(adaptProof));
    } catch (e: any) {
      toast({
        title: "Payment proofs load nahi hue",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
      setProofs([]);
    }
    setLoading(false);
  }, [tab, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const decide = async (proof: ProofRow, decision: "approved" | "rejected") => {
    setBusyId(proof.id);
    try {
      // Dono key bhejte hain (decision + status) — server jo
      // chahta hai wahi lega, baaki strip ho jayega.
      await apiPatch(`/api/payment-proofs/${proof.id}/decision`, {
        decision,
        status: decision,
      });
      toast({
        title:
          decision === "approved"
            ? "✅ Proof approved — payment ban gaya"
            : "Proof reject ho gaya",
        description: `${proof.studentName}${
          proof.amount != null ? ` • ₹${proof.amount.toLocaleString()}` : ""
        }`,
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Faisla save nahi ho paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setBusyId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Inbox className="h-5 w-5 text-green-600" /> Payment Proofs —
              Parents ke UPI Screenshots
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "outline"}
                className={tab === t.key ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 space-y-3 pr-1">
            {loading ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                Load ho raha hai…
              </p>
            ) : proofs.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                {tab === "pending"
                  ? "Koi pending proof nahi hai — parents screenshot bhejenge to yahan aayega."
                  : "Is hisse me koi record nahi hai."}
              </p>
            ) : (
              proofs.map((proof) => (
                <div
                  key={proof.id}
                  className="flex flex-wrap gap-3 border rounded-lg p-3 bg-white"
                >
                  {proof.imageSrc ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md overflow-hidden border focus:outline-none focus:ring-2 focus:ring-green-500"
                      onClick={() => void openViewer(proof)}
                      title="Bada karke dekhein"
                    >
                      <img
                        src={proof.imageSrc}
                        alt={`${proof.studentName} ka payment screenshot`}
                        className="h-24 w-20 object-cover"
                      />
                    </button>
                  ) : proof.hasImage ? (
                    <button
                      type="button"
                      className="shrink-0 h-24 w-20 rounded-md border bg-slate-50 flex flex-col items-center justify-center text-gray-500 gap-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                      onClick={() => void openViewer(proof)}
                      disabled={viewerBusyId === proof.id}
                      title="Screenshot bade me dekhein"
                    >
                      {viewerBusyId === proof.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ImageIcon className="h-5 w-5" />
                      )}
                      <span className="text-[10px]">Screenshot dekhein</span>
                    </button>
                  ) : (
                    <div className="shrink-0 h-24 w-20 rounded-md border bg-slate-50 flex flex-col items-center justify-center text-gray-400 gap-1">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[10px]">No photo</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-[180px] space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800 break-words">
                        {proof.studentName}
                      </span>
                      {proof.classText && (
                        <Badge variant="outline">{proof.classText}</Badge>
                      )}
                      <Badge
                        className={
                          proof.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : proof.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }
                      >
                        {proof.status === "approved"
                          ? "Approved"
                          : proof.status === "rejected"
                            ? "Rejected"
                            : "Pending"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Rakam:{" "}
                      <b className="text-slate-800">
                        {proof.amount != null
                          ? `₹${proof.amount.toLocaleString()}`
                          : "—"}
                      </b>
                      {proof.dateText ? ` • Tareekh: ${proof.dateText}` : ""}
                    </p>
                    {proof.note && (
                      <p className="text-xs text-gray-500 break-words">
                        UTR/Note: {proof.note}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400">
                      Screenshot par tap karke bada dekhein — rakam aur
                      naam mila kar hi faisla lein.
                    </p>
                  </div>

                  {proof.status === "pending" && (
                    <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 min-h-[40px]"
                        disabled={busyId === proof.id}
                        onClick={() => void decide(proof, "approved")}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve —
                        Payment banao
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-700 border-red-300 hover:bg-red-50 min-h-[40px]"
                        disabled={busyId === proof.id}
                        onClick={() => void decide(proof, "rejected")}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="text-[11px] text-gray-400">
            Approve karte hi server is rakam ki asal fee payment bana
            deta hai — bacche ke Fees hisse me jama dikhega. Galat ya
            nakli screenshot ho to Reject karein.
          </p>
        </DialogContent>
      </Dialog>

      {/* Screenshot bada viewer — v1.3 wala pattern (fit + zoom) */}
      <Dialog
        open={!!viewer}
        onOpenChange={(o) => {
          if (!o) setViewer(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8 text-base">
              {viewer?.title || "Payment Screenshot"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
              }
              disabled={zoom <= 0.5}
              aria-label="Zoom kam karo"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-14 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))
              }
              disabled={zoom >= 3}
              aria-label="Zoom badhao"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
          </div>
          <div className="overflow-auto flex-1 min-h-0 bg-slate-100 rounded-md">
            {viewer && (
              <img
                src={viewer.src}
                alt={viewer.title}
                className="block h-auto mx-auto"
                style={{
                  width: `${zoom * 100}%`,
                  maxWidth: zoom <= 1 ? "100%" : "none",
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
