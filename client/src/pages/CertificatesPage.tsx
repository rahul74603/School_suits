import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Award, RefreshCw, School, Search } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CertificateDialog,
  CERT_TITLES,
  type CertificateStudent,
  type CertificateType,
} from "@/components/Certificates";
import type { IdCardSchool } from "@/components/IdCard";

// 📜 Certificates Page (v3.0) — pehle certificates Students →
// Profile ke andar chhupe the (user ko mile hi nahi). Ab apna
// page: baccha khojo/chuno → wahi CertificateDialog khulta hai
// (kul 8 templates). StudentProfile ke purane button bhi waise
// ke waise chalte hain.
// Fee certificate (80C) ke liye chune hue bacche ke payments ka
// kul jod yahi se CertificateStudent.feePaidTotal me jata hai —
// Fees wale asal numbers, koi andaza nahi.

function normalizeSchool(raw: any): IdCardSchool | null {
  if (!raw?.name) return null;
  return {
    name: String(raw.name),
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    logo: raw.logo ?? null,
    session: raw.session ?? null,
    primaryColor: raw.primaryColor ?? null,
  };
}

function toCertificateStudent(s: any): CertificateStudent {
  return {
    // 📜 id (v3.3) — print par register entry isi se banti hai.
    id: s.id,
    name: s.name ?? "",
    fatherName: s.fatherName ?? s.father_name ?? "",
    motherName: s.motherName ?? null,
    // v3.2 defensive: API row me class/section null aa sakte hain —
    // CertificateStudent ka type string hai, isliye yahin "" kar do
    // taaki certificate render hamesha saaf bane.
    class: s.class ?? "",
    section: s.section ?? "",
    admissionNo: s.admissionNo ?? s.admission_no ?? "",
    dob: s.dob ?? null,
    contact: s.contact ?? null,
  };
}

interface StudentRow {
  id: number;
  name: string;
  class: string;
  section: string | null;
  admissionNo: string | null;
  fatherName: string | null;
}

const TYPE_BUTTONS: Array<{ type: CertificateType; label: string }> = [
  { type: "tc", label: "TC" },
  { type: "bonafide", label: "Bonafide" },
  { type: "character", label: "Character" },
  { type: "migration", label: "Migration" },
  { type: "birth", label: "Birth Verification" },
  { type: "fee", label: "Fee (80C)" },
  { type: "provisional", label: "Provisional Passing" },
  { type: "sports", label: "Sports Merit" },
];

