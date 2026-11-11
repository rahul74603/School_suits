import { useState, useEffect, Fragment } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  ChevronDown,
  ChevronUp,
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
//
// v1.3 — per-school Accounts + Password Reset (Super Admin ka support flow):
//   GET  /api/users?schoolId=<id>          → us school ke saare users
//         (routes.ts §5.3: principal/super_admin; super_admin schoolId
//         query se kisi bhi school ke users le sakta hai)
//   POST /api/users/:id/reset-password {}  → server khud temporary password
//         (12 hex) banata hai aur EK hi response me deta hai:
//         { user, temporaryPassword }; mustChangePassword=1 lag jata hai
//         aur user ke purane sessions revoke ho jate hain. Yehi "bhool
//         gaya password" ka asal ilaaj hai (khud-se email/OTP wala
//         system hai hi nahi) — Login screen par bhi yahi bataya gaya hai.
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
  // Plans/License (v1.7): plan "Basic" | "Pro"; licenseExpiry
  // "YYYY-MM-DD" ya null (null = koi expiry nahi). Expiry beet jaye
  // to us school ke users ke data-API band ho jate hain (server par
  // license guard) — isActive wala purana switch isse alag hai.
  plan: string | null;
  licenseExpiry: string | null;
  // DB me 0/1 (integer) — hamesha !! se padho.
  isActive: number | boolean;
  createdAt: string | null;
}

interface CreateSchoolResponse {
  school: SchoolRow;
  principal: ApiUser;
}

interface ResetPasswordResponse {
  user: ApiUser;
  // Body khaali bhejne par server khud banata hai aur sirf is ek
  // response me deta hai — dobara kabhi nahi milta.
  temporaryPassword?: string;
}

