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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Search, Bus, FilterX, RefreshCw, GraduationCap, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPut } from "@/lib/api";

export default function Students() {
  const { toast } = useToast();
  
  // 🟢 Filter States
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  // Reset Button
  const handleReset = () => {
      setSearch("");
      setClassFilter("ALL");
      setSectionFilter("ALL");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
          <GraduationCap className="h-8 w-8 text-blue-600" /> Students Directory
        </h1>

        <Button onClick={fetchStudents} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh List
        </Button>
      </div>

      {/* 🟢 FILTER CARD */}
      <Card className="border-t-4 border-t-blue-600 shadow-sm overflow-visible">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-4 items-end relative z-20">
            
            {/* Search Box */}
            <div className="flex-1 min-w-[250px] space-y-1">
                <Label className="text-xs font-bold text-gray-500 uppercase">Search Student</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Name, Adm No, Mobile..."
                    className="pl-9 bg-white"
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
          <div className="rounded-md border bg-white relative z-10">
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
                {students.length > 0 ? (
                  students.map((s: any) => (
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
                        <Button variant="ghost" size="sm" onClick={() => openTransportDialog(s)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                          <Bus className="h-4 w-4 mr-1" /> Edit Bus
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                        {loading ? "Searching..." : "No students found matching filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}