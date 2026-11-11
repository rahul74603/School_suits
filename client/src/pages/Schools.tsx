import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Ban,
  CheckCircle2,
  KeyRound,
  User,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut, ApiError, type ApiUser } from "@/lib/api";

// =============================================================================
// Schools — Super Admin ki management screen (Phase 3 ke baad ka gap)
// -----------------------------------------------------------------------------
// Sirf Super Admin ke liye — App.tsx me iska sidebar link aur route dono
// role se gate hain; server par bhi har endpoint requireRole("super_admin")
// se band hai.
//
// Server ke asal endpoints (routes.ts §5.2 se verify):
//   GET  /api/schools                      → School[] (poori table ki rows)
//   POST /api/schools                      → 201 { school, principal }
//         body = insertSchoolSchema + { principal: {...} }
//   POST /api/schools/:id/deactivate       → isActive = 0 wala school
//   PUT  /api/schools/:id { isActive: 1 }  → dobara chaalu (super_admin ko
//         route isActive badalne deta hai — dedicated /activate nahi hai)
// =============================================================================

interface SchoolRow {
  id: number;
  name: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string | null;
  session: string | null;
  admissionPrefix: string | null;
  admissionYear: string | null;
  // DB me 0/1 (integer) — hamesha !! se padho.
  isActive: number | boolean;
  createdAt: string | null;
}

interface CreateSchoolResponse {
  school: SchoolRow;
  principal: ApiUser;
}

const EMPTY_FORM = {
  // School (insertSchoolSchema) — name/address/phone lazmi, baaki optional.
  name: "",
  address: "",
  phone: "",
  email: "",
  session: "",
  admissionPrefix: "",
  admissionYear: "",
  // Pehla Principal (createSchoolWithPrincipalSchema.principal).
  principalName: "",
  principalUsername: "",
  principalPhone: "",
  temporaryPassword: "",
};

