import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { APP_VERSION_NAME } from "@/lib/appVersion";
import { GraduationCap, Hash, Loader2, Lock, Phone } from "lucide-react";

// =============================================================================
// 👨‍👩‍👧 Parent Login (v2.2) — SIRF Parent App ki apni login screen.
// -----------------------------------------------------------------------------
// v2.1 me Parent App school wali Login screen hi istemal karta tha —
// parent ko wahi daftar-wala chehra dikhta tha ("dono ek hi gye, bas
// name alag hai" — user ki shikayat sahi thi). Ye screen sirf parents
// ke liye bani hai: EK card, teen bade khane, saaf Hindi label.
//
//   1. School ID (Code) — school se mila chhota code (admission parchi /
//      WhatsApp sandesh par aata hai). Server is code se school
//      pehchanta hai aur parent ko SIRF usi school ke baccho ka data
//      deta hai — dusre school ka code dalne par login hota hi nahi
//      (server par schoolCode wala milan, routes.ts dekho).
//   2. Mobile Number — yahi parent ka username hai (admission ke samay
//      wala number; account server khud bana deta hai).
//   3. Password — aam taur par bacche ka Admission No.
//
// School app ki Login.tsx se iska koi lena-dena nahi — wo waisi ki
// waisi hai; Gate (App.tsx) Parent App build me yahi screen deta hai.
// Pehli baar office se bane account (mustChangePassword) ke liye neeche
// chhota sa password-badal form bhi hai — bilkul wahi niyam jo school
// app me hai, bas seedha-saada roop me.
// =============================================================================

export default function ParentLogin() {
  const { user, login, changePassword } = useAuth();
  const { toast } = useToast();

  const [schoolCode, setSchoolCode] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Change-password form ki state (mustChangePassword wale account).
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const mustChange = !!user && !!user.mustChangePassword;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolCode.trim() || !mobile.trim() || !password) return;
    setBusy(true);
    try {
      const u = await login(mobile.trim(), password, schoolCode.trim());
      if (u.mustChangePassword) {
        setCurrentPw(password);
        toast({
          title: "Pehla login",
          description: "Suraksha ke liye apna naya password banao.",
        });
      }
    } catch (err) {
      toast({
        title: "Login nahi hua",
        description:
          err instanceof ApiError
            ? err.message
            : "Kuch gadbad ho gayi. Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast({
        title: "Password chhota hai",
        description: "Naya password kam se kam 8 characters ka rakhein.",
        variant: "destructive",
      });
      return;
    }
    if (newPw !== confirmPw) {
      toast({
        title: "Password match nahi",
        description: "Naya password aur dobara wala ek jaise likhein.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPw, newPw);
      toast({
        title: "Password badal gaya",
        description: "Ab aapka naya password hi chalega.",
      });
      // Gate (App.tsx) khud Parent Home khol dega.
    } catch (err) {
      toast({
        title: "Password nahi badla",
        description:
          err instanceof ApiError
            ? err.message
            : "Kuch gadbad ho gayi. Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const bigInput = "h-12 text-base pl-11";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-3">
        <Card className="w-full shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <span className="bg-emerald-600 text-white p-3 rounded-2xl">
                <GraduationCap className="h-9 w-9" />
              </span>
            </div>
            <CardTitle className="text-2xl font-bold">
              Guardian Parent
            </CardTitle>
            <p className="text-sm text-slate-500">
              {mustChange
                ? "Pehli baar login — apna naya password banao"
                : "Parent login — apne bacche ki jaankari dekhein"}
            </p>
          </CardHeader>

          <CardContent>
            {!mustChange ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="parent-school-code" className="text-base">
                    School ID (Code)
                  </Label>
                  <div className="relative">
                    <Hash className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="parent-school-code"
                      className={`${bigInput} uppercase`}
                      placeholder="Jaise: DEMO01"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      autoComplete="organization"
                      autoCapitalize="characters"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Ye code aapko school se mila hai — admission ki parchi
                    ya WhatsApp sandesh par dekhein.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-mobile" className="text-base">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="parent-mobile"
                      className={bigInput}
                      type="tel"
                      inputMode="tel"
                      placeholder="Apna mobile number likhein"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Wahi number jo admission ke samay school ko diya tha.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-password" className="text-base">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="parent-password"
                      type="password"
                      className={bigInput}
                      placeholder="Password likhein"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Password aam taur par aapke bacche ka Admission No.
                    hota hai.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                  disabled={busy}
                >
                  {busy && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                  Login karein
                </Button>

                <p className="text-center text-xs text-slate-400">
                  Login na ho to school ke office se sampark karein —
                  password wahi se dobara mil sakta hai.
                </p>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="parent-current-password" className="text-base">
                    Purana password
                  </Label>
                  <Input
                    id="parent-current-password"
                    type="password"
                    className="h-12 text-base"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                    autoFocus={!currentPw}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-new-password" className="text-base">
                    Naya password (kam se kam 8 characters)
                  </Label>
                  <Input
                    id="parent-new-password"
                    type="password"
                    className="h-12 text-base"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    autoFocus={!!currentPw}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parent-confirm-password" className="text-base">
                    Naya password dobara likhein
                  </Label>
                  <Input
                    id="parent-confirm-password"
                    type="password"
                    className="h-12 text-base"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                  disabled={busy}
                >
                  {busy && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                  Password badlein
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-500">
          Guardian Parent — Version {APP_VERSION_NAME}
        </p>
      </div>
    </div>
  );
}