export default function CertificatesPage() {
  const { toast } = useToast();
  const { user, school } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [branding, setBranding] = useState<any>(null);
  const [certStudent, setCertStudent] = useState<CertificateStudent | null>(null);
  const [certType, setCertType] = useState<CertificateType>("tc");
  const [isCertOpen, setIsCertOpen] = useState(false);

  // 📜 Register (v3.3) — diye gaye certificates ka record:
  // GET /api/certificates/issued. Tab khulne par load hota hai.
  const [registerRows, setRegisterRows] = useState<any[] | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  const schoolForCert = normalizeSchool(branding ?? school);

  useEffect(() => {
    if (isSuperAdmin) return;
    (async () => {
      try {
        const info = await apiGet<any>("/api/branding");
        if (info) setBranding(info);
      } catch {
        /* auth wala school fallback pehle se hai */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Certificates har school ke apne hote hain — Super Admin
              ke paas kisi school ke bacche nahi aate (data mix nahi
              hota). School ka Principal/office apne login se
              certificate banata hai.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const doSearch = async () => {
    setSearching(true);
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const data = await apiGet<StudentRow[]>(`/api/students${query}`);
      setResults((data ?? []).slice(0, 50));
    } catch (error) {
      toast({
        title: "Students load nahi ho paye",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    doSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCertificate = async (row: StudentRow, type: CertificateType) => {
    const base = toCertificateStudent(row);
    if (type === "fee") {
      // 80C certificate: asal payments ka kul jod. Load na ho to
      // null — certificate par "—" aur note chhapta hai, nakli
      // rakam kabhi nahi.
      try {
        const payments = await apiGet<Array<{ amount: number }>>(
          `/api/payments?studentId=${row.id}`,
        );
        base.feePaidTotal = (payments ?? []).reduce(
          (sum, payment) => sum + (payment.amount ?? 0),
          0,
        );
      } catch {
        base.feePaidTotal = null;
      }
    }
    setCertStudent(base);
    setCertType(type);
    setIsCertOpen(true);
  };

  // 📜 Register load — jawab ke field-naam lachile (studentName /
  // type / issuedBy / issuedAt ke aam badlav chalenge)।
  const loadRegister = async () => {
    setRegisterLoading(true);
    try {
      const data = await apiGet<any>("/api/certificates/issued");
      const list = Array.isArray(data) ? data : (data?.issued ?? []);
      setRegisterRows(list);
    } catch (error) {
      toast({
        title: "Register load nahi ho paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
      setRegisterRows([]);
    }
    setRegisterLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
        <Award className="h-7 w-7 text-blue-600" /> Certificates
      </h1>
      <p className="text-sm text-muted-foreground -mt-3">
        Baccha chunein aur certificate chunein — kul 8 tarah ke
        certificate taiyaar milte hain (TC, Bonafide, Character,
        Migration, Birth Verification, Fee-80C, Provisional Passing,
        Sports Merit).
      </p>

      <Tabs
        defaultValue="make"
        onValueChange={(v) => {
          if (v === "register" && registerRows === null) void loadRegister();
        }}
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="make">Certificate Banao</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="make" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Baccha khojein</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[160px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSearch();
                }}
                placeholder="Naam ya Admission No. likhein…"
                className="pl-8"
              />
            </div>
            <Button onClick={doSearch} disabled={searching}>
              {searching ? "Khoj rahe hain…" : "Khojein"}
            </Button>
          </div>

          <div className="space-y-2">
            {results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {searching ? "Load ho raha hai…" : "Koi baccha nahi mila."}
              </p>
            )}
            {results.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Class {row.class}
                    {row.section ? `-${row.section}` : ""} • Adm. No.{" "}
                    {row.admissionNo ?? "—"}
                    {row.fatherName ? ` • ${row.fatherName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {TYPE_BUTTONS.map((item) => (
                    <Badge
                      key={item.type}
                      className="cursor-pointer bg-blue-100 text-blue-800 hover:bg-blue-200"
                      onClick={() => openCertificate(row, item.type)}
                    >
                      {item.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* 📜 Register — kab, kisko, konsa, kisne diya */}
        <TabsContent value="register" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">
                  Diye Gaye Certificates ka Register
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadRegister()}
                  disabled={registerLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${registerLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {registerRows === null || registerLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Load ho raha hai…
                </p>
              ) : registerRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Abhi koi certificate print nahi hua — pehla
                  certificate print hote hi yahan entry ban jayegi.
                </p>
              ) : (
                <div className="divide-y">
                  {registerRows.map((r: any, i: number) => {
                    const when = r.issuedAt ?? r.createdAt ?? "";
                    const typeKey = (r.type ?? r.certificateType ?? "") as CertificateType;
                    return (
                      <div
                        key={r.id ?? i}
                        className="py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium break-words">
                            {r.studentName ?? r.student?.name ?? r.name ?? "—"}
                            {(r.class || r.studentClass) && (
                              <span className="text-xs text-muted-foreground ml-2">
                                Class {r.class ?? r.studentClass}
                                {r.section ? `-${r.section}` : ""}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-slate-700">
                            {CERT_TITLES[typeKey] ?? typeKey ?? "Certificate"}
                          </p>
                        </div>
                        <div className="shrink-0 text-xs text-gray-500 sm:text-right">
                          <p>
                            {when
                              ? new Date(when).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </p>
                          <p>
                            Diya:{" "}
                            {r.issuedByName ??
                              r.issuedBy ??
                              r.userName ??
                              r.createdBy ??
                              "—"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CertificateDialog
        open={isCertOpen}
        onOpenChange={setIsCertOpen}
        initialType={certType}
        student={certStudent}
        school={schoolForCert}
      />
    </div>
  );
}
