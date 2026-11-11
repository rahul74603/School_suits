import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Upload,
  FileText,
  UserCircle2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  FilterX,
  Eye,
  FileImage,
  FileBadge,
  FileCheck,
  FileX,
  School
} from "lucide-react";

const DOC_TYPES = [
  { key: "photo", label: "Student Photo", icon: FileImage },
  { key: "aadhaar", label: "Aadhaar Card", icon: FileBadge },
  { key: "birth_certificate", label: "Birth Certificate", icon: FileCheck },
  { key: "tc", label: "Transfer Certificate (TC)", icon: FileText },
  { key: "marksheet", label: "Previous Marksheet", icon: FileText },
  { key: "other", label: "Other Document", icon: FileX },
];

export default function StudentProfile() {
  const { toast } = useToast();
  // Super Admin ka khud ka koi school nahi hota — student endpoints
  // server par uske liye 403 dete hain (requireRole me super_admin
  // hai hi nahi; routes se verify). Search karne par SA ko lal
  // "Failed to load student." toast milta tha. Isliye SA par
  // search/load hi nahi chalate — Settings wala no-school card
  // dikhega.
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [admNo, setAdmNo] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");

  const [student, setStudent] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // --- REST adapters (Phase 3 Batch C) ---------------------------------
  const adaptStudentRow = (raw: any) => ({
    ...raw,
    admission_no: raw.admissionNo,
    father_name: raw.fatherName,
    tc_submitted: raw.tcSubmitted,
  });

  // Document row ko page ke IPC shape me: file_path asal local path
  // nahi — "sgdoc:<id>" token hai, jisse openDoc server se file ka
  // content mangta hai. Purani metadata-only rows (hasFile false) par
  // open karne par "File not found" ayega — unke paas content hai hi nahi.
  const adaptDoc = (d: any) => ({
    ...d,
    doc_type: d.docType,
    file_name: d.fileName,
    file_path: `sgdoc:${d.id}`,
    uploaded_at: d.createdAt,
  });

  // REST: GET /api/students — "ALL" par param bhejte hi nahi (Batch A usool).
  const fetchStudentList = async (searchText: string) => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return [];
    const params = new URLSearchParams();
    if (searchText) params.set("search", searchText);
    if (classFilter !== "ALL") params.set("class", classFilter);
    if (sectionFilter !== "ALL") params.set("section", sectionFilter);
    const qs = params.toString();
    const rows = await apiGet<any[]>(`/api/students${qs ? `?${qs}` : ""}`);
    return (rows || []).map(adaptStudentRow);
  };

  const loadFullStudent = async (admissionNo: string) => {
    // REST: GET /api/students/by-admission-no/:no — na mile to 404;
    // IPC null deta tha, isliye catch me null banaya.
    let s: any = null;
    try {
      const raw = await apiGet<any>(`/api/students/by-admission-no/${encodeURIComponent(admissionNo)}`);
      s = raw ? adaptStudentRow(raw) : null;
    } catch (e) {
      s = null;
    }

    if (!s) {
      setStudent(null);
      setDocuments([]);
      toast({ title: "Not Found", description: "No student found." });
      return;
    }

    setStudent(s);
    const docs = await apiGet<any[]>(`/api/students/${s.id}/documents`);
    setDocuments((docs || []).map(adaptDoc));
    setSuggestions([]);
    toast({ title: "Success", description: `Student loaded: ${s.name}` });
  };

  const fetchStudent = async (admNoToSearch?: string) => {
    const finalInput = (admNoToSearch || admNo || "").trim();
    setLoading(true);

    try {
      const list = await fetchStudentList(finalInput);

      if (!list || list.length === 0) {
        setStudent(null);
        setDocuments([]);
        setSuggestions([]);
        toast({ title: "No Results", description: "No student found with these filters.", variant: "default" });
        setLoading(false);
        return;
      }

      if (list.length === 1) {
        await loadFullStudent(list[0].admission_no);
        setLoading(false);
        return;
      }

      const exact = list.find((x: any) => (x.admission_no || "").toUpperCase() === finalInput.toUpperCase());
      if (exact) {
        await loadFullStudent(exact.admission_no);
        setLoading(false);
        return;
      }

      setSuggestions(list);
      toast({ title: "Multiple Found", description: "Select from the list below." });

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load student.", variant: "destructive" });
    }

    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = admNo.trim();
      
      if (!q && classFilter === "ALL" && sectionFilter === "ALL") {
        setSuggestions([]);
        return;
      }

      try {
        setSearching(true);
        const list = await fetchStudentList(q);

        if (list && list.length > 0) setSuggestions(list);
        else setSuggestions([]);
      } catch (e) {
        setSuggestions([]);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(t);
  }, [admNo, classFilter, sectionFilter]);

  const refreshDocs = async () => {
    if (!student?.id) return;
    const docs = await apiGet<any[]>(`/api/students/${student.id}/documents`);
    setDocuments((docs || []).map(adaptDoc));
  };

  const fileToBase64 = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result?.toString() || "").split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadDoc = async (docType: string, file: File) => {
    if (!student?.id) return;
    try {
      const base64Data = await fileToBase64(file);
      // REST: POST /api/students/:id/documents — file content base64
      // me jata hai aur server par save hota hai (limit ~2MB; badi
      // file par server 400 dega aur neeche wala toast dikhega).
      await apiPost(`/api/students/${student.id}/documents`, {
        docType, fileName: file.name, base64Data, mimeType: file.type || undefined,
      });
      toast({ title: "Uploaded", description: "File uploaded successfully." });
      await refreshDocs();
    } catch (e) { 
      toast({ title: "Error", description: "Upload failed.", variant: "destructive" }); 
    }
  };

  const openDoc = async (filePath: string) => {
    try {
      // REST: filePath asal path nahi, "sgdoc:<documentId>" token hai —
      // file ka content /file endpoint se aata hai aur blob URL se
      // khulta hai (web/Android par yahi tareeka chalta hai; na khule
      // to download ho jata hai).
      const docId = String(filePath || "").replace("sgdoc:", "");
      if (!student?.id || !docId) {
        toast({ title: "Error", description: "File not found", variant: "destructive" });
        return;
      }
      const file = await apiGet<any>(`/api/students/${student.id}/documents/${docId}/file`);
      const bytes = Uint8Array.from(atob(file.base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.fileName || "document";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      toast({ title: "Error", description: e?.status === 404 ? "File not found" : "Failed to open", variant: "destructive" });
    }
  };

  const resetFilters = () => {
      setAdmNo(""); 
      setClassFilter("ALL"); 
      setSectionFilter("ALL"); 
      setSuggestions([]); 
      setStudent(null);
      setDocuments([]);
  };

  // Helper: Get document by type
  const getDocByType = (type: string) => documents.find(d => d.doc_type === type);

  // Helper: Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-gray-800">
          <UserCircle2 className="h-8 w-8 text-blue-600" /> Student Profile
        </h1>
        {!isSuperAdmin && (
          <Button variant="outline" size="sm" onClick={resetFilters} className="shrink-0 self-start sm:self-auto">
              <FilterX className="h-4 w-4 mr-2"/> Reset Search
          </Button>
        )}
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
              to any school, so there are no school student profiles to
              show here. First create a school from the Schools screen —
              after that, that school&apos;s Principal can sign in with
              their own account and view student profiles.
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

      {/* SEARCH BAR & FILTERS */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm overflow-visible">
        <CardHeader className="bg-blue-50 py-3">
          <CardTitle className="text-base text-blue-800">Find Student</CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-3 relative z-20">
          <div className="flex flex-wrap gap-4 items-end">
            
            <div className="w-full min-w-0 sm:w-auto sm:flex-1 space-y-1 relative z-30">
              <Label>Search (Name / Adm No / Mobile)</Label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    value={admNo}
                    onChange={(e) => setAdmNo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") fetchStudent(); }}
                    placeholder="Type to search..."
                    className="pl-9 font-bold w-full min-w-0"
                  />
              </div>

              {(suggestions.length > 0) && (
                <div className="absolute left-0 right-0 top-[50px] bg-white border shadow-xl rounded-lg z-[100] max-h-[300px] overflow-y-auto">
                  {suggestions.map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => { setAdmNo(sug.admission_no); setSuggestions([]); loadFullStudent(sug.admission_no); }}
                      className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex justify-between">
                          <div className="font-bold text-sm text-gray-800">{sug.name}</div>
                          <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{sug.class}-{sug.section}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {sug.admission_no} • Father: {sug.father_name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-[140px] space-y-1 relative z-20">
                <Label>Class</Label>
                <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                        <SelectItem value="ALL">All</SelectItem>
                        {["Nursery","LKG","UKG","1","2","3","4","5","6","7","8","9","10","11","12"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-[110px] space-y-1 relative z-20">
                <Label>Section</Label>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                        <SelectItem value="ALL">All</SelectItem>
                        {["A","B","C","D","E"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={() => fetchStudent()} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "..." : "Search"}
            </Button>

            <Button variant="outline" onClick={refreshDocs} disabled={!student?.id}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student Details */}
      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
          
          {/* Photo Card with Open Button */}
          <Card>
            <CardHeader className="bg-slate-50 py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Student Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col items-center gap-4">
              <div className="w-44 h-44 rounded-xl border bg-white flex items-center justify-center overflow-hidden shadow-inner">
                {(getDocByType('photo')) ? (
                  <div className="text-center space-y-2">
                    <div className="text-sm font-semibold text-green-700">Photo Uploaded ✅</div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openDoc(getDocByType('photo').file_path)}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Open
                    </Button>
                  </div>
                ) : <span className="text-sm text-gray-400">No Photo</span>}
              </div>
              <Label className="w-full cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md p-2 text-center text-sm transition-colors">
                Click to Upload Photo
                <Input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc("photo", f); }} />
              </Label>
            </CardContent>
          </Card>

          {/* Student Info Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="bg-purple-50 py-3">
              <CardTitle className="text-base text-purple-800">Student Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="border-b pb-1"><b>Admission No:</b> <span className="float-right text-slate-700">{student.admission_no}</span></div>
                <div className="border-b pb-1"><b>Name:</b> <span className="float-right font-bold text-slate-800">{student.name}</span></div>
                <div className="border-b pb-1"><b>Class:</b> <span className="float-right bg-purple-100 px-2 rounded text-purple-800 font-bold">{student.class} - {student.section}</span></div>
                <div className="border-b pb-1"><b>Father:</b> <span className="float-right text-slate-700">{student.father_name}</span></div>
                <div className="border-b pb-1"><b>Contact:</b> <span className="float-right font-mono text-slate-700">{student.contact}</span></div>
                <div className="border-b pb-1"><b>TC Status:</b> <span className={`float-right font-bold ${student.tc_submitted ? 'text-green-600' : 'text-red-500'}`}>{student.tc_submitted ? "Submitted" : "Pending"}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documents Grid with Open Buttons */}
      {student && (
        <Card className="relative z-10">
          <CardHeader className="bg-orange-50 py-3">
            <CardTitle className="text-base text-orange-800 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DOC_TYPES.map((d) => {
                const doc = getDocByType(d.key);
                const Icon = d.icon;
                
                return (
                  <div key={d.key} className="border rounded-xl p-3 bg-white space-y-3 hover:shadow-md transition-shadow">
                    <div className="font-semibold text-gray-700 text-sm flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-orange-600" />
                        {d.label}
                      </span>
                      {doc && (
                        <span className="text-green-600 text-xs bg-green-100 px-2 py-1 rounded-full font-bold">
                          Uploaded
                        </span>
                      )}
                    </div>
                    
                    {/* Show Open Button if uploaded, else show Upload */}
                    {doc ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 truncate" title={doc.file_name}>
                          {doc.file_name}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => openDoc(doc.file_path)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> Open Document
                        </Button>
                      </div>
                    ) : (
                      <Label className="cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md p-3 text-xs text-gray-500 hover:bg-gray-50 hover:border-orange-300 transition-colors">
                        <Upload className="h-4 w-4 mr-2"/> Click to Upload
                        <Input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(d.key, f); }} 
                        />
                      </Label>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploaded Documents List - Always Visible when student selected */}
      {student && documents.length > 0 && (
        <Card className="relative z-10 border-t-4 border-t-green-600">
          <CardHeader className="bg-green-50 py-3">
            <CardTitle className="text-base text-green-800 flex items-center gap-2">
              <FileCheck className="h-4 w-4" /> All Uploaded Documents ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {documents.map((doc, index) => {
                const docTypeInfo = DOC_TYPES.find(d => d.key === doc.doc_type);
                const Icon = docTypeInfo?.icon || FileText;
                
                return (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-green-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">
                          {docTypeInfo?.label || doc.doc_type}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={doc.file_name}>
                          {doc.file_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          Uploaded: {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-green-700 hover:text-green-800 hover:bg-green-100"
                      onClick={() => openDoc(doc.file_path)}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      </>
      )}
    </div>
  );
}