export default function Schools() {
  const { toast } = useToast();

  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);

  // Safalta ka saaf sandesh — principal ka username dikhega, password kabhi nahi.
  const [successInfo, setSuccessInfo] = useState<{
    schoolName: string;
    principalUsername: string;
  } | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<SchoolRow | null>(
    null,
  );
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const data = await apiGet<SchoolRow[]>("/api/schools");
      setSchools(data || []);
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description:
          e instanceof ApiError ? e.message : "Schools ki list nahi aa payi",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const openAdd = () => {
    setFormData({ ...EMPTY_FORM });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleCreate = async () => {
    setFormError(null);

    // Halki si pehle-jaanch — server ki lazmi shartein (zod) yahin bata do,
    // taaki bekaar ki round-trip aur dhundhla 400 error na mile.
    if (!formData.name.trim() || !formData.address.trim() || !formData.phone.trim()) {
      setFormError("School ka naam, address aur phone lazmi hain.");
      return;
    }
    if (!formData.principalName.trim()) {
      setFormError("Principal ka naam lazmi hai.");
      return;
    }
    if (formData.principalUsername.trim().length < 3) {
      setFormError("Principal ka username kam se kam 3 akshar ka ho.");
      return;
    }
    if (formData.temporaryPassword.length < 8) {
      setFormError("Temporary password kam se kam 8 akshar ka ho.");
      return;
    }

    // Sirf bhare hue optional fields bhejo — khali string server par na jaye.
    const body: Record<string, unknown> = {
      name: formData.name.trim(),
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      principal: {
        username: formData.principalUsername.trim(),
        name: formData.principalName.trim(),
        temporaryPassword: formData.temporaryPassword,
        ...(formData.principalPhone.trim()
          ? { phone: formData.principalPhone.trim() }
          : {}),
      },
    };
    if (formData.email.trim()) body.email = formData.email.trim();
    if (formData.session.trim()) body.session = formData.session.trim();
    if (formData.admissionPrefix.trim())
      body.admissionPrefix = formData.admissionPrefix.trim();
    if (formData.admissionYear.trim())
      body.admissionYear = formData.admissionYear.trim();

    setSubmitting(true);
    try {
      const res = await apiPost<CreateSchoolResponse>("/api/schools", body);
      setIsAddOpen(false);
      setSuccessInfo({
        schoolName: res.school.name,
        principalUsername: res.principal.username,
      });
      toast({
        title: "School ban gaya",
        description: `Principal login: ${res.principal.username}`,
      });
      await fetchSchools();
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError) {
        // 400 par server zod ka error object bhejta hai ({message} wala
        // format nahi) — api.ts ka message wahan aam/dhundhla hota hai,
        // isliye yahan saaf Hinglish fallback.
        setFormError(
          e.status === 400 && e.message.startsWith("Request fail")
            ? "Form me kuch galat ya adhoora hai — lazmi fields aur password (kam se kam 8 akshar) check karo."
            : e.message,
        );
      } else {
        setFormError("School nahi ban paya. Dobara koshish karo.");
      }
    }
    setSubmitting(false);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setStatusBusyId(deactivateTarget.id);
    try {
      await apiPost(`/api/schools/${deactivateTarget.id}/deactivate`);
      toast({
        title: "School band kar diya",
        description: `${deactivateTarget.name} ab inactive hai.`,
      });
      setDeactivateTarget(null);
      await fetchSchools();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description:
          e instanceof ApiError ? e.message : "Deactivate nahi ho paya",
        variant: "destructive",
      });
    }
    setStatusBusyId(null);
  };

  const handleActivate = async (school: SchoolRow) => {
    setStatusBusyId(school.id);
    try {
      // Dedicated /activate endpoint nahi hai — PUT par super_admin ko
      // isActive badalne ki ijazat route me saaf hai (routes.ts §5.2).
      await apiPut(`/api/schools/${school.id}`, { isActive: 1 });
      toast({
        title: "School chaalu kar diya",
        description: `${school.name} ab active hai.`,
      });
      await fetchSchools();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: e instanceof ApiError ? e.message : "Activate nahi ho paya",
        variant: "destructive",
      });
    }
    setStatusBusyId(null);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
          <Building2 className="h-8 w-8 text-blue-600" /> Schools
        </h1>

        <div className="flex gap-2">
          <Button onClick={fetchSchools} variant="outline" size="sm">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh List
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Naya School
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        Ye screen sirf Super Admin ke liye hai. Har naye school ke saath uska
        pehla Principal bhi yahin banta hai.
      </p>

      {successInfo && (
        <Card className="border-t-4 border-t-green-600 shadow-sm">
          <CardContent className="py-4 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                School ban gaya: {successInfo.schoolName}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Principal ka login username:{" "}
                <span className="font-mono font-semibold">
                  {successInfo.principalUsername}
                </span>
                . Jo temporary password tumne dala tha wahi use hoga — Principal
                ko pehle login par apna password badalna lazmi hoga.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccessInfo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-t-4 border-t-blue-600 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Banaya gaya</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    List load ho rahi hai…
                  </TableCell>
                </TableRow>
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Abhi koi school nahi bana. "Naya School" se pehla school banao.
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school) => {
                  const active = !!school.isActive;
                  return (
                    <TableRow key={school.id}>
                      <TableCell>
                        <div className="font-medium text-slate-800">
                          {school.name}
                        </div>
                        {school.address && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" /> {school.address}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {school.phone || "—"}
                        </div>
                        {school.email && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" /> {school.email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{school.session || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={active ? "default" : "secondary"}>
                          {active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(school.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-red-600 hover:text-red-700"
                            disabled={statusBusyId === school.id}
                            onClick={() => setDeactivateTarget(school)}
                          >
                            <Ban className="h-4 w-4" /> Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-green-700 hover:text-green-800"
                            disabled={statusBusyId === school.id}
                            onClick={() => handleActivate(school)}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Naya School + pehla Principal                                     */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" /> Naya School
            </DialogTitle>
            <DialogDescription>
              School ki jaankari aur uske pehle Principal ka login — dono ek
              saath bante hain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                School ki jaankari
              </h3>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">
                  School ka Naam *
                </Label>
                <Input
                  placeholder="Jaise: Sunrise Public School"
                  value={formData.name}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">
                  Address *
                </Label>
                <Input
                  placeholder="Poora address"
                  value={formData.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Phone *
                  </Label>
                  <Input
                    placeholder="School ka phone"
                    value={formData.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Email
                  </Label>
                  <Input
                    placeholder="Email (optional)"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Session
                  </Label>
                  <Input
                    placeholder="2026-27"
                    value={formData.session}
                    onChange={(e) => setField("session", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Adm. Prefix
                  </Label>
                  <Input
                    placeholder="SCHOOL"
                    value={formData.admissionPrefix}
                    onChange={(e) => setField("admissionPrefix", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Adm. Year
                  </Label>
                  <Input
                    placeholder="2026"
                    value={formData.admissionYear}
                    onChange={(e) => setField("admissionYear", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <User className="h-4 w-4" /> Pehla Principal
              </h3>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">
                  Principal ka Naam *
                </Label>
                <Input
                  placeholder="Principal ka poora naam"
                  value={formData.principalName}
                  onChange={(e) => setField("principalName", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Username *
                  </Label>
                  <Input
                    placeholder="Login username (kam se kam 3 akshar)"
                    value={formData.principalUsername}
                    onChange={(e) =>
                      setField("principalUsername", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-gray-500 uppercase">
                    Phone
                  </Label>
                  <Input
                    placeholder="Mobile (optional)"
                    value={formData.principalPhone}
                    onChange={(e) => setField("principalPhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">
                  Temporary Password *
                </Label>
                <Input
                  type="password"
                  placeholder="Kam se kam 8 akshar"
                  value={formData.temporaryPassword}
                  onChange={(e) =>
                    setField("temporaryPassword", e.target.value)
                  }
                />
                <p className="text-xs text-amber-600 flex items-start gap-1 pt-1">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 mt-[1px]" />
                  Ye temporary password hai — Principal ko pehle login par
                  apna password badalna lazmi hoga. Ye password sirf Principal
                  ko do, kahin aur mat likho.
                </p>
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {formError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Ban raha hai…" : "School Banao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Deactivate ki pushti                                              */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>School band karein?</DialogTitle>
            <DialogDescription>
              {deactivateTarget?.name} inactive ho jayega — us school ke users
              kaam nahi kar payenge. Data delete nahi hoga, aur school ko kabhi
              bhi dobara Activate kiya ja sakta hai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={statusBusyId === deactivateTarget?.id}
            >
              Haan, Deactivate karo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
