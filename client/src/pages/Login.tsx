import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { GraduationCap, KeyRound, Loader2, Lock, User } from "lucide-react";

// =============================================================================
// Login screen (Phase 3 foundation)
// -----------------------------------------------------------------------------
// Client me pehle koi login tha hi nahi — ye pehli asal login screen hai.
// Do hisse:
//  1. Username + password → POST /api/auth/login (server sab kuch token se
//     pehchanta hai; galat login par server ka generic jawab toast me dikhta hai).
//  2. Agar user.mustChangePassword hai (pehle login par Principal aadi ke
//     liye lazmi hai), to gate yahin rok kar password badalne wala form
//     dikhata hai — POST /api/auth/change-password. Badalte hi app khul jata hai.
// Branding: login ke baad /api/auth/me se school ka naam aata hai; screen par
// school ka naam (ho to) warna "School Guardian Suite" dikhta hai.
// =============================================================================

export default function Login() {
  const { user, school, login, changePassword } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // "Password bhool gaye?" wali jaankari ka dialog (v1.3) — is app me
  // khud-se reset (email/OTP) ka system hai hi nahi; password hamesha
  // upar wale (Principal / Super Admin) se reset hota hai, isliye
  // dialog me wahi imaandar rasta bataya gaya hai, koi nakli wada nahi.
  const [forgotOpen, setForgotOpen] = useState(false);

  // Change-password form ki state.
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const mustChange = !!user && !!user.mustChangePassword;
  const schoolName = school?.name || "School Guardian Suite";

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      if (u.mustChangePassword) {
        // Jo password abhi dala tha wahi current hai — form me pehle se
        // bhar do, user ko dobara type na karna pade.
        setCurrentPw(password);
        toast({
          title: "Pehla login",
          description: "Suraksha ke liye apna password badalna lazmi hai.",
        });
      }
    } catch (err) {
      toast({
        title: "Login fail",
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

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast({
        title: "Password chhota hai",
        description: "Naya password kam se kam 8 characters ka rakho.",
        variant: "destructive",
      });
      return;
    }
    if (newPw !== confirmPw) {
      toast({
        title: "Password match nahi",
        description: "Naya password aur confirm wala ek jaise likho.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPw, newPw);
      toast({
        title: "Password badal gaya",
        description: "Ab tumhara naya password hi chalega.",
      });
      // Gate (App.tsx) khud app khol dega — yahan kuch aur nahi karna.
    } catch (err) {
      toast({
        title: "Password nahi badla",
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <span className="bg-blue-600 text-white p-3 rounded-2xl">
              <GraduationCap className="h-8 w-8" />
            </span>
          </div>
          <CardTitle className="text-2xl font-bold">{schoolName}</CardTitle>
          <p className="text-sm text-slate-500">
            {mustChange
              ? "Pehli baar login — naya password banao"
              : "Apne account se login karo"}
          </p>
        </CardHeader>

        <CardContent>
          {!mustChange ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="username"
                    className="pl-9"
                    placeholder="Username likho"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Parents ke liye username = apna mobile number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    placeholder="Password likho"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Login
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm text-slate-500 underline-offset-2 hover:text-blue-600 hover:underline"
                >
                  Password bhool gaye?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Purana (temporary) password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  autoFocus={!currentPw}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Naya password (kam se kam 8 characters)</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  autoFocus={!!currentPw}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Naya password dobara likho</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Password badlo aur aage badho
              </Button>
            </form>
          )}

          <p className="text-center text-xs text-slate-400 mt-6">
            School Guardian Suite — har school ka apna login
          </p>
          <p className="text-center text-[11px] text-slate-400 mt-1">Version 1.4</p>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* Password bhool gaye — imaandar jaankari (koi email/OTP nahi)  */}
      {/* ------------------------------------------------------------ */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" /> Password bhool
              gaye?
            </DialogTitle>
            <DialogDescription>
              Is app me password khud se (email ya OTP se) reset nahi hota —
              suraksha ke liye password sirf tumhare school ke bade adhikari
              hi reset karte hain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-800">
                Teacher, Staff ya Parent ho?
              </span>{" "}
              Apne school ke <b>Principal</b> se kaho — wo tumhare liye
              password reset karke ek naya temporary password de denge.
            </p>
            <p>
              <span className="font-semibold text-slate-800">
                Principal ho?
              </span>{" "}
              Apne <b>Super Admin</b> se sampark karo — jinse tumne ye app
              liya hai. Wo tumhara password turant reset karke naya temporary
              password de denge.
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Naya temporary password milne ke baad pehle login par tumhe
              apna naya password banana lazmi hoga.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>Samajh gaya</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
