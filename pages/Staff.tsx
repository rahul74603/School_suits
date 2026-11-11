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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Users,
  Edit,
  Trash2,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  DollarSign,
  Calendar,
  FileText,
  Eye,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut } from "@/lib/api";

const DEPARTMENTS = ["Teaching", "Administration", "Accounts", "Support", "Transport", "Security"];
const DESIGNATIONS = ["Principal", "Vice Principal", "Teacher", "Accountant", "Clerk", "Librarian", "Driver", "Security Guard", "Peon", "Other"];
const STATUS_OPTIONS = ["Active", "Inactive", "On Leave", "Terminated"];

const DOC_TYPES = [
  { key: "resume", label: "Resume/CV" },
  { key: "certificate", label: "Educational Certificate" },
  { key: "id_proof", label: "ID Proof" },
  { key: "contract", label: "Employment Contract" },
  { key: "other", label: "Other Document" },
];

// --- REST adapter (Phase 3 Batch A) ---------------------------------------
// REST staff row camelCase hai: salary <- basicSalary, join_date <- joinDate,
// employee_id <- employeeId, status <- isActive (1 = Active, 0 = Inactive).
// father_name Batch A server fix me column bankar aa gaya. Documents
// staff table me nahi hain — Batch C se wo alag staff_documents table
// se aate hain aur View khulne par selectedStaff.documents me bhare
// jate hain (openView dekho).
function adaptStaffMember(m: any) {
  return {
    ...m,
    employee_id: m.employeeId,
    salary: m.basicSalary,
    father_name: m.fatherName || "",
    join_date: m.joinDate,
    status: m.isActive === 0 ? "Inactive" : "Active",
  };
}

