import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut, apiDel } from "@/lib/api";
import {
  Settings,
  School,
  Bus,
  Receipt,
  CreditCard,
  Save,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Printer,
  FileText
} from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("school");

  // School ki id page ke state me nahi hoti; PUT /api/schools/:id ke
  // liye load ke samay branding jawab se yahan rakh li jati hai.
  const schoolIdRef = useRef<number | null>(null);

  // REST fee structure camelCase hai; page snake_case padhta hai.
  // Server par annual fee ka alag column nahi hai — `otherFee` hi
  // uski jagah hai (NOTES.md me flag kiya hai).
  const adaptFeeStructure = (f: any) => ({
    ...f,
    class_name: f.class,
    monthly_fee: f.monthlyFee,
    admission_fee: f.admissionFee,
    exam_fee: f.examFee,
    annual_fee: f.otherFee,
  });

  // School Info State
  const [schoolInfo, setSchoolInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    session: "2026-27",
    adm_prefix: "KPS",
    adm_year: "2026",
    adm_start: 1,
  });

  // Fee Master State
  const [feeMaster, setFeeMaster] = useState<any[]>([]);
  
  // Transport Routes State
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  
  // Additional Fees State
  const [additionalFees, setAdditionalFees] = useState<any[]>([]);

  // Dialog States
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isTransportDialogOpen, setIsTransportDialogOpen] = useState(false);
  const [isAdditionalFeeDialogOpen, setIsAdditionalFeeDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [editingTransport, setEditingTransport] = useState<any>(null);

  // Form States
  const [feeForm, setFeeForm] = useState({
    class_name: "",
    monthly_fee: "",
    admission_fee: "",
    exam_fee: "",
    annual_fee: "",
  });

  const [transportForm, setTransportForm] = useState({
    route_name: "",
    amount: "",
  });

  const [additionalFeeForm, setAdditionalFeeForm] = useState({
    class_name: "",
    fee_name: "",
    amount: "",
    due_month: "",
  });

  // Load All Data
  const loadData = async () => {
    setLoading(true);
    try {
      // Load School Info
      // REST: GET /api/branding — login wale user ke apne school ki
      // row. Adapter: page adm_prefix/adm_year/adm_start padhta hai,
      // server admissionPrefix/admissionYear/admissionStart deta hai.
      const school = await apiGet<any>("/api/branding");
      if (school) {
        schoolIdRef.current = school.id;
        setSchoolInfo({
          name: school.name ?? "",
          address: school.address ?? "",
          phone: school.phone ?? "",
          email: school.email ?? "",
          session: school.session ?? "",
          adm_prefix: school.admissionPrefix ?? "",
          adm_year: school.admissionYear ?? "",
          adm_start: school.admissionStart ?? 1,
        });
      }

      // Load Fee Master
      // REST: GET /api/fee-structures
      const fees = await apiGet<any[]>("/api/fee-structures");
      setFeeMaster((fees || []).map(adaptFeeStructure));

      // Load Transport
      // REST: GET /api/transport-routes (route_name <- routeName)
      const routes = await apiGet<any[]>("/api/transport-routes");
      setTransportRoutes(
        (routes || []).map((r) => ({ ...r, route_name: r.routeName }))
      );

      // Load Additional Fees
      // REST: GET /api/additional-fees
      const addFees = await apiGet<any[]>("/api/additional-fees");
      setAdditionalFees(
        (addFees || []).map((f) => ({
          ...f,
          class_name: f.class,
          fee_name: f.feeName,
          due_month: f.dueMonth ?? "",
        }))
      );
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load settings", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save School Info
  const saveSchoolInfo = async () => {
    try {
      // REST: PUT /api/schools/:id — sirf principal (apna school)
      // ya super_admin. Body camelCase me map kiya hai; logo/colors
      // page ke state me hain hi nahi, aur PUT partial hai isliye
      // server par wo waise ke waise bane rehte hain.
      if (!schoolIdRef.current) throw new Error("School not loaded");
      await apiPut(`/api/schools/${schoolIdRef.current}`, {
        name: schoolInfo.name,
        address: schoolInfo.address,
        phone: schoolInfo.phone,
        email: schoolInfo.email || undefined,
        session: schoolInfo.session || undefined,
        admissionPrefix: schoolInfo.adm_prefix || undefined,
        admissionYear: schoolInfo.adm_year || undefined,
        admissionStart: schoolInfo.adm_start,
      });
      toast({ title: "Success", description: "School information saved successfully" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save school info", variant: "destructive" });
    }
  };

  // Save Fee Master
  const saveFee = async () => {
    try {
      if (editingFee) {
        // REST: PUT /api/fee-structures/:id — IPC className se
        // dhundta tha, REST id se update karta hai (editingFee.id
        // adapter me barkaraar hai). annual_fee -> otherFee.
        await apiPut(`/api/fee-structures/${editingFee.id}`, {
          class: feeForm.class_name,
          monthlyFee: parseInt(feeForm.monthly_fee) || 0,
          admissionFee: parseInt(feeForm.admission_fee) || 0,
          examFee: parseInt(feeForm.exam_fee) || 0,
          otherFee: parseInt(feeForm.annual_fee) || 0,
        });
      }
      toast({ title: "Success", description: "Fee structure saved" });
      setIsFeeDialogOpen(false);
      setEditingFee(null);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save fee", variant: "destructive" });
    }
  };

  // Add Transport Route
  const addTransport = async () => {
    try {
      // REST: POST /api/transport-routes { routeName, amount }
      await apiPost("/api/transport-routes", {
        routeName: transportForm.route_name,
        amount: parseInt(transportForm.amount) || 0,
      });
      toast({ title: "Success", description: "Transport route added" });
      setIsTransportDialogOpen(false);
      setTransportForm({ route_name: "", amount: "" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to add transport", variant: "destructive" });
    }
  };

  // Delete Transport
  const deleteTransport = async (id: number) => {
    try {
      // REST: DELETE /api/transport-routes/:id (sirf principal)
      await apiDel(`/api/transport-routes/${id}`);
      toast({ title: "Success", description: "Transport route deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete transport", variant: "destructive" });
    }
  };

  // Add Additional Fee
  const addAdditionalFee = async () => {
    try {
      // REST: POST /api/additional-fees — dueMonth khali ho to
      // bhejte hi nahi (server use optional manta hai, "" reject
      // kar deta hai).
      await apiPost("/api/additional-fees", {
        class: additionalFeeForm.class_name,
        feeName: additionalFeeForm.fee_name,
        amount: parseInt(additionalFeeForm.amount) || 0,
        dueMonth: additionalFeeForm.due_month || undefined,
      });
      toast({ title: "Success", description: "Additional fee added" });
      setIsAdditionalFeeDialogOpen(false);
      setAdditionalFeeForm({ class_name: "", fee_name: "", amount: "", due_month: "" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to add fee", variant: "destructive" });
    }
  };

  // Delete Additional Fee
  const deleteAdditionalFee = async (id: number) => {
    try {
      // REST: DELETE /api/additional-fees/:id
      await apiDel(`/api/additional-fees/${id}`);
      toast({ title: "Success", description: "Additional fee deleted" });
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete fee", variant: "destructive" });
    }
  };

  // Open Edit Fee Dialog
  const openEditFee = (fee: any) => {
    setEditingFee(fee);
    setFeeForm({
      class_name: fee.class_name,
      monthly_fee: fee.monthly_fee?.toString() || "",
      admission_fee: fee.admission_fee?.toString() || "",
      exam_fee: fee.exam_fee?.toString() || "",
      annual_fee: fee.annual_fee?.toString() || "",
    });
    setIsFeeDialogOpen(true);
  };

  const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
  const classes = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <Settings className="h-8 w-8 text-blue-600" /> Settings
          </h1>
          <p className="text-gray-500 mt-1">Manage school configuration and fee structures</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="school" className="flex items-center gap-2">
            <School className="h-4 w-4" /> School Info
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Fee Structure
          </TabsTrigger>
          <TabsTrigger value="transport" className="flex items-center gap-2">
            <Bus className="h-4 w-4" /> Transport
          </TabsTrigger>
          <TabsTrigger value="additional" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Additional Fees
          </TabsTrigger>
        </TabsList>

        {/* School Info Tab */}
        <TabsContent value="school" className="space-y-4">
          <Card className="border-t-4 border-t-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" /> School Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>School Name *</Label>
                  <Input 
                    value={schoolInfo.name} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, name: e.target.value})}
                    placeholder="Enter school name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={schoolInfo.email} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, email: e.target.value})}
                    placeholder="school@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={schoolInfo.phone} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, phone: e.target.value})}
                    placeholder="Contact number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Session</Label>
                  <Input 
                    value={schoolInfo.session} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, session: e.target.value})}
                    placeholder="e.g., 2026-27"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admission Prefix</Label>
                  <Input 
                    value={schoolInfo.adm_prefix} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, adm_prefix: e.target.value})}
                    placeholder="e.g., KPS"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Admission Year</Label>
                  <Input 
                    value={schoolInfo.adm_year} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, adm_year: e.target.value})}
                    placeholder="e.g., 2026"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Address</Label>
                  <Input 
                    value={schoolInfo.address} 
                    onChange={(e) => setSchoolInfo({...schoolInfo, address: e.target.value})}
                    placeholder="Full address"
                  />
                </div>
              </div>
              <Button onClick={saveSchoolInfo} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-2" /> Save School Info
              </Button>
            </CardContent>
          </Card>

          {/* Admit Card Format Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Admit Card Format Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50 text-center">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">{schoolInfo.name || "School Name"}</h3>
                  <p className="text-sm text-gray-600">{schoolInfo.address || "School Address"}</p>
                  <p className="text-sm text-gray-600">Phone: {schoolInfo.phone || "N/A"}</p>
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-lg font-semibold">ADMIT CARD</p>
                    <p className="text-sm text-gray-500">Session: {schoolInfo.session}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fee Structure Tab */}
        <TabsContent value="fees" className="space-y-4">
          <Card className="border-t-4 border-t-green-600">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Class-wise Fee Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Admission Fee</TableHead>
                    <TableHead>Exam Fee</TableHead>
                    <TableHead>Annual Fee</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeMaster.length > 0 ? (
                    feeMaster.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">Class {fee.class_name}</TableCell>
                        <TableCell>₹{fee.monthly_fee?.toLocaleString() || 0}</TableCell>
                        <TableCell>₹{fee.admission_fee?.toLocaleString() || 0}</TableCell>
                        <TableCell>₹{fee.exam_fee?.toLocaleString() || 0}</TableCell>
                        <TableCell>₹{fee.annual_fee?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditFee(fee)}>
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No fee structure found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transport Tab */}
        <TabsContent value="transport" className="space-y-4">
          <Card className="border-t-4 border-t-orange-600">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bus className="h-5 w-5" /> Bus Routes & Charges
              </CardTitle>
              <Button onClick={() => setIsTransportDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Route
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Route Name</TableHead>
                    <TableHead>Monthly Charge</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transportRoutes.length > 0 ? (
                    transportRoutes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell className="font-medium">{route.route_name}</TableCell>
                        <TableCell>₹{route.amount?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteTransport(route.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                        No transport routes found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Additional Fees Tab */}
        <TabsContent value="additional" className="space-y-4">
          <Card className="border-t-4 border-t-purple-600">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Additional/Optional Fees
              </CardTitle>
              <Button onClick={() => setIsAdditionalFeeDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Add Fee
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Fee Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Month</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {additionalFees.length > 0 ? (
                    additionalFees.map((fee) => (
                      <TableRow key={fee.id}>
                        <TableCell>Class {fee.class_name}</TableCell>
                        <TableCell className="font-medium">{fee.fee_name}</TableCell>
                        <TableCell>₹{fee.amount?.toLocaleString()}</TableCell>
                        <TableCell>{fee.due_month}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteAdditionalFee(fee.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No additional fees found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Fee Dialog */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Structure - Class {feeForm.class_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Monthly Fee</Label>
              <Input 
                type="number"
                value={feeForm.monthly_fee} 
                onChange={(e) => setFeeForm({...feeForm, monthly_fee: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Admission Fee</Label>
              <Input 
                type="number"
                value={feeForm.admission_fee} 
                onChange={(e) => setFeeForm({...feeForm, admission_fee: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Exam Fee</Label>
              <Input 
                type="number"
                value={feeForm.exam_fee} 
                onChange={(e) => setFeeForm({...feeForm, exam_fee: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Annual Fee</Label>
              <Input 
                type="number"
                value={feeForm.annual_fee} 
                onChange={(e) => setFeeForm({...feeForm, annual_fee: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveFee} className="bg-green-600 hover:bg-green-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transport Dialog */}
      <Dialog open={isTransportDialogOpen} onOpenChange={setIsTransportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transport Route</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Route Name</Label>
              <Input 
                value={transportForm.route_name} 
                onChange={(e) => setTransportForm({...transportForm, route_name: e.target.value})}
                placeholder="e.g., City Route, Village Route"
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Charge (₹)</Label>
              <Input 
                type="number"
                value={transportForm.amount} 
                onChange={(e) => setTransportForm({...transportForm, amount: e.target.value})}
                placeholder="Enter amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransportDialogOpen(false)}>Cancel</Button>
            <Button onClick={addTransport} className="bg-orange-600 hover:bg-orange-700">Add Route</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Additional Fee Dialog */}
      <Dialog open={isAdditionalFeeDialogOpen} onOpenChange={setIsAdditionalFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Additional Fee</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={additionalFeeForm.class_name}
                onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, class_name: e.target.value})}
              >
                <option value="">Select Class</option>
                {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fee Name</Label>
              <Input 
                value={additionalFeeForm.fee_name} 
                onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, fee_name: e.target.value})}
                placeholder="e.g., Computer Fee, Lab Fee"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number"
                value={additionalFeeForm.amount} 
                onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, amount: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Month</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={additionalFeeForm.due_month}
                onChange={(e) => setAdditionalFeeForm({...additionalFeeForm, due_month: e.target.value})}
              >
                <option value="">Select Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdditionalFeeDialogOpen(false)}>Cancel</Button>
            <Button onClick={addAdditionalFee} className="bg-purple-600 hover:bg-purple-700">Add Fee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}