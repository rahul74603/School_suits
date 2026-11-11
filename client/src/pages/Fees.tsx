import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, IndianRupee, Trash2, Plus, Bus, Printer, MessageCircle, Clock, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import { apiGet, apiPost, apiDel } from "@/lib/api";

// --- REST adapters (Phase 3 Batch A) --------------------------------------
// IPC me student ke saath route_name/bus_fee join hokar aate the; REST me
// student par sirf transportId hai. Isliye transport routes ek baar cache
// karke naam/fees yahin bhari jati hai. Baaki fields camelCase -> snake_case.
let feesRoutesCache: any[] | null = null;
async function getFeesRoutes(): Promise<any[]> {
  if (!feesRoutesCache) {
    const routes = await apiGet<any[]>("/api/transport-routes");
    feesRoutesCache = routes || [];
  }
  return feesRoutesCache;
}

function adaptFeeStudent(s: any, routes: any[]) {
  const route =
    s.transportId != null
      ? routes.find((r: any) => r.id === s.transportId)
      : undefined;
  return {
    ...s,
    admission_no: s.admissionNo,
    transport_id: s.transportId ?? null,
    route_name: route?.routeName ?? null,
    bus_fee: route?.amount ?? null,
  };
}

export default function Fees() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>({}); 
  const [year, setYear] = useState(new Date().getFullYear().toString());
  
  // Status & History
  const [status, setStatus] = useState<any>({ admissionBalance: 0, monthStatus: [], pendingDues: [] });
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  
  // Bill State
  const [extraCharges, setExtraCharges] = useState<{name: string, amount: number, type: string, month?: string, dueId?: number}[]>([]); 
  const [totalPayable, setTotalPayable] = useState(0);
  
  // Modals & Receipt
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isAddDueOpen, setIsAddDueOpen] = useState(false);
  const [newDue, setNewDue] = useState({ name: "", amount: "" });
  
  // Receipt State
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
        try {
            // REST: GET /api/branding (school ki row seedhi aati hai —
            // name/address page wahi padhta hai).
            const info = await apiGet<any>('/api/branding');
            setSchoolInfo(info || {});
        } catch (e) { console.error(e); }
    })();
  }, []);

  const { data: students } = useQuery({
    queryKey: ["students-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      // REST: GET /api/students?search= (server ki search sirf NAAM par
      // hai — NOTES.md). Student adapter route_name/bus_fee bhi bharta hai.
      const data = await apiGet<any[]>(`/api/students?search=${encodeURIComponent(search)}`);
      let routes: any[] = [];
      try { routes = await getFeesRoutes(); } catch { /* bina route naam ke bhi list chalegi */ }
      return (data || []).map((s: any) => adaptFeeStudent(s, routes));
    },
    enabled: search.length >= 2
  });

  useEffect(() => { if (selectedStudent) loadStudentData(); }, [selectedStudent, year]);
  useEffect(() => { let total = 0; extraCharges.forEach(c => total += (c.amount || 0)); setTotalPayable(total); }, [extraCharges]);

  const loadStudentData = async () => {
    try {
      setExtraCharges([]); 
      // REST: GET /api/payments?studentId= (payment_date/receipt_no adapter)
      const history = await apiGet<any[]>(`/api/payments?studentId=${selectedStudent.id}`);
      setPaymentHistory((history || []).map((pay: any) => ({
        ...pay,
        payment_date: pay.paymentDate,
        receipt_no: pay.receiptNo,
      })));
      // REST: GET /api/students/:id/status?year= — jawab ka shape IPC jaisa
      // hi hai (monthStatus/pendingDues/monthlyFee/admissionBalance).
      const statusData = await apiGet<any>(`/api/students/${selectedStudent.id}/status?year=${parseInt(year)}`);
      if (statusData) setStatus(statusData);
    } catch (error) { console.error(error); }
  };

  // --- ACTIONS ---
  const handleAddDue = async () => {
      if(!newDue.name || !newDue.amount) return;
      // REST: POST /api/students/:id/dues — dueDate server ko lazmi
      // chahiye (IPC me nahi jata tha); aaj ki tareekh bhej rahe hain.
      await apiPost(`/api/students/${selectedStudent.id}/dues`, { feeName: newDue.name, amount: parseInt(newDue.amount), dueDate: new Date().toISOString().split('T')[0] });
      setIsAddDueOpen(false); setNewDue({ name: "", amount: "" });
      loadStudentData();
  };
  const deleteDue = async (id: number) => { await apiDel(`/api/dues/${id}`); loadStudentData(); };

  const addToBill = (name: string, amount: number, type: string, month?: string, dueId?: number) => {
    if (extraCharges.find(c => c.name === name)) return;
    setExtraCharges(prev => [...prev, { name, amount, type, month, dueId }]);
  };
  const removeCharge = (i: number) => { const u = [...extraCharges]; u.splice(i, 1); setExtraCharges(u); };
  const updateBillAmount = (i: number, v: string) => { const val = parseInt(v) || 0; const u = [...extraCharges]; u[i].amount = val; setExtraCharges(u); };

  // --- OPEN OLD RECEIPT ---
  const openOldReceipt = (p: any) => {
      let items = [];
      try {
          const bd = JSON.parse(p.breakdown);
          if(bd && bd.extras) items = bd.extras;
      } catch(e) {
          items = [{ name: p.remarks, amount: p.amount }];
      }

      setCurrentReceipt({
          receiptNo: p.receipt_no,
          date: new Date(p.payment_date).toLocaleDateString(),
          student: selectedStudent,
          items: items,
          total: p.amount
      });
      setShowReceipt(true);
  };

  // --- FINAL PAYMENT ---
  const finalizePayment = async () => {
    setIsConfirmOpen(false);
    try {
      // REST jawab { receiptNo } object me aata hai — string yahin nikali.
      const receiptRes = await apiGet<{ receiptNo: string }>('/api/payments/next-receipt-no');
      const receiptNo = receiptRes.receiptNo;
      const isAdmissionPayment = extraCharges.some(c => c.type === 'Admission Fee');
      
      const itemNames = extraCharges.map(c => `${c.name} (₹${c.amount})`).join(", ");
      const remarks = itemNames; 

      // REST: POST /api/payments. Body pehle jaisa hi bheja hai, lekin
      // jaan lo: isAdmission aur breakdown server ke schema me hain hi
      // nahi, server unhe gira deta hai — iska asar NOTES.md me flag hai.
      await apiPost('/api/payments', {
        studentId: selectedStudent.id,
        amount: totalPayable,
        month: extraCharges.map(c => c.month).filter(Boolean).join(",") || "Misc",
        year: parseInt(year),
        receiptNo,
        isAdmission: isAdmissionPayment, 
        remarks: remarks,
        breakdown: { extras: extraCharges }
      });
      
      toast({ title: "Success", description: "Payment Saved!" });
      loadStudentData();
      
      setCurrentReceipt({
          receiptNo,
          date: new Date().toLocaleDateString(),
          student: selectedStudent,
          items: extraCharges,
          total: totalPayable
      });
      setShowReceipt(true);

    } catch (e) { toast({ title: "Error", description: "Failed", variant: "destructive" }); }
  };

  const deleteReceipt = async (id: number) => {
    if(!confirm("Delete this receipt? Amount will be due again.")) return;
    await apiDel(`/api/payments/${id}`);
    loadStudentData();
  };

  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  const sendWhatsApp = () => {
      if(!selectedStudent.contact) {
          toast({ title: "No Number", description: "Student contact number missing", variant: "destructive" });
          return;
      }
      const phone = "91" + selectedStudent.contact; 
      const text = `Dear Parent,%0A%0APayment Received for ${selectedStudent.name}.%0A%0AReceipt No: ${currentReceipt.receiptNo}%0ADate: ${currentReceipt.date}%0AAmount: ₹${currentReceipt.total}%0A%0ADetails:%0A${currentReceipt.items.map((i:any) => `- ${i.name}: ₹${i.amount}`).join('%0A')}%0A%0AThank you,%0A${schoolInfo.name || "School Admin"}`;
      window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, '_blank');
  };

  const isAdmFullyPaid = status.admissionBalance <= 0;

  return (
    <div className="p-4 h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* HEADER */}
      <div className="flex justify-between items-center shrink-0 bg-white p-3 rounded-xl shadow-sm border mb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><IndianRupee className="text-green-600" /> Fees Dashboard</h1>
        {selectedStudent && <div className="font-bold text-lg">{selectedStudent.name} ({selectedStudent.class}) - {selectedStudent.admission_no}</div>}
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        
        {/* LEFT: STUDENT LIST */}
        <div className="col-span-3 h-full flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-3 border-b bg-slate-50"><Input placeholder="Search Student..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white" /></div>
            <div className="flex-1 overflow-y-auto">
                {students?.map((s: any) => (
                    <div key={s.id} onClick={() => { setSelectedStudent(s); setSearch(""); }} className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${selectedStudent?.id === s.id ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''}`}>
                        <div className="font-bold text-slate-800">{s.name}</div><div className="text-xs text-gray-500">{s.admission_no}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* CENTER: DASHBOARD */}
        <div className="col-span-6 h-full flex flex-col gap-4 overflow-y-auto pr-1 pb-20">
            {selectedStudent ? (
                <>
                    {/* ADMISSION & TRANSPORT */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className={`border-l-4 cursor-pointer ${isAdmFullyPaid ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500 bg-orange-50'}`} onClick={() => status.admissionBalance > 0 && addToBill("Admission Fee Balance", status.admissionBalance, "Admission Fee")}>
                            <div className="p-4 flex justify-between items-center">
                                <div><div className="text-xs font-bold opacity-70">ADMISSION FEE</div><div className="font-bold text-xl">{isAdmFullyPaid ? "Fully Paid" : `Due: ₹${status.admissionBalance}`}</div></div>
                                {!isAdmFullyPaid && <Plus className="bg-orange-200 p-1 h-6 w-6 rounded-full text-orange-700"/>}
                            </div>
                        </Card>
                        <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                            <div className="p-4">
                                <div className="text-xs font-bold opacity-60 uppercase flex items-center gap-1"><Bus className="h-3 w-3"/> Transport Route</div>
                                <div className="font-bold text-lg mt-1">{selectedStudent.route_name || "No Transport"}</div>
                                {selectedStudent.bus_fee && <div className="text-sm">₹{selectedStudent.bus_fee}/month</div>}
                            </div>
                        </Card>
                    </div>

                    {/* PENDING DUES */}
                    <Card className="border-l-4 border-l-purple-500 shadow-sm">
                        <CardHeader className="py-2 bg-purple-50 flex flex-row justify-between items-center">
                            <CardTitle className="text-sm text-purple-900 flex items-center gap-2"><Clock className="h-4 w-4"/> Pending Dues</CardTitle>
                            <Button size="sm" variant="outline" className="h-7 bg-white text-purple-700" onClick={() => setIsAddDueOpen(true)}><Plus className="h-3 w-3 mr-1"/> Add</Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {status.pendingDues?.length > 0 ? (
                                <div className="divide-y">
                                    {status.pendingDues.map((d: any) => (
                                        <div key={d.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                            <div><div className="font-bold text-sm text-gray-800">{d.fee_name}</div><div className="text-[10px] text-gray-500">{new Date(d.due_date).toLocaleDateString()}</div></div>
                                            <div className="flex items-center gap-3"><span className="font-bold text-red-600">₹{d.amount}</span><Button size="sm" className="h-7 px-2 bg-green-600 text-xs" onClick={() => addToBill(d.fee_name, d.amount, "Due", undefined, d.id)}>Pay</Button><Trash2 className="h-4 w-4 text-gray-300 hover:text-red-500 cursor-pointer" onClick={() => deleteDue(d.id)}/></div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="p-4 text-center text-xs text-gray-400">No pending dues.</div>}
                        </CardContent>
                    </Card>

                    {/* MONTHLY TRACKER */}
                    <Card><CardContent className="p-4 grid grid-cols-3 gap-3">
                        {status.monthStatus.map((m: any) => (
                            <div key={m.name} className="border rounded bg-white overflow-hidden shadow-sm">
                                <div className="bg-slate-100 px-2 py-1 text-xs font-bold text-center uppercase text-slate-600">{m.name}</div>
                                <div onClick={() => m.tuitionStatus !== 'paid' && addToBill(`Tuition: ${m.name}`, status.monthlyFee, "Tuition", m.name)} className={`px-2 py-2 text-xs border-b cursor-pointer flex justify-between items-center ${m.tuitionStatus === 'paid' ? 'bg-green-50 text-green-700' : 'hover:bg-red-50 text-red-600'}`}><span>Tuition</span>{m.tuitionStatus === 'paid' ? <CheckCircle2 className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</div>
                                {selectedStudent.transport_id && (
                                    <div onClick={() => m.transportStatus !== 'paid' && addToBill(`Bus: ${m.name}`, selectedStudent.bus_fee, "Transport Fee", m.name)} className={`px-2 py-2 text-xs cursor-pointer flex justify-between items-center ${m.transportStatus === 'paid' ? 'bg-green-50 text-green-700' : 'hover:bg-red-50 text-red-600'}`}><span>Bus</span>{m.transportStatus === 'paid' ? <CheckCircle2 className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</div>
                                )}
                            </div>
                        ))}
                    </CardContent></Card>

                    {/* 🟢 RECENT TRANSACTIONS (FIXED: REMOVED TITLE PROPS) */}
                    <Card className="flex-1 overflow-hidden flex flex-col border-t-4 border-t-slate-600">
                        <CardHeader className="py-2 bg-slate-100 border-b">
                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Clock className="h-4 w-4"/> Recent Transactions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="w-[100px]">Date</TableHead>
                                        <TableHead>Receipt No</TableHead>
                                        <TableHead>Details (Particulars)</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="w-[80px] text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paymentHistory.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell className="text-xs text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-mono text-xs font-bold">{p.receipt_no}</TableCell>
                                            <TableCell className="text-xs font-medium text-slate-800">{p.remarks}</TableCell> 
                                            <TableCell className="font-bold text-green-600 text-right">₹{p.amount}</TableCell>
                                            {/* 🟢 FIXED: Icons without title prop */}
                                            <TableCell className="flex justify-center gap-2">
                                                <Printer className="h-4 w-4 text-blue-500 hover:text-blue-700 cursor-pointer" onClick={() => openOldReceipt(p)} />
                                                <Trash2 className="h-4 w-4 text-red-300 hover:text-red-600 cursor-pointer" onClick={() => deleteReceipt(p.id)} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {paymentHistory.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-400">No transactions found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : <div className="text-center mt-20 text-gray-400">Select a student</div>}
        </div>

        {/* RIGHT: BILL */}
        <div className="col-span-3 h-full pb-4">
            <Card className="h-full flex flex-col border-l-4 border-l-green-500 shadow-lg">
                <CardHeader className="bg-green-50 py-3 border-b"><CardTitle className="text-green-800 text-lg">Current Bill</CardTitle></CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                    <div className="flex-1 space-y-0 overflow-y-auto p-3 bg-slate-50/50">
                        {extraCharges.map((c, i) => (
                            <div key={i} className="flex flex-col p-2 bg-white border rounded mb-2 shadow-sm">
                                <div className="flex justify-between items-start mb-1"><div className="text-xs font-bold text-slate-700">{c.name}</div><Trash2 className="h-4 w-4 text-red-300 hover:text-red-500 cursor-pointer" onClick={() => removeCharge(i)} /></div>
                                <div className="flex items-center gap-2 mt-1"><span className="text-xs font-bold text-gray-400">₹</span><Input type="number" className="h-8 text-right font-bold text-green-700" value={c.amount} onChange={(e) => updateBillAmount(i, e.target.value)}/></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-white border-t">
                        <div className="flex justify-between mb-4 items-end"><span className="text-gray-500 font-medium">Total</span><span className="text-3xl font-bold text-green-700">₹{totalPayable}</span></div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-md" onClick={() => setIsConfirmOpen(true)} disabled={totalPayable === 0}>Collect Payment</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* --- MODALS --- */}
      <Dialog open={isAddDueOpen} onOpenChange={setIsAddDueOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Pending Fee</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Fee Name</Label><Input placeholder="e.g. Exam Fee" value={newDue.name} onChange={e => setNewDue({...newDue, name: e.target.value})}/></div><div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" placeholder="500" value={newDue.amount} onChange={e => setNewDue({...newDue, amount: e.target.value})}/></div></div><DialogFooter><Button onClick={handleAddDue}>Save Due</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent><DialogHeader><DialogTitle>Confirm Payment</DialogTitle></DialogHeader><div className="py-4 text-center"><p className="text-4xl font-bold text-green-600">₹{totalPayable}</p></div><DialogFooter><Button onClick={finalizePayment} className="bg-green-600">Confirm & Generate Receipt</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="flex justify-between items-center"><span>Payment Receipt</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2"/> Print / PDF</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}><MessageCircle className="h-4 w-4 mr-2"/> WhatsApp</Button></div></DialogTitle></DialogHeader>
            <div className="border p-6 bg-white shadow-sm" ref={receiptRef}>
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">{schoolInfo.name || "SCHOOL NAME"}</h2>
                    <p className="text-sm text-slate-500">{schoolInfo.address || "Address"}</p>
                    <div className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Fee Receipt</div>
                </div>
                {currentReceipt && (
                    <>
                        <div className="flex justify-between text-sm mb-6"><div><p><span className="font-bold">Receipt No:</span> {currentReceipt.receiptNo}</p><p><span className="font-bold">Date:</span> {currentReceipt.date}</p></div><div className="text-right"><p><span className="font-bold">Student:</span> {currentReceipt.student.name}</p><p><span className="font-bold">ID:</span> {currentReceipt.student.admission_no}</p><p><span className="font-bold">Class:</span> {currentReceipt.student.class}</p></div></div>
                        <table className="w-full text-sm border-collapse mb-6"><thead><tr className="border-b-2 border-slate-200"><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th></tr></thead><tbody>{currentReceipt.items.map((item: any, idx: number) => (<tr key={idx} className="border-b border-slate-100"><td className="py-2">{item.name} {item.month ? `(${item.month})` : ""}</td><td className="text-right py-2 font-mono">₹{item.amount}</td></tr>))}</tbody><tfoot><tr className="border-t-2 border-slate-800 font-bold text-lg"><td className="py-3">Total Paid</td><td className="text-right py-3">₹{currentReceipt.total}</td></tr></tfoot></table>
                    </>
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}