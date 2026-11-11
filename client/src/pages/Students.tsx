import { useState, useEffect, useRef } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Bus, FilterX, RefreshCw, GraduationCap, Filter, School, ArrowUpCircle, Download, CreditCard, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { downloadCsv, todayStamp } from "@/lib/exportCsv";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
// 🪪📜 v1.7: ID Card + Certificates (TC/Bonafide) — components apna
// print khud sambhalte hain (ReportCards wala window pattern).
import {
  IdCardDialog,
  type IdCardSchool,
  type IdCardStudent,
} from "@/components/IdCard";
import {
  CertificateDialog,
  type CertificateStudent,
  type CertificateType,
} from "@/components/Certificates";

// Card/Certificate ke liye school ka shape — branding API (ya auth ke
// school) se jo mile use is saaf roop me badlo; field na ho to null.
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

// Page ki adapted (snake_case) row se card wala student.
function toIdCardStudent(s: any): IdCardStudent {
  return {
    id: s.id,
    name: s.name,
    class: s.class,
    section: s.section,
    admissionNo: s.admission_no ?? s.admissionNo ?? "",
    fatherName: s.father_name ?? s.fatherName ?? "",
    contact: s.contact ?? "",
    rollNo: s.rollNo ?? null,
    dob: s.dob ?? null,
    photo: s.photo ?? null,
  };
}

function toCertificateStudent(s: any): CertificateStudent {
  return {
    name: s.name,
    fatherName: s.father_name ?? s.fatherName ?? "",
    motherName: s.motherName ?? null,
    class: s.class,
    section: s.section,
    admissionNo: s.admission_no ?? s.admissionNo ?? "",
    dob: s.dob ?? null,
    contact: s.contact ?? null,
  };
}

