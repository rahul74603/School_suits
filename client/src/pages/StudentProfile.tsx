import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  FileX
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

  const [admNo, setAdmNo] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");

  const [student, setStudent] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const loadFullStudent = async (admissionNo: string) => {
    const s = await (window as any).electronAPI.invoke("get-student-by-admno", admissionNo);

    if (!s) {
      setStudent(null);
      setDocuments([]);
      toast({ title: "Not Found", description: "No student found." });
      return;
    }

    setStudent(s);
    const docs = await (window as any).electronAPI.invoke("get-student-documents", s.id);
    setDocuments(docs || []);
    setSuggestions([]);
    toast({ title: "Success", description: `Student loaded: ${s.name}` });
  };

  const fetchStudent = async (admNoToSearch?: string) => {
    const finalInput = (admNoToSearch || admNo || "").trim();
    setLoading(true);

    try {
      const list = await (window as any).electronAPI.invoke("get-students", {
        search: finalInput,
        classStr: classFilter === "ALL" ? null : classFilter,
        section: sectionFilter === "ALL" ? null : sectionFilter,
      });

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
        const list = await (window as any).electronAPI.invoke("get-students", {
            search: q,
            classStr: classFilter === "ALL" ? null : classFilter,
            section: sectionFilter === "ALL" ? null : sectionFilter,
        });

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
    const docs = await (window as any).electronAPI.invoke("get-student-documents", student.id);
    setDocuments(docs || []);
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
      await (window as any).electronAPI.invoke("upload-student-document", {
        studentId: student.id, admissionNo: student.admission_no, docType, fileName: file.name, base64Data,
      });
      toast({ title: "Uploaded", description: "File uploaded successfully." });
      await refreshDocs();
    } catch (e) { 
      toast({ title: "Error", description: "Upload failed.", variant: "destructive" }); 
    }
  };

  const openDoc = async (filePath: string) => {
    try {
      const res = await (window as any).electronAPI.invoke("open-student-document", filePath);
      if (!res?.success) toast({ title: "Error", description: "File not found", variant: "destructive" });
    } catch (e) { 
      toast({ title: "Error", description: "Failed to open", variant: "destructive" }); 
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800">
          <UserCircle2 className="h-8 w-8 text-blue-600" /> Student Profile
        </h1>
        <Button variant="outline" size="sm" onClick={resetFilters}>
            <FilterX className="h-4 w-4 mr-2"/> Reset Search
        </Button>
      </div>

      {/* SEARCH BAR & FILTERS */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm overflow-visible">
        <CardHeader className="bg-blue-50 py-3">
          <CardTitle className="text-base text-blue-800">Find Student</CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-3 relative z-20">
          <div className="flex flex-wrap gap-4 items-end">
            
            <div className="flex-1 min-w-[200px] space-y-1 relative z-30">
              <Label>Search (Name / Adm No / Mobile)</Label>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    value={admNo}
                    onChange={(e) => setAdmNo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") fetchStudent(); }}
                    placeholder="Type to search..."
                    className="pl-9 font-bold"
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
    </div>
  );
}