// Role ko saaf label me — Principal ko pehchanne ke liye yahi badge hai.
const ROLE_LABELS: Record<ApiUser["role"], string> = {
  super_admin: "Super Admin",
  principal: "Principal",
  accountant: "Accountant",
  teacher: "Teacher",
  staff: "Staff",
  parent: "Parent",
};

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

  // --- v1.3: per-school Accounts vistaar -------------------------------
  // Ek samay par ek hi school khula rehta hai; users schoolId ke hisaab
  // se cache hote hain taaki baar-baar band-kholne par faltu call na ho.
  const [expandedSchoolId, setExpandedSchoolId] = useState<number | null>(
    null,
  );
  const [accountsBySchool, setAccountsBySchool] = useState<
    Record<number, ApiUser[]>
  >({});
  const [accountsLoadingId, setAccountsLoadingId] = useState<number | null>(
    null,
  );
  const [accountsError, setAccountsError] = useState<{
    schoolId: number;
    message: string;
  } | null>(null);

  // Password reset: pehle confirm, fir server ka diya temporary password
  // ek hi baar dikhane wala dialog. Password wali state dialog band
  // hote hi saaf kar dete hain (neeche onOpenChange dekho).
  const [resetTarget, setResetTarget] = useState<{
    school: SchoolRow;
    user: ApiUser;
  } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    user: ApiUser;
    schoolName: string;
    temporaryPassword: string;
  } | null>(null);
  // Plan/license ki chal rahi editing (v1.7) — school id ke hisaab se;
  // entry na ho to school ki asal values hi dikhti hain.
  const [licenseEdits, setLicenseEdits] = useState<
    Record<number, { plan: string; licenseExpiry: string }>
  >({});
  const [licenseBusyId, setLicenseBusyId] = useState<number | null>(null);

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

  // --- v1.3: Accounts vistaar ke kaam --------------------------------
  const fetchAccounts = async (schoolId: number) => {
    setAccountsLoadingId(schoolId);
    setAccountsError(null);
    try {
      const users = await apiGet<ApiUser[]>(
        `/api/users?schoolId=${schoolId}`,
      );
      setAccountsBySchool((prev) => ({ ...prev, [schoolId]: users || [] }));
    } catch (e) {
      console.error(e);
      setAccountsError({
        schoolId,
        message:
          e instanceof ApiError
            ? e.message
            : "Is school ke accounts nahi aa paye. Dobara koshish karo.",
      });
    }
    setAccountsLoadingId(null);
  };

  const toggleAccounts = (school: SchoolRow) => {
    if (expandedSchoolId === school.id) {
      setExpandedSchoolId(null);
      return;
    }
    setExpandedSchoolId(school.id);
    if (!accountsBySchool[school.id]) {
      void fetchAccounts(school.id);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    setResetError(null);
    try {
      // Body khaali {} — server khud temporary password banayega aur
      // isi ek response me dega (routes.ts §5.3 se verify).
      const res = await apiPost<ResetPasswordResponse>(
        `/api/users/${resetTarget.user.id}/reset-password`,
        {},
      );
      const schoolName = resetTarget.school.name;
      const user = res.user ?? resetTarget.user;
      setResetTarget(null);
      setResetResult({
        user,
        schoolName,
        temporaryPassword: res.temporaryPassword || "",
      });
      toast({
        title: "Password reset ho gaya",
        description: `${user.username} ke liye naya temporary password ban gaya hai.`,
      });
    } catch (e) {
      console.error(e);
      setResetError(
        e instanceof ApiError
          ? e.message
          : "Password reset nahi ho paya. Dobara koshish karo.",
      );
    }
    setResetBusy(false);
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN");
  };

  // Plan/license save (v1.7) — maujooda PUT /api/schools/:id se hi
  // hota hai: updateSchoolSchema insertSchoolSchema.partial() hai,
  // isliye plan/licenseExpiry fields usi me aa gaye hain (server par
  // sirf super_admin inhe badal sakta hai — principal ke bheje hue
  // ye fields server hata deta hai).
  const licenseEditFor = (school: SchoolRow) =>
    licenseEdits[school.id] ?? {
      plan: school.plan || "Basic",
      licenseExpiry: school.licenseExpiry || "",
    };

  const setLicenseEdit = (
    school: SchoolRow,
    patch: Partial<{ plan: string; licenseExpiry: string }>,
  ) => {
    setLicenseEdits((prev) => ({
      ...prev,
      [school.id]: { ...licenseEditFor(school), ...patch },
    }));
  };

  const isLicenseExpiredRow = (school: SchoolRow) => {
    if (!school.licenseExpiry) return false;
    return school.licenseExpiry < new Date().toISOString().slice(0, 10);
  };

  const handleSaveLicense = async (school: SchoolRow) => {
    const edit = licenseEditFor(school);
    setLicenseBusyId(school.id);
    try {
      await apiPut(`/api/schools/${school.id}`, {
        plan: edit.plan,
        // Khaali tareekh = koi expiry nahi (null).
        licenseExpiry: edit.licenseExpiry ? edit.licenseExpiry : null,
      });
      toast({
        title: "Plan/License save ho gaya",
        description: `${school.name}: ${edit.plan}${edit.licenseExpiry ? `, expiry ${edit.licenseExpiry}` : ", koi expiry nahi"}`,
      });
      setLicenseEdits((prev) => {
        const next = { ...prev };
        delete next[school.id];
        return next;
      });
      await fetchSchools();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description:
          e instanceof ApiError ? e.message : "Plan/License save nahi hua",
        variant: "destructive",
      });
    }
    setLicenseBusyId(null);
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
                <TableHead>Plan / License</TableHead>
                <TableHead>Banaya gaya</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    List load ho rahi hai…
                  </TableCell>
                </TableRow>
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Abhi koi school nahi bana. "Naya School" se pehla school banao.
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((school) => {
                  const active = !!school.isActive;
                  const expanded = expandedSchoolId === school.id;
                  const schoolUsers = accountsBySchool[school.id];
                  return (
                    <Fragment key={school.id}>
                    <TableRow>
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
                      <TableCell>
                        {/* Plan / License (v1.7): plan select + expiry
                            date + Save — PUT /api/schools/:id se. */}
                        {(() => {
                          const edit = licenseEditFor(school);
                          const expired = isLicenseExpiredRow(school);
                          const dirty =
                            edit.plan !== (school.plan || "Basic") ||
                            edit.licenseExpiry !==
                              (school.licenseExpiry || "");
                          return (
                            <div className="space-y-2 min-w-[210px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={edit.plan}
                                  onValueChange={(v) =>
                                    setLicenseEdit(school, { plan: v })
                                  }
                                >
                                  <SelectTrigger className="h-8 w-[104px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Basic">
                                      Basic
                                    </SelectItem>
                                    <SelectItem value="Pro">Pro</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  className="h-8 w-[150px]"
                                  value={edit.licenseExpiry}
                                  onChange={(e) =>
                                    setLicenseEdit(school, {
                                      licenseExpiry: e.target.value,
                                    })
                                  }
                                />
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={
                                    !dirty || licenseBusyId === school.id
                                  }
                                  onClick={() =>
                                    void handleSaveLicense(school)
                                  }
                                >
                                  {licenseBusyId === school.id
                                    ? "Save ho raha…"
                                    : "Save"}
                                </Button>
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {school.licenseExpiry
                                  ? `Expiry: ${school.licenseExpiry}`
                                  : "Koi expiry nahi set hai"}
                                {expired && (
                                  <span className="ml-2 font-bold text-red-600">
                                    License Khatm — school ke users band
                                    hain
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>{formatDate(school.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => toggleAccounts(school)}
                          >
                            <Users className="h-4 w-4" /> Accounts
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
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
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* v1.3: khula hua school — uske accounts + password reset */}
                    {expanded && (
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableCell colSpan={6} className="p-4">
                          {accountsLoadingId === school.id ? (
                            <p className="text-sm text-gray-500 text-center py-3">
                              Accounts load ho rahe hain…
                            </p>
                          ) : accountsError?.schoolId === school.id ? (
                            <div className="flex flex-wrap items-center gap-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                              <span className="flex-1 min-w-[200px]">
                                {accountsError.message}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchAccounts(school.id)}
                              >
                                Dobara koshish karo
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                {school.name} ke accounts (
                                {schoolUsers?.length ?? 0})
                              </p>
                              {(schoolUsers ?? []).length === 0 ? (
                                <p className="text-sm text-gray-500 py-1">
                                  Is school me abhi koi account nahi hai.
                                </p>
                              ) : (
                                (schoolUsers ?? []).map((u) => (
                                  <div
                                    key={u.id}
                                    className="flex flex-wrap items-center gap-2 bg-white border rounded-lg px-3 py-2"
                                  >
                                    <div className="flex-1 min-w-[180px]">
                                      <div className="text-sm font-medium text-slate-800 flex flex-wrap items-center gap-2">
                                        {u.name || u.username}
                                        <Badge
                                          variant={
                                            u.role === "principal"
                                              ? "default"
                                              : "secondary"
                                          }
                                        >
                                          {ROLE_LABELS[u.role]}
                                        </Badge>
                                        <Badge
                                          variant={
                                            u.isActive
                                              ? "outline"
                                              : "secondary"
                                          }
                                          className={
                                            u.isActive
                                              ? "text-green-700 border-green-300"
                                              : "text-gray-500"
                                          }
                                        >
                                          {u.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                        {!!u.mustChangePassword && (
                                          <Badge
                                            variant="outline"
                                            className="text-amber-600 border-amber-300"
                                          >
                                            Pehla login baaki
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                                        {u.username}
                                        {u.phone ? ` • ${u.phone}` : ""}
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-2"
                                      onClick={() => {
                                        setResetError(null);
                                        setResetTarget({ school, user: u });
                                      }}
                                    >
                                      <KeyRound className="h-4 w-4" /> Password
                                      Reset
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
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

      {/* ---------------------------------------------------------------- */}
      {/* v1.3: Password reset ki pushti                                    */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open && !resetBusy) {
            setResetTarget(null);
            setResetError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" /> Password reset
              karein?
            </DialogTitle>
            <DialogDescription>
              {resetTarget && (
                <>
                  <span className="font-semibold text-slate-700">
                    {resetTarget.user.name || resetTarget.user.username}
                  </span>{" "}
                  ({resetTarget.user.username} — {resetTarget.school.name})
                  ka purana password <b>turant band</b> ho jayega aur wo har
                  jagah se logout ho jayenge. Server ek naya temporary
                  password banayega — use pehle login par badalna lazmi hoga.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {resetError}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetTarget(null);
                setResetError(null);
              }}
              disabled={resetBusy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetPassword}
              disabled={resetBusy}
            >
              {resetBusy ? "Reset ho raha hai…" : "Haan, Reset karo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* v1.3: Naya temporary password — sirf EK baar dikhta hai           */}
      {/* Band hote hi state saaf — password kahin aur store nahi hota.    */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={!!resetResult}
        onOpenChange={(open) => {
          if (!open) setResetResult(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Naya
              temporary password taiyaar
            </DialogTitle>
            <DialogDescription>
              {resetResult && (
                <>
                  {resetResult.user.name || resetResult.user.username} (
                  {resetResult.user.username} — {resetResult.schoolName})
                  ke liye:
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {resetResult &&
            (resetResult.temporaryPassword ? (
              <div className="text-center">
                <div className="text-2xl font-mono font-bold tracking-widest bg-slate-100 border rounded-md py-4 px-2 select-all break-all">
                  {resetResult.temporaryPassword}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Password reset ho gaya hai, lekin server ne temporary
                password wapas nahi bheja. User ko naya password dilane ke
                liye support se sampark karo.
              </p>
            ))}

          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2">
            <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
            Ise abhi note karke{" "}
            {resetResult?.user.name || "user"} ko de do — ye dobara nahi
            dikhega. Pehle login par unhe apna naya password banana lazmi
            hoga.
          </p>

          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>
              Note kar liya, band karo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