export default function Students() {
  const { toast } = useToast();
  // Super Admin ka khud ka koi school nahi hota — GET /api/students
  // server par uske liye 403 deta hai (requireRole me super_admin
  // hai hi nahi; routes se verify). Isliye SA par API call hi nahi
  // karte — Settings wala no-school card dikhega, lal toast nahi.
  const { user, school } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  // 🎓 Promotion sirf Principal kar sakta hai — server par bhi
  // POST /api/students/promote requireRole("principal") hai.
  const isPrincipal = user?.role === "principal";

  // 🟢 Filter States
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 🎓 Promotion State (v1.6) — server API Phase 2 se thi
  // (POST /api/students/promote), screen/button ab bana.
  const PROMOTE_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [promoteFrom, setPromoteFrom] = useState("");
  const [promoteTo, setPromoteTo] = useState("");
  const [promoteList, setPromoteList] = useState<any[]>([]);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);

  // 🪪📜 v1.7: ID Card / Certificate dialogs ki state + school branding
  // (Fees/ReportCards wala pattern: /api/branding; na mile to auth ka
  // school — dono ek hi API row hain).
  const [branding, setBranding] = useState<any>(null);
  const [idCardStudent, setIdCardStudent] = useState<IdCardStudent | null>(null);
  const [certStudent, setCertStudent] = useState<CertificateStudent | null>(null);
  const [certType, setCertType] = useState<CertificateType>("tc");
  const [isCertOpen, setIsCertOpen] = useState(false);
  const schoolForCards = normalizeSchool(branding ?? school);

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

  const openCertificate = (s: any, type: CertificateType) => {
    setCertStudent(toCertificateStudent(s));
    setCertType(type);
    setIsCertOpen(true);
  };

  // Transport State
  const [isTransportOpen, setIsTransportOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [transportEnabled, setTransportEnabled] = useState(false);
  const [newTransportId, setNewTransportId] = useState("");
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  // Transport routes ka cache — student list me route_name dikhane ke liye
  // routes ek hi baar laaye jate hain (har search keystroke par nahi).
  const routesCache = useRef<any[] | null>(null);

  // 🟢 LOAD STUDENTS (FIXED: Ab ye sahi naam bhejega)
  const fetchStudents = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      console.log("Fetching with:", { search, classFilter, sectionFilter }); // Debugging ke liye

      // REST: GET /api/students?search=&class=&section=
      // (server ke param naam class/section/search hain; "ALL" par param
      // bhejte hi nahi). Dhyaan: server ki search sirf student ke NAAM par
      // hai — Adm No/Mobile par khoj server me abhi nahi hai (NOTES.md).
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (classFilter !== "ALL") params.set("class", classFilter);
      if (sectionFilter !== "ALL") params.set("section", sectionFilter);
      const qs = params.toString();
      const data = await apiGet<any[]>(`/api/students${qs ? `?${qs}` : ""}`);

      // Route names ke liye cached routes (fail ho to list bina naam ke
      // bhi aa jaye — isliye alag chhota catch).
      let routes = routesCache.current;
      if (!routes) {
        try {
          routes = await loadRoutesData();
        } catch {
          routes = [];
        }
      }
      const routeNameById = new Map((routes || []).map((r: any) => [r.id, r.routeName]));

      // Adapters: REST camelCase -> page ke snake_case naam, aur
      // route_name (IPC me join hokar aata tha, REST me transportId se joda).
      const adapted = (data || []).map((s: any) => ({
        ...s,
        admission_no: s.admissionNo,
        father_name: s.fatherName,
        tc_number: s.tcNumber,
        previous_school_name: s.previousSchoolName,
        transport_id: s.transportId ?? null,
        route_name:
          s.transportId != null ? routeNameById.get(s.transportId) ?? null : null,
      }));
      setStudents(adapted);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load list", variant: "destructive" });
    }
    setLoading(false);
  };

  // Jab bhi filter change ho, data reload karo
  useEffect(() => {
    fetchStudents();
  }, [search, classFilter, sectionFilter]);

  // Load Routes once
  // REST: GET /api/transport-routes — route_name adapter ke saath.
  const loadRoutesData = async () => {
    const routes = await apiGet<any[]>("/api/transport-routes");
    const adapted = (routes || []).map((r: any) => ({
      ...r,
      route_name: r.routeName,
    }));
    routesCache.current = adapted;
    return adapted;
  };

  const loadRoutes = async () => {
    const routes = await loadRoutesData();
    setTransportRoutes(routes || []);
  };

  const openTransportDialog = (student: any) => {
    loadRoutes();
    setSelectedStudent(student);
    setTransportEnabled(!!student.transport_id);
    setNewTransportId(student.transport_id ? student.transport_id.toString() : "");
    setIsTransportOpen(true);
  };

  const saveTransport = async () => {
    try {
      // REST: PUT /api/students/:id/transport { transportId }
      await apiPut(`/api/students/${selectedStudent.id}/transport`, {
        transportId: transportEnabled ? parseInt(newTransportId) : null,
      });

      toast({ title: "Updated", description: "Transport updated successfully." });
      setIsTransportOpen(false);
      fetchStudents(); // Refresh List
    } catch (e) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  // 🎓 Promotion: "from" class ke ACTIVE students ki list.
  // GET /api/students server par pehle se sirf active (isActive=1)
  // students deta hai — isliye ye ginti hi promote hone walon ki hai.
  const loadPromoteClass = async (fromClass: string) => {
    setPromoteFrom(fromClass);
    setPromoteList([]);
    if (!fromClass) return;
    setPromoteLoading(true);
    try {
      const data = await apiGet<any[]>(
        `/api/students?class=${encodeURIComponent(fromClass)}`,
      );
      setPromoteList(data || []);
    } catch (e) {
      toast({
        title: "Error",
        description: "Class ki student list nahi aayi — dobara koshish karein.",
        variant: "destructive",
      });
    }
    setPromoteLoading(false);
  };

  const openPromoteDialog = () => {
    setPromoteFrom("");
    setPromoteTo("");
    setPromoteList([]);
    setIsPromoteOpen(true);
  };

  const doPromote = async () => {
    if (!promoteFrom || !promoteTo || promoteFrom === promoteTo) return;
    if (promoteList.length === 0) return;
    setPromoting(true);
    try {
      // REST: POST /api/students/promote { studentIds, targetClass }
      // Jawab: { message, promotedCount }. Server dusri school ke IDs
      // khud gira deta hai, isliye asal ginti promotedCount se hi lo.
      const res = await apiPost<any>("/api/students/promote", {
        studentIds: promoteList.map((s: any) => s.id),
        targetClass: promoteTo,
      });
      const count = res?.promotedCount ?? promoteList.length;
      toast({
        title: "Promotion ho gaya",
        description: `${count} student(s) Class ${promoteFrom} se Class ${promoteTo} me bhej diye gaye.`,
      });
      setIsPromoteOpen(false);
      fetchStudents(); // Directory refresh
    } catch (e) {
      toast({
        title: "Promotion nahi hua",
        description: "Kuch galat hua — koi badlav nahi hua hoga. Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setPromoting(false);
  };

  // 📤 Export CSV (v1.7 FIN) — client-side, screen par pehle se loaded
  // list se hi banta hai: matlab jo filter (search/class/section) laga
  // hai, CSV me bhi wahi students ayenge. Koi nayi API call nahi hai.
  const exportStudentsCsv = () => {
    if (students.length === 0) return;
    downloadCsv(
      `students-${todayStamp()}.csv`,
      [
        "Admission No", "Name", "Class", "Section", "Roll No",
        "Father Name", "Mother Name", "Contact", "DOB", "Category",
        "Address", "Transport Route",
      ],
      students.map((s: any) => [
        s.admission_no ?? s.admissionNo ?? "",
        s.name ?? "",
        s.class ?? "",
        s.section ?? "",
        s.rollNo ?? "",
        s.father_name ?? s.fatherName ?? "",
        s.motherName ?? "",
        s.contact ?? "",
        s.dob ?? "",
        s.category ?? "",
        s.address ?? "",
        s.route_name ?? "",
      ]),
    );
    toast({
      title: "CSV download ho gaya",
      description: `${students.length} student(s) ki list export hui — jo filter laga tha, wahi list gayi hai.`,
    });
  };

  // Reset Button
  const handleReset = () => {
      setSearch("");
      setClassFilter("ALL");
      setSectionFilter("ALL");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
          <GraduationCap className="h-8 w-8 text-blue-600" /> Students Directory
        </h1>

        <div className="flex flex-wrap gap-2 shrink-0 self-start sm:self-auto">
          {isPrincipal && (
            <Button onClick={openPromoteDialog} size="sm" className="bg-green-600 hover:bg-green-700">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Promote Students
            </Button>
          )}
          {!isSuperAdmin && (
            <Button
              onClick={exportStudentsCsv}
              variant="outline"
              size="sm"
              disabled={students.length === 0}
              title="Screen par dikh rahi student list ki CSV file download karein"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button onClick={fetchStudents} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh List
          </Button>
        </div>
      </div>

      {isSuperAdmin ? (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there is no school student data to show here.
              First create a school from the Schools screen — after that,
              that school&apos;s Principal can sign in with their own
              account and manage students.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
      <>

      {/* 🟢 FILTER CARD */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm overflow-visible">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-4 items-end relative z-20">
            
            {/* Search Box */}
            <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[250px] space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">Search Student</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Name, Adm No, Mobile..."
                    className="pl-9 bg-white w-full min-w-0"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
            </div>

            {/* Class Filter (Design & Logic Fixed) */}
            <div className="w-[180px] space-y-1 relative">
                <Label className="text-xs font-bold text-gray-500 uppercase flex gap-1"><Filter className="h-3 w-3"/> Class</Label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  
                  {/* ✅ Fixed: Background White & Z-Index taaki transparency issue na ho */}
                  <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                    <SelectItem value="ALL">All Classes</SelectItem>
                    {["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(
                      (c) => <SelectItem key={c} value={c}>Class {c}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
            </div>

            {/* Section Filter (Design & Logic Fixed) */}
            <div className="w-[150px] space-y-1 relative">
                <Label className="text-xs font-bold text-gray-500 uppercase">Section</Label>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  
                  {/* ✅ Fixed: Background White & Z-Index */}
                  <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                    <SelectItem value="ALL">All Sections</SelectItem>
                    {["A", "B", "C", "D", "E"].map((s) => (
                      <SelectItem key={s} value={s}>Section {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>

            {/* Reset Button */}
            <Button variant="secondary" className="mb-[2px]" onClick={handleReset}>
              <FilterX className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {students.length > 0 ? (
          <div className="rounded-md border bg-white relative z-10 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">ADM No</TableHead>
                  <TableHead className="font-bold text-slate-700">Student Name</TableHead>
                  <TableHead className="font-bold text-slate-700">Class</TableHead>
                  <TableHead className="font-bold text-slate-700">Father's Name</TableHead>
                  <TableHead className="font-bold text-slate-700">Contact</TableHead>
                  <TableHead className="font-bold text-slate-700">TC No</TableHead>
                  <TableHead className="font-bold text-slate-700">Old School</TableHead>
                  <TableHead className="font-bold text-slate-700">Transport</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {students.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-slate-50">
                      <TableCell className="font-bold text-blue-600">{s.admission_no}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                                {s.name?.charAt(0)}
                            </div>
                            {s.name}
                        </div>
                      </TableCell>
                      <TableCell><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{s.class} - {s.section}</span></TableCell>
                      <TableCell>{s.father_name}</TableCell>
                      <TableCell>{s.contact}</TableCell>

                      <TableCell>
                        {s.tc_number ? <span className="text-green-700 font-mono text-xs">{s.tc_number}</span> : <span className="text-gray-300">-</span>}
                      </TableCell>

                      <TableCell>
                        {s.previous_school_name ? <span className="text-xs truncate max-w-[150px] block" title={s.previous_school_name}>{s.previous_school_name}</span> : <span className="text-gray-300">-</span>}
                      </TableCell>

                      <TableCell>
                        {s.route_name ? (
                          <span className="text-orange-600 flex items-center gap-1 font-medium text-xs">
                            <Bus className="h-3 w-3" /> {s.route_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setIdCardStudent(toIdCardStudent(s))} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
                            <CreditCard className="h-4 w-4 mr-1" /> ID Card
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openCertificate(s, "tc")} className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50">
                            <Award className="h-4 w-4 mr-1" /> Certificate
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openTransportDialog(s)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                            <Bus className="h-4 w-4 mr-1" /> Edit Bus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          ) : (
            <div className="rounded-md border bg-white py-12 text-center text-slate-500">
              {loading ? "Searching..." : "No students found matching filters."}
            </div>
          )}
        </CardContent>
      </Card>

      </>
      )}

      {/* 🎓 Promotion Popup (v1.6) — class chuno, ginti dekho,
          pakka karke bhejo. Session server is route se NAHI badalta
          (session school-level setting hai, Settings se badalta hai) —
          ye sirf class badalta hai. */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600" /> Promote Students
            </DialogTitle>
            <DialogDescription>
              Ek poori class ke saare active students ko agli (ya kisi
              dusri) class me bhejein — saal ke ant ke liye.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-bold text-gray-500 uppercase">Kaunsi class se</Label>
              <Select value={promoteFrom} onValueChange={(v) => void loadPromoteClass(v)}>
                <SelectTrigger className="bg-white w-full">
                  <SelectValue placeholder="Class chunein" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  {PROMOTE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 min-w-0">
              <Label className="text-xs font-bold text-gray-500 uppercase">Kaunsi class me bhejein</Label>
              <Select value={promoteTo} onValueChange={setPromoteTo}>
                <SelectTrigger className="bg-white w-full">
                  <SelectValue placeholder="Target class chunein" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  {PROMOTE_CLASSES.filter((c) => c !== promoteFrom).map((c) => (
                    <SelectItem key={c} value={c}>Class {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {promoteFrom && (
              <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                {promoteLoading ? (
                  <p>Student ginti aa rahi hai…</p>
                ) : (
                  <>
                    <p>
                      Class <b>{promoteFrom}</b> me kul{" "}
                      <b>{promoteList.length}</b> active student(s) hain
                      {promoteTo ? (
                        <>
                          {" "}— ye sab Class <b>{promoteTo}</b> me chale
                          jayenge.
                        </>
                      ) : (
                        "."
                      )}
                    </p>
                    <p className="text-xs text-amber-700">
                      Dhyaan: promotion ke baad ye badlav ek click me wapas
                      nahi hoga. Galti ho jaye to students ko haath se sahi
                      class me wapas bhejna padega.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPromoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void doPromote()}
              className="bg-green-600 hover:bg-green-700"
              disabled={
                promoting ||
                promoteLoading ||
                !promoteFrom ||
                !promoteTo ||
                promoteFrom === promoteTo ||
                promoteList.length === 0
              }
            >
              {promoting
                ? "Promote ho raha hai…"
                : `Pakka — ${promoteList.length} Students ko Promote Karein`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transport Popup */}
      <Dialog open={isTransportOpen} onOpenChange={setIsTransportOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Update Transport: {selectedStudent?.name}</DialogTitle>
            <DialogDescription>Manage bus service for this student.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded border">
              <Label className="cursor-pointer" htmlFor="bus-toggle">Enable Bus Service</Label>
              <Switch id="bus-toggle" checked={transportEnabled} onCheckedChange={setTransportEnabled} />
            </div>

            {transportEnabled && (
              <div className="space-y-2">
                <Label>Select Bus Route</Label>
                <Select value={newTransportId} onValueChange={setNewTransportId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Choose Route..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white max-h-[200px]">
                    {transportRoutes.map((r) => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        {r.route_name} (₹{r.amount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransportOpen(false)}>Cancel</Button>
            <Button onClick={saveTransport} className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🪪 ID Card (v1.7) — photo dialog khud documents se lata hai */}
      <IdCardDialog
        open={!!idCardStudent}
        onOpenChange={(open) => {
          if (!open) setIdCardStudent(null);
        }}
        student={idCardStudent}
        school={schoolForCards}
      />

      {/* 📜 Certificate (v1.7) — TC/Bonafide, andar hi badal sakte hain */}
      <CertificateDialog
        open={isCertOpen}
        onOpenChange={setIsCertOpen}
        initialType={certType}
        student={certStudent}
        school={schoolForCards}
      />
    </div>
  );
}