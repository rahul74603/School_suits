import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiDel } from "@/lib/api";
import {
  IndianRupee,
  Plus,
  Trash2,
  History,
  CreditCard,
  Wallet,
  CheckCircle,
  AlertCircle,
  Download
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PAYMENT_MODES = ["Cash", "Bank Transfer", "Cheque", "UPI"];

interface Staff {
  id: number;
  employee_id: string;
  name: string;
  designation: string;
  salary: number;
  status: string;
}

interface SalaryPayment {
  id: number;
  staff_id: number;
  staff_name: string;
  employee_id: string;
  month: string;
  year: number;
  base_salary: number;
  bonus: number;
  deduction: number;
  net_amount: number;
  payment_date: string;
  payment_mode: string;
  remarks: string;
}

export default function StaffSalary() {
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  
  const [paymentForm, setPaymentForm] = useState({
    bonus: "0",
    deduction: "0",
    paymentMode: "Cash",
    remarks: ""
  });

  // Payment rows me staff_name/base_salary bharne ke liye staff ka
  // map (REST payments join karke nahi deta — Batch A wala pattern).
  const staffById = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    fetchStaff();
    fetchSalaryHistory();
  }, [selectedMonth, selectedYear]);

  const fetchStaff = async () => {
    try {
      // REST: GET /api/staff — server saare (active + inactive) deta
      // hai; is page ko sirf Active chahiye, filter yahin laga hai.
      // Adapter (Batch A jaisa): salary <- basicSalary,
      // employee_id <- employeeId, status <- isActive.
      // NOTE: salary fields sirf principal/accountant ko milte hain
      // (server ki neeti) — baaki roles par salary khali ayegi.
      const data = await apiGet<any[]>("/api/staff");
      const adapted = (data || [])
        .map((m) => ({
          ...m,
          employee_id: m.employeeId,
          salary: m.basicSalary,
          status: m.isActive === 0 ? "Inactive" : "Active",
        }))
        .filter((s) => s.status === "Active");
      staffById.current = new Map(adapted.map((s) => [s.id, s]));
      setStaffList(adapted);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load staff", variant: "destructive" });
    }
  };

  const fetchSalaryHistory = async () => {
    try {
      // REST: GET /api/salary-payments?month=&year=
      const data = await apiGet<any[]>(
        `/api/salary-payments?month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}`
      );
      // Adapter: page snake_case padhta hai. Server sirf ek `amount`
      // (net) deta hai — base/bonus/deduction ka split server par hai
      // hi nahi (SERVER-GAPS.md); page render me sirf net_amount,
      // staff_id aur id istemal hote hain. staff_name/base_salary
      // staff map se bhare hain (map khali ho to defaults).
      const adapted = (data || []).map((p) => {
        const st = staffById.current.get(p.staffId);
        return {
          ...p,
          staff_id: p.staffId,
          staff_name: st?.name ?? "",
          employee_id: st?.employee_id ?? "",
          base_salary: st?.salary ?? p.amount,
          bonus: 0,
          deduction: 0,
          net_amount: p.amount,
          payment_date: p.paymentDate ?? "",
          payment_mode: "",
        };
      });
      setSalaryHistory(adapted);
    } catch (e) {
      console.error("Failed to load salary history", e);
    }
  };

  const getPaidStaffIds = () => {
    return salaryHistory.map(p => p.staff_id);
  };

  const openPayDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    setPaymentForm({
      bonus: "0",
      deduction: "0",
      paymentMode: "Cash",
      remarks: ""
    });
    setIsPayDialogOpen(true);
  };

  const openHistoryDialog = (staff: Staff) => {
    setSelectedStaff(staff);
    fetchStaffSalaryHistory(staff.id);
    setIsHistoryDialogOpen(true);
  };

  const fetchStaffSalaryHistory = async (staffId: number) => {
    try {
      // REST: GET /api/staff/:id/salary-history
      const data = await apiGet<any[]>(`/api/staff/${staffId}/salary-history`);
      // Will be used in dialog
    } catch (e) {
      console.error("Failed to load staff history", e);
    }
  };

  const handlePaySalary = async () => {
    if (!selectedStaff) return;

    const baseSalary = selectedStaff.salary;
    const bonus = parseInt(paymentForm.bonus) || 0;
    const deduction = parseInt(paymentForm.deduction) || 0;
    const netAmount = baseSalary + bonus - deduction;

    // Duplicate guard: IPC dobara payment par "SALARY_ALREADY_PAID"
    // deta tha; REST par aisa server check abhi nahi hai
    // (SERVER-GAPS.md) — is mahine ki loaded history se yahin roka
    // hai taaki wahi toast chale jo page pehle dikhata tha.
    if (salaryHistory.some((p) => p.staff_id === selectedStaff.id)) {
      toast({ title: "Error", description: "Salary already paid for this month", variant: "destructive" });
      return;
    }

    try {
      // REST: POST /api/salary-payments — server ke paas bonus /
      // deduction / payment-mode ke columns nahi hain (SERVER-GAPS.md).
      // Net rakam `amount` me jati hai aur pura breakup remarks me
      // mehfooz rehta hai, taaki koi hisaab khoye nahi.
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const breakup = [
        paymentForm.paymentMode ? `Mode: ${paymentForm.paymentMode}` : "",
        bonus ? `Bonus: +₹${bonus}` : "",
        deduction ? `Deduction: -₹${deduction}` : "",
        paymentForm.remarks || "",
      ].filter(Boolean).join(" | ");
      await apiPost("/api/salary-payments", {
        staffId: selectedStaff.id,
        month: selectedMonth,
        year: selectedYear,
        amount: netAmount,
        paymentDate: today,
        remarks: breakup || undefined,
      });

      toast({ title: "Success", description: `Salary paid to ${selectedStaff.name}` });
      setIsPayDialogOpen(false);
      fetchSalaryHistory();
    } catch (e: any) {
      if (e.message === "SALARY_ALREADY_PAID") {
        toast({ title: "Error", description: "Salary already paid for this month", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to pay salary", variant: "destructive" });
      }
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Delete this salary payment record?")) return;
    
    try {
      // REST: DELETE /api/salary-payments/:id
      await apiDel(`/api/salary-payments/${paymentId}`);
      toast({ title: "Success", description: "Payment record deleted" });
      fetchSalaryHistory();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const getTotalSalaryPaid = () => {
    return salaryHistory.reduce((sum, p) => sum + p.net_amount, 0);
  };

  const getTotalPending = () => {
    const paidIds = getPaidStaffIds();
    const pendingStaff = staffList.filter(s => !paidIds.includes(s.id));
    return pendingStaff.reduce((sum, s) => sum + s.salary, 0);
  };

  // Calculate net amount for display
  const calculateNetAmount = () => {
    if (!selectedStaff) return 0;
    const base = selectedStaff.salary;
    const bonus = parseInt(paymentForm.bonus || "0") || 0;
    const deduction = parseInt(paymentForm.deduction || "0") || 0;
    return base + bonus - deduction;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800">
            <IndianRupee className="h-8 w-8 text-green-600" /> Staff Salary
          </h1>
          <p className="text-gray-500 mt-1">Manage staff salaries and payments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-2xl font-bold text-green-700">₹{getTotalSalaryPaid().toLocaleString()}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-orange-700">₹{getTotalPending().toLocaleString()}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Staff</p>
                <p className="text-2xl font-bold text-blue-700">{staffList.length}</p>
              </div>
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Paid Count</p>
                <p className="text-2xl font-bold text-purple-700">{salaryHistory.length}</p>
              </div>
              <CreditCard className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-[200px]">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999]">
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label>Year</Label>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999]">
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Salary Status - {selectedMonth} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
<Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Base Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList.map((staff) => {
                const isPaid = getPaidStaffIds().includes(staff.id);
                const payment = salaryHistory.find(p => p.staff_id === staff.id);
                
                return (
                  <TableRow key={staff.id}>
                    <TableCell className="font-mono text-sm">{staff.employee_id}</TableCell>
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.designation}</TableCell>
                    <TableCell>₹{staff.salary.toLocaleString()}</TableCell>
                    <TableCell>
                      {isPaid ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                          Paid {payment?.net_amount !== staff.salary && `(₹${payment?.net_amount.toLocaleString()})`}
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">
                          Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!isPaid ? (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openPayDialog(staff)}
                          >
                            <IndianRupee className="h-4 w-4 mr-1" /> Pay
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeletePayment(payment!.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openHistoryDialog(staff)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
</div>
        </CardContent>
      </Card>

      {/* Pay Salary Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-md bg-white z-[9999]">
          <DialogHeader>
            <DialogTitle>Pay Salary - {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Base Salary:</span>
                <span className="font-medium">₹{selectedStaff?.salary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Net Amount:</span>
                <span className="text-green-600">
                  ₹{calculateNetAmount().toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Bonus</Label>
                <Input
                  type="number"
                  value={paymentForm.bonus}
                  onChange={(e) => setPaymentForm({...paymentForm, bonus: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Deduction</Label>
                <Input
                  type="number"
                  value={paymentForm.deduction}
                  onChange={(e) => setPaymentForm({...paymentForm, deduction: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label>Payment Mode</Label>
              <Select 
                value={paymentForm.paymentMode} 
                onValueChange={(v) => setPaymentForm({...paymentForm, paymentMode: v})}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white z-[9999]">
                  {PAYMENT_MODES.map(mode => (
                    <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Remarks</Label>
              <Input
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({...paymentForm, remarks: e.target.value})}
                placeholder="Optional remarks"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handlePaySalary}
            >
              <IndianRupee className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}