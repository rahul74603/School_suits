import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiPost, ApiError } from "@/lib/api";
import { FlaskConical, Loader2 } from "lucide-react";

// =============================================================================
// 🧪 Demo School card (v2.2) — Master App ki Schools screen ke upar.
// -----------------------------------------------------------------------------
// Ek tap par server (POST /api/admin/demo-school, sirf super_admin)
// poora test school bana deta hai: Demo Public School (Code DEMO01) +
// Principal + Class 1 ki fee rachna + 5 namoona bacche + kuch fees/dues
// + aaj ki hajri + ek notice + har bacche ke parent ka login. Isse
// Master bina asli school banaye poora app ghuma kar dekh sakta hai —
// aur schools ko demo dikhate samay bhi yahi kaam aata hai.
//
// Imaandari: Principal ka temporary password SIRF banne wale jawab me
// ek baar aata hai — wahi yahan dikhta hai. Demo school pehle se ho to
// server naya nahi banata; tab card wahi bata deta hai (password dobara
// nahi milta — Schools list ke Accounts se reset hota hai).
// =============================================================================

interface DemoSchoolResponse {
  created: boolean;
  school: { id: number; name: string; code: string | null };
  principal: { username: string; temporaryPassword?: string } | null;
  seeded?: {
    feeStructure: string;
    students: number;
    payments: number;
    pendingDue: string;
    attendanceDate: string;
    notices: number;
    parentLogins: string;
  };
  message?: string;
}

export default function DemoSchoolCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DemoSchoolResponse | null>(null);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await apiPost<DemoSchoolResponse>(
        "/api/admin/demo-school",
        {},
      );
      setResult(res);
      toast({
        title: res.created
          ? "Demo School ban gaya"
          : "Demo School pehle se hai",
        description: res.created
          ? "Test data bhar diya gaya hai — neeche Principal ka login dekho."
          : "Naya nahi banaya — neeche usi ki jaankari hai.",
      });
    } catch (err) {
      toast({
        title: "Demo School nahi bana",
        description:
          err instanceof ApiError
            ? err.message
            : "Kuch gadbad ho gayi. Dobara koshish karo.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-t-4 border-t-purple-600 shadow-sm min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-600" />
          Demo School (Test Data)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">
          Testing ke liye ek taiyaar school — <b>Demo Public School</b>{" "}
          (School Code <span className="font-mono font-semibold">DEMO01</span>),
          uska Principal, 5 namoona bacche, fees, hajri aur notice ke saath.
          Asli schools se bilkul alag data — mix nahi hoga.
        </p>

        <Button
          onClick={handleCreate}
          disabled={busy}
          className="min-h-[44px] bg-purple-600 hover:bg-purple-700"
        >
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Demo School banao (test data)
        </Button>

        {result && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-1 text-sm text-slate-700 min-w-0">
            <p className="font-semibold">
              {result.created
                ? "✅ Demo School ban gaya"
                : "ℹ️ Demo School pehle se bana hai"}
              : {result.school.name} (Code:{" "}
              <span className="font-mono font-semibold">
                {result.school.code || "DEMO01"}
              </span>
              )
            </p>
            {result.principal && (
              <p>
                Principal username:{" "}
                <span className="font-mono font-semibold">
                  {result.principal.username}
                </span>
                {result.principal.temporaryPassword ? (
                  <>
                    {" "}
                    · Temporary password:{" "}
                    <span className="font-mono font-semibold">
                      {result.principal.temporaryPassword}
                    </span>{" "}
                    — <b>ye sirf is ek baar dikh raha hai</b>, note kar lo.
                    Pehle login par naya password banana lazmi hoga.
                  </>
                ) : (
                  <>
                    {" "}
                    — password bhool gaye ho to neeche Schools list me is
                    school ke <b>Accounts</b> se reset kar do.
                  </>
                )}
              </p>
            )}
            {result.created && result.seeded && (
              <p className="text-gray-600">
                Bhar diya gaya: {result.seeded.feeStructure};{" "}
                {result.seeded.students} bacche; {result.seeded.payments}{" "}
                fee payments; ek pending due ({result.seeded.pendingDue});
                aaj ({result.seeded.attendanceDate}) ki hajri;{" "}
                {result.seeded.notices} notice. {result.seeded.parentLogins}
              </p>
            )}
            {!result.created && result.message && (
              <p className="text-gray-600">{result.message}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