export default function Staff() {
  const { toast } = useToast();
  
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    fatherName: "",
    designation: "",
    department: "",
    qualification: "",
    experience: "",
    contact: "",
    email: "",
    address: "",
    salary: "",
    joinDate: new Date().toISOString().split('T')[0],
    status: "Active",
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      // REST: GET /api/staff — server na search/status params leta hai,
      // na inactive staff deta hai (sirf active rows aati hain). Isliye
      // khoj aur status filter yahin client par lage hain; "Inactive /
      // On Leave / Terminated" chunne par list khali ayegi kyunki wo
      // rows server deta hi nahi (NOTES.md).
      const data = await apiGet<any[]>("/api/staff");
      let adapted = (data || []).map(adaptStaffMember);
      const q = search.trim().toLowerCase();
      if (q) {
        adapted = adapted.filter((s: any) =>
          s.name?.toLowerCase().includes(q) ||
          (s.employee_id || "").toLowerCase().includes(q) ||
          (s.contact || "").includes(search.trim())
        );
      }
      if (statusFilter !== "ALL") {
        adapted = adapted.filter((s: any) => s.status === statusFilter);
      }
      setStaffList(adapted);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load staff list", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, [search, statusFilter]);

  const resetForm = () => {
    setFormData({
      name: "",
      fatherName: "",
      designation: "",
      department: "",
      qualification: "",
      experience: "",
      contact: "",
      email: "",
      address: "",
      salary: "",
      joinDate: new Date().toISOString().split('T')[0],
      status: "Active",
    });
  };

  const handleAdd = async () => {
    try {
      // REST: POST /api/staff — salary -> basicSalary (number lazmi).
      // fatherName aur status server ke staff table me hain hi nahi,
      // isliye nahi bheje (NOTES.md).
      await apiPost("/api/staff", {
        name: formData.name,
        designation: formData.designation,
        department: formData.department,
        qualification: formData.qualification,
        experience: formData.experience,
        contact: formData.contact,
        email: formData.email,
        address: formData.address,
        basicSalary: parseInt(formData.salary) || 0,
        fatherName: formData.fatherName || undefined,
        joinDate: formData.joinDate,
      });
      toast({ title: "Success", description: "Staff member added successfully" });
      setIsAddOpen(false);
      resetForm();
      fetchStaff();
    } catch (e) {
      toast({ title: "Error", description: "Failed to add staff", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    try {
      // REST: PUT /api/staff/:id — status ka REST jawab sirf isActive
      // hai: Active -> 1, Inactive -> 0. "On Leave"/"Terminated" ka koi
      // jawab nahi, un par isActive bhejte hi nahi (purani value rehti hai).
      await apiPut(`/api/staff/${selectedStaff.id}`, {
        name: formData.name,
        designation: formData.designation,
        department: formData.department,
        qualification: formData.qualification,
        experience: formData.experience,
        contact: formData.contact,
        email: formData.email,
        address: formData.address,
        basicSalary: parseInt(formData.salary) || 0,
        fatherName: formData.fatherName || undefined,
        joinDate: formData.joinDate,
        ...(formData.status === "Active"
          ? { isActive: 1 }
          : formData.status === "Inactive"
            ? { isActive: 0 }
            : {}),
      });
      toast({ title: "Success", description: "Staff updated successfully" });
      setIsEditOpen(false);
      fetchStaff();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update staff", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      // REST: staff ke liye DELETE route hai hi nahi — server ka tareeka
      // POST /api/staff/:id/deactivate hai (soft delete: record rehta hai,
      // list se gayab ho jata hai). AUDIT.md ka "DELETE /api/staff/:id"
      // likhna galat tha, asal route yahi hai.
      await apiPost(`/api/staff/${selectedStaff.id}/deactivate`);
      toast({ title: "Success", description: "Staff deleted successfully" });
      setIsDeleteOpen(false);
      fetchStaff();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete staff", variant: "destructive" });
    }
  };

  const openEdit = (staff: any) => {
    setSelectedStaff(staff);
    setFormData({
      name: staff.name || "",
      fatherName: staff.father_name || "",
      designation: staff.designation || "",
      department: staff.department || "",
      qualification: staff.qualification || "",
      experience: staff.experience || "",
      contact: staff.contact || "",
      email: staff.email || "",
      address: staff.address || "",
      salary: staff.salary?.toString() || "",
      joinDate: staff.join_date || "",
      status: staff.status || "Active",
    });
    setIsEditOpen(true);
  };

  const openView = async (staff: any) => {
    // REST (Batch C): documents staff_documents table se aate hain —
    // View khulne par is staff ke documents laakar purane IPC wale
    // shape (JSON string: [{type, fileName, filePath, uploadedAt}])
    // me selectedStaff.documents me bharte hain, taaki dialog ka code
    // bilkul pehle jaisa chale. filePath asal local path nahi —
    // "sgstaffdoc:<id>" token hai jisse openStaffDocument file mangta hai.
    let docsJson = "[]";
    try {
      const docs = await apiGet<any[]>(`/api/staff/${staff.id}/documents`);
      docsJson = JSON.stringify((docs || []).map((d: any) => ({
        type: d.docType,
        fileName: d.fileName,
        filePath: `sgstaffdoc:${d.id}`,
        uploadedAt: d.createdAt,
      })));
    } catch (e) { /* documents na aaye to dialog khali documents ke saath khulega */ }
    setSelectedStaff({ ...staff, documents: docsJson });
    setIsViewOpen(true);
  };

  const openStaffDocument = async (filePath: string) => {
    try {
      // REST: file ka content /file endpoint se aata hai aur blob URL
      // se khulta hai (web/Android par yahi tareeka; na khule to
      // download ho jata hai).
      const docId = String(filePath || "").replace("sgstaffdoc:", "");
      if (!selectedStaff?.id || !docId) return;
      const file = await apiGet<any>(`/api/staff/${selectedStaff.id}/documents/${docId}/file`);
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
    } catch (e) {
      toast({ title: "Error", description: "Failed to open document", variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800 border-green-300";
      case "Inactive": return "bg-gray-100 text-gray-800 border-gray-300";
      case "On Leave": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Terminated": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const uploadDoc = async (docType: string, file: File) => {
    if (!selectedStaff?.id) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result?.toString() || "").split(",")[1];
        // REST (Batch C): POST /api/staff/:id/documents — file
        // content base64 me jata hai (server limit ~2MB). Upload ke
        // baad list ke saath khule hue View dialog ke documents bhi
        // taaza karte hain (openView dobara documents laata hai).
        await apiPost(`/api/staff/${selectedStaff.id}/documents`, {
          docType,
          fileName: file.name,
          base64Data: base64,
          mimeType: file.type || undefined,
        });
        toast({ title: "Uploaded", description: "Document uploaded successfully" });
        fetchStaff();
        openView(selectedStaff);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <Users className="h-8 w-8 text-blue-600" /> Staff Management
          </h1>
          <p className="text-gray-500 mt-1">Manage teachers and support staff</p>
        </div>

        <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Add Staff
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] sm:min-w-[300px]">
              <Label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Search Staff</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Name, Employee ID, Contact..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* FIXED: Status Dropdown with proper z-index and background */}
            <div className="w-[200px] relative z-50">
              <Label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  <SelectItem value="ALL">All Status</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={fetchStaff} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
<Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-bold">Employee ID</TableHead>
              <TableHead className="font-bold">Name</TableHead>
              <TableHead className="font-bold">Designation</TableHead>
              <TableHead className="font-bold">Department</TableHead>
              <TableHead className="font-bold">Contact</TableHead>
              <TableHead className="font-bold">Salary</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffList.length > 0 ? (
              staffList.map((staff) => (
                <TableRow key={staff.id} className="hover:bg-slate-50">
                  <TableCell className="font-mono font-bold text-blue-600">{staff.employee_id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-xs text-gray-500">{staff.father_name}</div>
                  </TableCell>
                  <TableCell>{staff.designation}</TableCell>
                  <TableCell>{staff.department}</TableCell>
                  <TableCell>
                    <div className="text-sm">{staff.contact}</div>
                    <div className="text-xs text-gray-500">{staff.email}</div>
                  </TableCell>
                  <TableCell>₹{staff.salary?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(staff.status)}>
                      {staff.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openView(staff)}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(staff)}>
                        <Edit className="h-4 w-4 text-orange-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedStaff(staff); setIsDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                  {loading ? "Loading..." : "No staff members found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
</div>
      </Card>

      {/* Add Staff Dialog - FIXED DROPDOWNS */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Add New Staff
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Enter name" />
            </div>
            <div className="space-y-2">
              <Label>Father&apos;s/Husband&apos;s Name</Label>
              <Input value={formData.fatherName} onChange={(e) => setFormData({...formData, fatherName: e.target.value})} placeholder="Enter father's name" />
            </div>
            
            {/* FIXED: Designation Dropdown */}
            <div className="space-y-2 relative z-[100]">
              <Label>Designation *</Label>
              <Select value={formData.designation} onValueChange={(v) => setFormData({...formData, designation: v})}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200 max-h-[200px]">
                  {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* FIXED: Department Dropdown */}
            <div className="space-y-2 relative z-[100]">
              <Label>Department *</Label>
              <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Qualification</Label>
              <Input value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} placeholder="e.g., M.A., B.Ed." />
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <Input value={formData.experience} onChange={(e) => setFormData({...formData, experience: e.target.value})} placeholder="e.g., 5 years" />
            </div>
            <div className="space-y-2">
              <Label>Contact Number *</Label>
              <Input value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} placeholder="Enter mobile number" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Enter email address" />
            </div>
            <div className="space-y-2">
              <Label>Salary (Monthly) *</Label>
              <Input type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} placeholder="Enter salary amount" />
            </div>
            <div className="space-y-2">
              <Label>Join Date *</Label>
              <Input type="date" value={formData.joinDate} onChange={(e) => setFormData({...formData, joinDate: e.target.value})} />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Enter full address" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700" disabled={!formData.name || !formData.designation}>
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog - FIXED DROPDOWNS */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" /> Edit Staff
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Father&apos;s/Husband&apos;s Name</Label>
              <Input value={formData.fatherName} onChange={(e) => setFormData({...formData, fatherName: e.target.value})} />
            </div>

            {/* FIXED: Designation Dropdown */}
            <div className="space-y-2 relative z-[100]">
              <Label>Designation</Label>
              <Select value={formData.designation} onValueChange={(v) => setFormData({...formData, designation: v})}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200 max-h-[200px]">
                  {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* FIXED: Department Dropdown */}
            <div className="space-y-2 relative z-[100]">
              <Label>Department</Label>
              <Select value={formData.department} onValueChange={(v) => setFormData({...formData, department: v})}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Qualification</Label>
              <Input value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <Input value={formData.experience} onChange={(e) => setFormData({...formData, experience: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Salary (Monthly)</Label>
              <Input type="number" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} />
            </div>

            {/* FIXED: Status Dropdown */}
            <div className="space-y-2 relative z-[100]">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} className="bg-orange-600 hover:bg-orange-700">Update Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Staff Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          
          {selectedStaff && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">{selectedStaff.name}</h3>
                    <p className="text-gray-500">{selectedStaff.employee_id}</p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(selectedStaff.status)}>
                    {selectedStaff.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{selectedStaff.designation}</span>
                  <span className="text-gray-400">|</span>
                  <span>{selectedStaff.department}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-gray-400" />
                  <span>{selectedStaff.qualification || "N/A"}</span>
                  <span className="text-gray-400">|</span>
                  <span>{selectedStaff.experience || "N/A"} exp</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{selectedStaff.contact}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{selectedStaff.email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span>₹{selectedStaff.salary?.toLocaleString()}/month</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Joined: {selectedStaff.join_date}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>{selectedStaff.address || "N/A"}</span>
                </div>
              </div>

              {/* Documents Section */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Documents
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {DOC_TYPES.map((doc) => {
                    const uploadedDocs = selectedStaff.documents ? JSON.parse(selectedStaff.documents) : [];
                    const hasDoc = uploadedDocs.find((d: any) => d.type === doc.key);
                    
                    return (
                      <div key={doc.key} className="border rounded p-3 flex items-center justify-between bg-white">
                        <span className="text-sm font-medium">{doc.label}</span>
                        {hasDoc ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Uploaded</span>
                            {/* REST (Batch C): file server se blob bankar khulti hai — openStaffDocument dekho. */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openStaffDocument(hasDoc.filePath)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Label className="cursor-pointer">
                            <Upload className="h-4 w-4 text-gray-400 hover:text-blue-600" />
                            <Input 
                              type="file" 
                              className="hidden" 
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(doc.key, f); }} 
                            />
                          </Label>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedStaff.documents && JSON.parse(selectedStaff.documents).length > 0 && (
                  <div className="bg-gray-50 rounded p-3">
                    <h5 className="text-sm font-bold mb-2">All Uploaded Files</h5>
                    <div className="space-y-2">
                      {JSON.parse(selectedStaff.documents).map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                          <span className="truncate flex-1">{doc.fileName}</span>
                          {/* REST (Batch C): openStaffDocument se khulta hai. */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openStaffDocument(doc.filePath)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete Staff
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedStaff?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}