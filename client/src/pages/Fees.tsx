import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, IndianRupee, Trash2, Plus, Bus, Printer, MessageCircle, Clock, CheckCircle2, School, Download, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useReactToPrint } from "react-to-print";
import { apiGet, apiPost, apiDel, ApiError } from "@/lib/api";
import { downloadCsv, todayStamp } from "@/lib/exportCsv";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

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
  // Super Admin ka khud ka koi school nahi hota — is page ke saare
  // endpoints server par uske liye 403/404 dete hain (/api/branding
  // 404, /api/students aur /api/payments 403; routes se verify).
  // Isliye SA par poora fees layout hi nahi dikhate — Settings wala
  // no-school card dikhega (neeche render me early return dekho).
  const { user, school } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
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

  // --- Fee Kishten (installments) — v1.7 FIN -------------------------
  // Frappe ke fee-schedule model par: ek class ke saare active
  // students ke liye kishten ek saath banti hain (server:
  // POST /api/fees/installments/generate). Bani hui kishten aam
  // student_dues hi hain — Pending Dues me dikhengi aur maujooda
  // settlement (dueSettlements) se hi vasool hongi.
  // Sirf principal/accountant — server par bhi yahi role bandhan hai.
  const canManageFees = user?.role === "principal" || user?.role === "accountant";
  const INST_CLASSES = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const [isInstOpen, setIsInstOpen] = useState(false);
  const [instClass, setInstClass] = useState("");
  const [instTitle, setInstTitle] = useState("Fee Kisht");
  const [instTotal, setInstTotal] = useState("");
  const [instCount, setInstCount] = useState("3");
  const [instFirstDate, setInstFirstDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [instStructures, setInstStructures] = useState<any[]>([]);
  const [instStudentCount, setInstStudentCount] = useState<number | null>(null);
  const [instBusy, setInstBusy] = useState(false);
  const [instResult, setInstResult] = useState<{ studentCount: number; created: number; skipped: number } | null>(null);
  const [instError, setInstError] = useState("");
  
  // Receipt State
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // 💳 Online Payment (Razorpay, v1.7) — imaandaar design: server par
  // keys na hon to config enabled:false deta hai aur yahan saaf likha
  // dikhega; koi dummy/test safalta ka rasta NAHI hai. Asli safalta
  // sirf Razorpay checkout → server verify (signature jaanch) ke
  // baad hi record banti hai.
  const [onlineConfig, setOnlineConfig] = useState<{
    enabled: boolean;
    keyId?: string;
  } | null>(null);
  const [onlineAmount, setOnlineAmount] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineMsg, setOnlineMsg] = useState<string | null>(null);

  useEffect(() => {
    // Super Admin: koi school nahi — branding call hi nahi karte.
    if (isSuperAdmin) return;
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

  // Online payment config — student chunte hi ek baar jaanch. Fail ho
  // (purana server wagera) to enabled:false jaisa bartav: imaandaar
  // sandesh dikhega, nakli button nahi chalega.
  useEffect(() => {
    if (!selectedStudent || isSuperAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await apiGet<{ enabled: boolean; keyId?: string }>(
          "/api/payments/online/config",
        );
        if (!cancelled) setOnlineConfig(cfg);
      } catch {
        if (!cancelled) setOnlineConfig({ enabled: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);
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

  // --- KISHTEN: helpers (v1.7 FIN) ---
  // Mahina jodo, din mahine ke aakhir se aage na jaye
  // (31 Jan + 1 mahina = 28/29 Feb, 31 Mar nahi).
  const addMonthsClamped = (dateStr: string, monthsToAdd: number): string => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const firstOfTarget = new Date(y, m - 1 + monthsToAdd, 1);
    const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
    const dt = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(d, lastDay));
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  };

  // Class ki fee structure se default kul rakam: saal bhar ki
  // tuition (monthly × 12) + admission + exam + annual/other.
  // Ye sirf DEFAULT hai — form me rakam badli ja sakti hai.
  const instStructure = instStructures.find((s: any) => s.class === instClass);
  const instDefaultTotal = instStructure
    ? (instStructure.monthlyFee || 0) * 12 +
      (instStructure.admissionFee || 0) +
      (instStructure.examFee || 0) +
      (instStructure.otherFee || 0)
    : null;

  const onInstClassChange = async (cls: string) => {
    setInstClass(cls);
    setInstResult(null);
    setInstError("");
    setInstStudentCount(null);
    const st = instStructures.find((s: any) => s.class === cls);
    if (st) {
      setInstTotal(
        String(
          (st.monthlyFee || 0) * 12 +
            (st.admissionFee || 0) +
            (st.examFee || 0) +
            (st.otherFee || 0),
        ),
      );
    }
    if (cls) {
      try {
        // Preview ke liye class ki active student ginti (server ki
        // GET /api/students pehle se sirf active deti hai).
        const list = await apiGet<any[]>(`/api/students?class=${encodeURIComponent(cls)}`);
        setInstStudentCount((list || []).length);
      } catch {
        setInstStudentCount(null);
      }
    }
  };

  const openInstDialog = async () => {
    setInstResult(null);
    setInstError("");
    setInstStudentCount(null);
    const preClass = selectedStudent?.class || "";
    setInstClass(preClass);
    setIsInstOpen(true);
    try {
      // REST: GET /api/fee-structures — default kul rakam ke liye.
      const structures = await apiGet<any[]>("/api/fee-structures");
      setInstStructures(structures || []);
      if (preClass) {
        const st = (structures || []).find((s: any) => s.class === preClass);
        if (st) {
          setInstTotal(
            String(
              (st.monthlyFee || 0) * 12 +
                (st.admissionFee || 0) +
                (st.examFee || 0) +
                (st.otherFee || 0),
            ),
          );
        }
        try {
          const list = await apiGet<any[]>(`/api/students?class=${encodeURIComponent(preClass)}`);
          setInstStudentCount((list || []).length);
        } catch {
          setInstStudentCount(null);
        }
      }
    } catch {
      setInstStructures([]);
    }
  };

  // Preview: kul rakam ka bantwara — har kisht barabar, rounding ka
  // bacha hua hissa AAKHIRI kisht me judta hai (kul jod hamesha
  // bilkul wahi jo upar bhara gaya). Due dates: pehli tareekh se
  // har mahine ek.
  const instTotalNum = parseInt(instTotal) || 0;
  const instCountNum = parseInt(instCount) || 0;
  const instPreview: { title: string; amount: number; dueDate: string }[] =
    instTotalNum > 0 && instCountNum >= 1 && instCountNum <= 24 && instFirstDate
      ? (() => {
          const base = Math.floor(instTotalNum / instCountNum);
          const remainder = instTotalNum - base * instCountNum;
          const titleBase = instTitle.trim() || "Fee Kisht";
          return Array.from({ length: instCountNum }, (_, i) => ({
            title: `${titleBase} ${i + 1}/${instCountNum}`,
            amount: i === instCountNum - 1 ? base + remainder : base,
            dueDate: addMonthsClamped(instFirstDate, i),
          }));
        })()
      : [];

  const confirmInst = async () => {
    if (!instClass || instPreview.length === 0) return;
    setInstBusy(true);
    setInstError("");
    setInstResult(null);
    try {
      // REST: POST /api/fees/installments/generate — jawab me
      // { studentCount, created, skipped } ki sachhi ginti aati hai;
      // pehle se bani kishten server skip kar deta hai.
      const res = await apiPost<any>("/api/fees/installments/generate", {
        className: instClass,
        installments: instPreview,
      });
      setInstResult({
        studentCount: res.studentCount,
        created: res.created,
        skipped: res.skipped,
      });
      toast({
        title: "Kishten ban gayi",
        description: `${res.created} nayi kishten bani, ${res.skipped} pehle se thi (skip ho gayi).`,
      });
      // Khule hue student ki class yahi ho to uski dues list taza karo.
      if (selectedStudent && selectedStudent.class === instClass) loadStudentData();
    } catch (e: any) {
      // Imaandar sandesh: server ne jo wajah bheji wahi dikhao,
      // aadhi safalta kabhi safalta bankar nahi dikhegi.
      setInstError(e?.message || "Kishten nahi ban payi — dobara koshish karein.");
    }
    setInstBusy(false);
  };

  // --- CSV EXPORTS (v1.7 FIN) — pehle se loaded data se hi ---
  const exportPaymentsCsv = () => {
    if (!selectedStudent || paymentHistory.length === 0) return;
    downloadCsv(
      `payments-${selectedStudent.admission_no}-${todayStamp()}.csv`,
      ["Receipt No", "Date", "Student", "Admission No", "Class", "Month", "Year", "Amount", "Details"],
      paymentHistory.map((p: any) => [
        p.receipt_no ?? "",
        p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "",
        selectedStudent.name ?? "",
        selectedStudent.admission_no ?? "",
        selectedStudent.class ?? "",
        p.month ?? "",
        p.year ?? "",
        p.amount ?? 0,
        p.remarks ?? "",
      ]),
    );
    toast({ title: "CSV download ho gaya", description: `${selectedStudent.name} ki ${paymentHistory.length} payment(s) export hui.` });
  };

  const exportDuesCsv = () => {
    if (!selectedStudent || !status.pendingDues?.length) return;
    downloadCsv(
      `pending-dues-${selectedStudent.admission_no}-${todayStamp()}.csv`,
      ["Student", "Admission No", "Class", "Fee", "Amount", "Due Date"],
      status.pendingDues.map((d: any) => [
        selectedStudent.name ?? "",
        selectedStudent.admission_no ?? "",
        selectedStudent.class ?? "",
        d.fee_name ?? "",
        d.amount ?? 0,
        d.due_date ? new Date(d.due_date).toLocaleDateString("en-IN") : "",
      ]),
    );
    toast({ title: "CSV download ho gaya", description: `${selectedStudent.name} ke ${status.pendingDues.length} pending due(s) export hue.` });
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

      // Dues-fix: bill me jo items kisi pending custom due ke "Pay" se
      // aaye hain (dueId wale), unki pehchan aur is bill me unke liye
      // di gayi rakam alag se bhejo. Server payment ke saath hi un
      // dues ko settle karega — pehle paisa to jud jata tha lekin due
      // row hamesha pending reh jati thi.
      const dueSettlements = extraCharges
        .filter(c => c.dueId && c.amount > 0)
        .map(c => ({ dueId: c.dueId as number, amount: c.amount }));

      // REST: POST /api/payments — breakdown / isAdmission server ke
      // schema me hain (Batch A fix), aur dueSettlements dues-fix se.
      await apiPost('/api/payments', {
        studentId: selectedStudent.id,
        amount: totalPayable,
        month: extraCharges.map(c => c.month).filter(Boolean).join(",") || "Misc",
        year: parseInt(year),
        receiptNo,
        isAdmission: isAdmissionPayment,
        remarks: remarks,
        breakdown: { extras: extraCharges },
        dueSettlements: dueSettlements.length ? dueSettlements : undefined
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

  // Razorpay checkout.js dynamically load karo (pehle se loaded ho
  // to dobara nahi). Script na aaye to imaandaar fail — aage nahi badhte.
  const loadRazorpayCheckout = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(!!(window as any).Razorpay);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // 💳 Online fee jama — asal pravah: (1) server se order banao,
  // (2) Razorpay ka asal checkout kholo, (3) safalta par server se
  // signature verify karwao — record TABHI banta hai. Beech me kahin
  // bhi ruko/band karo to koi record NAHI banta aur wahi sach yahan
  // likha dikhta hai.
  const handleOnlinePay = async () => {
    if (!selectedStudent) return;
    const amount = parseInt(onlineAmount, 10) || totalPayable;
    if (!amount || amount <= 0) {
      setOnlineMsg(
        "Pehle bill me rakam jodein ya upar rakam likhein — bina rakam ke online payment nahi hoga.",
      );
      return;
    }
    setOnlineBusy(true);
    setOnlineMsg(null);
    try {
      const order = await apiPost<{
        orderId: string;
        amount: number;
        keyId: string;
      }>("/api/payments/online/order", {
        studentId: selectedStudent.id,
        amount,
      });

      const loadedScript = await loadRazorpayCheckout();
      if (!loadedScript) {
        setOnlineMsg(
          "Razorpay ki payment window load nahi ho payi — internet jaanch kar dobara koshish karein. Koi rakam nahi kati.",
        );
        setOnlineBusy(false);
        return;
      }

      // Bill ka sandarbh verify ke saath jayega taaki safal adaygi ka
      // record manual payment jaisa hi bane (breakdown/dues samet).
      const dueSettlements = extraCharges
        .filter((c) => c.dueId && c.amount > 0)
        .map((c) => ({ dueId: c.dueId as number, amount: c.amount }));

      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount * 100,
        currency: "INR",
        name: schoolInfo.name || school?.name || "School Guardian Suite",
        description: `Fee — ${selectedStudent.name}`,
        handler: async (resp: any) => {
          try {
            await apiPost("/api/payments/online/verify", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              studentId: selectedStudent.id,
              amount,
              month:
                extraCharges.map((c) => c.month).filter(Boolean).join(",") ||
                "Misc",
              year: parseInt(year),
              remarks: extraCharges
                .map((c) => `${c.name} (₹${c.amount})`)
                .join(", "),
              breakdown: { extras: extraCharges },
              isAdmission: extraCharges.some(
                (c) => c.type === "Admission Fee",
              ),
              dueSettlements: dueSettlements.length
                ? dueSettlements
                : undefined,
            });
            toast({
              title: "Online Payment Safal",
              description: `₹${amount} ki fee jama ho gayi (Razorpay se verify hokar).`,
            });
            setOnlineMsg(
              "Payment safal — rakam school ke record me jama ho gayi hai.",
            );
            setOnlineAmount("");
            loadStudentData();
          } catch (e) {
            // Razorpay par paisa kata ho par server verify fail ho to
            // record NAHI bana — yahi sach saaf likhna hai.
            setOnlineMsg(
              e instanceof ApiError
                ? `Payment ki server-jaanch fail: ${e.message}`
                : "Payment ki server-jaanch fail ho gayi — record NAHI bana. Agar rakam kat gayi ho to school se sampark karein.",
            );
            toast({
              title: "Verify Fail",
              description:
                "Online payment ka record nahi bana — school se sampark karein.",
              variant: "destructive",
            });
          } finally {
            setOnlineBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setOnlineBusy(false);
            setOnlineMsg(
              "Payment pura nahi hua — window band kar di gayi. Koi record NAHI bana.",
            );
          },
        },
        theme: { color: "#1976D2" },
      });
      rzp.open();
    } catch (e) {
      setOnlineBusy(false);
      setOnlineMsg(
        e instanceof ApiError
          ? e.message
          : "Online payment shuru nahi ho paya — dobara koshish karein.",
      );
    }
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

  // Admission Fee ka asal hisaab status API se aata hai: admissionTotal
  // = school ki fee structure me is class ki lagi kul admission fee,
  // admissionPaidSoFar = ab tak jama, admissionBalance = baaki.
  // Kul fee lagi hi na ho (total 0) to purana code balance 0 dekh kar
  // jhoota "Fully Paid" dikha deta tha — wo haalat ab alag hai.
  const admTotal = status.admissionTotal ?? 0;
  const admPaid = status.admissionPaidSoFar ?? 0;
  const admBalance = status.admissionBalance ?? 0;
  const admNotSet = admTotal <= 0;
  const isAdmFullyPaid = !admNotSet && admBalance <= 0;
  const admDue = !admNotSet && admBalance > 0;

  // 📲 WhatsApp Defaulter Reminder (v1.6) — client-only, koi API
  // kharcha nahi: wa.me link parent ke mobile par khulta hai, sandesh
  // pehle se likha hota hai. Kul baaki = admission balance (agar due
  // hai) + saare pending custom dues.
  // Parent ka mobile = student record ka `contact` field (students
  // table ka ekmatra mobile column — server ki search bhi yahi
  // istemal karti hai; receipt wala sendWhatsApp bhi yahi leta hai).
  const duesTotal = (status.pendingDues || []).reduce(
    (sum: number, d: any) => sum + (Number(d.amount) || 0),
    0,
  );
  const totalDue = (admDue ? admBalance : 0) + duesTotal;
  const schoolName = schoolInfo.name || school?.name || "School Guardian Suite";
  const parentMobileDigits = String(selectedStudent?.contact || "").replace(/\D/g, "");
  const parentMobile =
    parentMobileDigits.length === 10
      ? `91${parentMobileDigits}`
      : parentMobileDigits.length > 10
        ? parentMobileDigits
        : "";
  const waReminderUrl =
    totalDue > 0 && parentMobile
      ? `https://wa.me/${parentMobile}?text=${encodeURIComponent(
          `Namaste,\n${schoolName} se suchna hai ki aapke bacche ${selectedStudent.name} (Class ${selectedStudent.class}) ki kul ₹${totalDue} fee abhi baaki hai.\nKripya jald se jald school me jama karne ka kasht karein. Koi sawal ho to school se sampark karein.\nDhanyavaad,\n${schoolName}`,
        )}`
      : "";

  // Super Admin ke liye poora page hi no-school card hai (ye early
  // return saare hooks ke BAAD hai — hooks hamesha ek jaise chalte hain).
  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
            <IndianRupee className="text-green-600" /> Fees Dashboard
          </h1>
        </div>
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there is no school fees data to show here.
              First create a school from the Schools screen — after that,
              that school&apos;s Principal can sign in with their own
              account and manage fees.
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

  return (
    <div className="p-4 h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* HEADER */}
      <div className="flex flex-wrap gap-2 justify-between items-center shrink-0 bg-white p-3 rounded-xl shadow-sm border mb-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><IndianRupee className="text-green-600" /> Fees Dashboard</h1>
        {selectedStudent && <div className="font-bold text-lg">{selectedStudent.name} ({selectedStudent.class}) - {selectedStudent.admission_no}</div>}
        {canManageFees && (
          <Button onClick={() => void openInstDialog()} className="bg-purple-600 hover:bg-purple-700 shrink-0">
            <Layers className="h-4 w-4 mr-2" /> Kishten Banao
          </Button>
        )}
      </div>

      {/* Teeno columns par min-w-0 lazmi hai: bina iske grid ka baccha
          apni andar ki chaudai (khaas taur par table) se chhota hone se
          inkaar kar deta hai aur poora column screen se bahar dhakelta
          hai — Pending Dues card ki dayein sarhad katne ki wajah yahi thi. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-y-auto lg:overflow-hidden">
        
        {/* LEFT: STUDENT LIST */}
        <div className="h-64 lg:h-full lg:col-span-3 min-w-0 flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-3 border-b bg-slate-50"><Input placeholder="Search Student..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white" /></div>
            <div className="flex-1 overflow-y-auto">
                {(!students || students.length === 0) && (
                    <div className="p-4 text-center text-xs text-gray-400 leading-relaxed">
                        {search.length < 2
                            ? "Student dhundne ke liye upar uska naam likhein (kam se kam 2 akshar) — list yahan dikhegi."
                            : "Is naam ka koi student nahi mila."}
                    </div>
                )}
                {students?.map((s: any) => (
                    <div key={s.id} onClick={() => { setSelectedStudent(s); setSearch(""); }} className={`p-3 border-b cursor-pointer hover:bg-blue-50 ${selectedStudent?.id === s.id ? 'bg-blue-100 border-l-4 border-l-blue-600' : ''}`}>
                        <div className="font-bold text-slate-800">{s.name}</div><div className="text-xs text-gray-500">{s.admission_no}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* CENTER: DASHBOARD */}
        <div className="lg:col-span-6 lg:h-full min-w-0 flex flex-col gap-4 lg:overflow-y-auto pr-1 pb-4 lg:pb-20">
            {selectedStudent ? (
                <>
                    {/* ADMISSION & TRANSPORT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {admNotSet ? (
                        <Card className="border-l-4 border-l-slate-400 bg-slate-50">
                            <div className="p-4">
                                <div className="text-xs font-bold opacity-70">ADMISSION FEE</div>
                                <div className="font-bold text-lg mt-0.5">Set nahi hai</div>
                                <div className="text-xs text-gray-500 mt-1">Is class ki admission fee lagi hi nahi hai. Settings → Fee Structure me is class ki Admission Fee lagayein — tab yahan kul / jama / baaki ka hisaab dikhega.</div>
                            </div>
                        </Card>
                        ) : (
                        <Card className={`border-l-4 ${isAdmFullyPaid ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500 bg-orange-50 cursor-pointer'}`} onClick={() => admDue && addToBill("Admission Fee Balance", admBalance, "Admission Fee")}>
                            <div className="p-4">
                                <div className="flex justify-between items-center">
                                    <div className="text-xs font-bold opacity-70">ADMISSION FEE</div>
                                    {admDue && <Plus className="bg-orange-200 p-1 h-6 w-6 rounded-full text-orange-700"/>}
                                </div>
                                <div className="font-bold text-xl mt-0.5">{isAdmFullyPaid ? "Fully Paid" : `Baaki: ₹${admBalance}`}</div>
                                <div className="text-xs text-gray-600 mt-1">Kul: ₹{admTotal} • Jama: ₹{admPaid}</div>
                                {admDue && <div className="text-[11px] text-orange-700 mt-0.5">Baaki rakam leni ho to card par tap karke bill me jodein.</div>}
                            </div>
                        </Card>
                        )}
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
                            <div className="flex items-center gap-2 shrink-0">
                                {status.pendingDues?.length > 0 && (
                                    <Button size="sm" variant="outline" className="h-7 bg-white text-purple-700" onClick={exportDuesCsv} title="Is student ke pending dues ki CSV download karein"><Download className="h-3 w-3 mr-1"/> CSV</Button>
                                )}
                                <Button size="sm" variant="outline" className="h-7 bg-white text-purple-700" onClick={() => setIsAddDueOpen(true)}><Plus className="h-3 w-3 mr-1"/> Add</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(admDue || status.pendingDues?.length > 0) ? (
                                <div className="divide-y">
                                    {/* Admission Fee ki baaki rakam: ye student_dues
                                        table ki row NAHI hai — status ke admission
                                        hisaab (kul - jama) se bani derived pankti
                                        hai, isliye ispar delete nahi hai. Iski
                                        adaygi bill se hogi (type "Admission Fee"),
                                        jisse balance apne aap ghatega aur ye
                                        pankti gayab ho jayegi. */}
                                    {admDue && (
                                        <div className="p-3 flex justify-between items-center bg-orange-50/60 hover:bg-orange-50">
                                            <div><div className="font-bold text-sm text-gray-800">Admission Fee (baaki)</div><div className="text-[10px] text-gray-500">Kul ₹{admTotal} me se ₹{admPaid} jama — baaki admission fee</div></div>
                                            <div className="flex items-center gap-3"><span className="font-bold text-red-600">₹{admBalance}</span><Button size="sm" className="h-7 px-2 bg-green-600 text-xs" onClick={() => addToBill("Admission Fee Balance", admBalance, "Admission Fee")}>Pay</Button></div>
                                        </div>
                                    )}
                                    {status.pendingDues.map((d: any) => (
                                        <div key={d.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                            <div><div className="font-bold text-sm text-gray-800">{d.fee_name}</div><div className="text-[10px] text-gray-500">{new Date(d.due_date).toLocaleDateString()}</div></div>
                                            <div className="flex items-center gap-3"><span className="font-bold text-red-600">₹{d.amount}</span><Button size="sm" className="h-7 px-2 bg-green-600 text-xs" onClick={() => addToBill(d.fee_name, d.amount, "Due", undefined, d.id)}>Pay</Button><Trash2 className="h-4 w-4 text-gray-300 hover:text-red-500 cursor-pointer" onClick={() => deleteDue(d.id)}/></div>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="p-4 text-center text-xs text-gray-400">No pending dues.</div>}
                            {/* 📲 WhatsApp Reminder (v1.6): dues hon to parent ko
                                ek-tap reminder. Number na ho to button ki jagah
                                saaf wajah — jhoota button nahi. */}
                            {totalDue > 0 && (
                                <div className="border-t bg-green-50 p-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-green-900">WhatsApp Reminder</div>
                                        <div className="text-[11px] text-green-800">Kul baaki ₹{totalDue} — parent ko pehle se likha sandesh bhejein.</div>
                                    </div>
                                    {parentMobile ? (
                                        <a href={waReminderUrl} target="_blank" rel="noreferrer" className="shrink-0">
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                                <MessageCircle className="h-4 w-4 mr-1" /> Reminder Bhejein
                                            </Button>
                                        </a>
                                    ) : (
                                        <span className="text-[11px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-1">
                                            Parent ka mobile number is student ke record me nahi hai — pehle number jodein.
                                        </span>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* MONTHLY TRACKER */}
                    <Card><CardContent className="p-4">
                        {status.monthStatus?.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {status.monthStatus.map((m: any) => (
                            <div key={m.name} className="border rounded bg-white overflow-hidden shadow-sm">
                                <div className="bg-slate-100 px-2 py-1 text-xs font-bold text-center uppercase text-slate-600">{m.name}</div>
                                <div onClick={() => m.tuitionStatus !== 'paid' && addToBill(`Tuition: ${m.name}`, status.monthlyFee, "Tuition", m.name)} className={`px-2 py-2 text-xs border-b cursor-pointer flex justify-between items-center ${m.tuitionStatus === 'paid' ? 'bg-green-50 text-green-700' : 'hover:bg-red-50 text-red-600'}`}><span>Tuition</span>{m.tuitionStatus === 'paid' ? <CheckCircle2 className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</div>
                                {selectedStudent.transport_id && (
                                    <div onClick={() => m.transportStatus !== 'paid' && addToBill(`Bus: ${m.name}`, selectedStudent.bus_fee, "Transport Fee", m.name)} className={`px-2 py-2 text-xs cursor-pointer flex justify-between items-center ${m.transportStatus === 'paid' ? 'bg-green-50 text-green-700' : 'hover:bg-red-50 text-red-600'}`}><span>Bus</span>{m.transportStatus === 'paid' ? <CheckCircle2 className="h-3 w-3"/> : <Plus className="h-3 w-3"/>}</div>
                                )}
                            </div>
                        ))}
                        </div>
                        ) : (
                        <div className="text-center text-sm text-gray-500 py-3">
                            Is class ki <span className="font-bold">fee structure set nahi hai</span> — isliye mahine-war hisaab khaali dikh raha hai.
                            <div className="text-xs text-gray-400 mt-1">Settings → Fee Structure me is class ki fees lagayein, tab yahan har mahine ki paid / due haalat dikhegi.</div>
                        </div>
                        )}
                    </CardContent></Card>

                    {/* 🟢 RECENT TRANSACTIONS (FIXED: REMOVED TITLE PROPS) */}
                    <Card className="flex-1 overflow-hidden flex flex-col border-t-4 border-t-slate-600">
                        <CardHeader className="py-2 bg-slate-100 border-b flex flex-row justify-between items-center">
                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Clock className="h-4 w-4"/> Recent Transactions
                            </CardTitle>
                            {paymentHistory.length > 0 && (
                                <Button size="sm" variant="outline" className="h-7 bg-white text-slate-700 shrink-0" onClick={exportPaymentsCsv} title="Is student ki payments ki CSV download karein"><Download className="h-3 w-3 mr-1"/> CSV</Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            {paymentHistory.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">No transactions found.</div>
                            ) : (
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
                                </TableBody>
                            </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : <div className="text-center mt-20 text-gray-400">Select a student</div>}
        </div>

        {/* RIGHT: BILL */}
        <div className="lg:col-span-3 lg:h-full min-w-0 pb-4">
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

                        {/* 💳 Online Fee Jama (Razorpay, v1.7) — student
                            chuna ho tabhi dikhta hai. Config enabled na
                            ho to wajah saaf likhi hai; koi nakli
                            safalta wala rasta nahi hai. */}
                        {selectedStudent && (
                            <div className="mt-4 border-t pt-3 space-y-2">
                                <div className="text-sm font-bold text-slate-700">Online Fee Jama (Razorpay)</div>
                                {onlineConfig === null ? (
                                    <p className="text-xs text-gray-400">Online payment ki jaanch ho rahi hai…</p>
                                ) : !onlineConfig.enabled ? (
                                    <>
                                        <Button className="w-full h-11" variant="outline" disabled>Online Fee Jama</Button>
                                        <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                                            Is school ne online payment chalu nahi kiya hai
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-400">₹</span>
                                            <Input type="number" placeholder={totalPayable ? String(totalPayable) : "Rakam"} value={onlineAmount} onChange={(e) => setOnlineAmount(e.target.value)} className="h-10 text-right font-bold"/>
                                        </div>
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 h-11" onClick={() => void handleOnlinePay()} disabled={onlineBusy}>
                                            {onlineBusy ? "Payment chal raha hai…" : "Online Fee Jama"}
                                        </Button>
                                        <p className="text-[11px] text-gray-400">Razorpay ki surakshit window khulegi. Record tabhi banega jab server payment ko verify kar lega.</p>
                                    </>
                                )}
                                {onlineMsg && <p className="text-xs font-medium text-slate-700 bg-slate-50 border rounded px-2 py-1.5">{onlineMsg}</p>}
                            </div>
                        )}
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
            <DialogHeader><DialogTitle className="flex flex-wrap gap-2 justify-between items-center"><span>Payment Receipt</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2"/> Print / PDF</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={sendWhatsApp}><MessageCircle className="h-4 w-4 mr-2"/> WhatsApp</Button></div></DialogTitle></DialogHeader>
            <div className="border p-6 bg-white shadow-sm" ref={receiptRef}>
                <div className="text-center border-b pb-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-800">{schoolInfo.name || "SCHOOL NAME"}</h2>
                    <p className="text-sm text-slate-500">{schoolInfo.address || "Address"}</p>
                    <div className="mt-2 inline-block bg-gray-100 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Fee Receipt</div>
                </div>
                {currentReceipt && (
                    <>
                        <div className="flex flex-wrap gap-3 justify-between text-sm mb-6"><div><p><span className="font-bold">Receipt No:</span> {currentReceipt.receiptNo}</p><p><span className="font-bold">Date:</span> {currentReceipt.date}</p></div><div className="text-right"><p><span className="font-bold">Student:</span> {currentReceipt.student.name}</p><p><span className="font-bold">ID:</span> {currentReceipt.student.admission_no}</p><p><span className="font-bold">Class:</span> {currentReceipt.student.class}</p></div></div>
                        <table className="w-full text-sm border-collapse mb-6"><thead><tr className="border-b-2 border-slate-200"><th className="text-left py-2">Description</th><th className="text-right py-2">Amount</th></tr></thead><tbody>{currentReceipt.items.map((item: any, idx: number) => (<tr key={idx} className="border-b border-slate-100"><td className="py-2">{item.name} {item.month ? `(${item.month})` : ""}</td><td className="text-right py-2 font-mono">₹{item.amount}</td></tr>))}</tbody><tfoot><tr className="border-t-2 border-slate-800 font-bold text-lg"><td className="py-3">Total Paid</td><td className="text-right py-3">₹{currentReceipt.total}</td></tr></tfoot></table>
                    </>
                )}
            </div>
        </DialogContent>
      </Dialog>

      {/* --- KISHTEN BANAO DIALOG (v1.7 FIN) ---
          Class chuno → kul rakam (fee structure se default, badli ja
          sakti hai) → kishton ki sankhya + pehli due date (har mahine
          ek kisht) → preview → Confirm. Server pehle se bani kishten
          skip karta hai; nataija (bani/skip) yahin sach dikhta hai. */}
      <Dialog open={isInstOpen} onOpenChange={setIsInstOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" /> Fee Kishten Banao
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-gray-500 leading-relaxed">
              Ek class ke <b>saare active students</b> ke liye ek saath kishten
              banengi — har kisht ek pending due bankar student ki Fees screen
              par dikhegi aur wahi se vasool hogi. Ek baar bani hui kisht
              (wahi naam + wahi due date) dobara nahi banti — server use skip
              kar deta hai.
            </p>

            <div className="space-y-2 min-w-0">
              <Label>Class</Label>
              <select
                className="w-full border rounded-md p-2 bg-white"
                value={instClass}
                onChange={(e) => void onInstClassChange(e.target.value)}
              >
                <option value="">Class chunein</option>
                {INST_CLASSES.map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              {instClass && instStudentCount != null && (
                <p className="text-[11px] text-gray-500">
                  Is class me {instStudentCount} active student(s) hain — kishten inhi ke liye banengi.
                </p>
              )}
            </div>

            <div className="space-y-2 min-w-0">
              <Label>Kisht ka naam (sab kishton ke naam ki neev)</Label>
              <Input
                value={instTitle}
                onChange={(e) => setInstTitle(e.target.value)}
                placeholder="e.g. Fee Kisht"
              />
              <p className="text-[11px] text-gray-400">Har kisht ka poora naam iske aage number ke saath banega — jaise “{(instTitle.trim() || "Fee Kisht")} 1/{instCountNum || 3}”.</p>
            </div>

            <div className="space-y-2 min-w-0">
              <Label>Kul Rakam (₹) — poori class ke har student par itni rakam ki kishten banengi</Label>
              <Input
                type="number"
                value={instTotal}
                onChange={(e) => setInstTotal(e.target.value)}
                placeholder="e.g. 12000"
              />
              {instClass && (
                instStructure ? (
                  <p className="text-[11px] text-gray-500">
                    Fee structure se default: Monthly ₹{instStructure.monthlyFee || 0} × 12
                    + Admission ₹{instStructure.admissionFee || 0}
                    + Exam ₹{instStructure.examFee || 0}
                    + Annual/Other ₹{instStructure.otherFee || 0}
                    {" "}= ₹{instDefaultTotal}. Chaahein to upar ki rakam badal dein.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700">
                    Is class ki fee structure set nahi hai — kul rakam haath se bharein.
                  </p>
                )
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 min-w-0">
                <Label>Kishton ki sankhya (1–24)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={instCount}
                  onChange={(e) => setInstCount(e.target.value)}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label>Pehli kisht ki due date</Label>
                <Input
                  type="date"
                  value={instFirstDate}
                  onChange={(e) => setInstFirstDate(e.target.value)}
                />
                <p className="text-[11px] text-gray-400">Baaki kishten har mahine usi tareekh par ayengi.</p>
              </div>
            </div>

            {/* PREVIEW */}
            {instPreview.length > 0 ? (
              <div className="rounded-md border bg-slate-50 p-3 space-y-1">
                <div className="text-xs font-bold text-slate-600 uppercase">Preview — har student ke liye ye kishten banengi</div>
                {instPreview.map((item, i) => (
                  <div key={i} className="flex flex-wrap gap-2 justify-between text-sm bg-white border rounded px-2 py-1.5">
                    <span className="font-medium text-slate-700 min-w-0">{item.title}</span>
                    <span className="text-gray-500 text-xs self-center">{new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-IN")}</span>
                    <span className="font-bold text-purple-700">₹{item.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Kul jod (har student)</span>
                  <span>₹{instPreview.reduce((s, x) => s + x.amount, 0)}</span>
                </div>
                <p className="text-[11px] text-gray-400">Rounding ka bacha hua hissa aakhiri kisht me judta hai — kul jod hamesha upar bhari rakam ke barabar rehta hai.</p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-center text-xs text-gray-400">
                Class, kul rakam (₹1 se zyada), kishton ki sankhya (1–24) aur pehli due date bharein — preview yahan dikhega.
              </div>
            )}

            {instError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Kishten nahi bani: {instError}
              </div>
            )}
            {instResult && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
                <div className="font-bold">Ho gaya ✅</div>
                <div>
                  {instResult.studentCount} student(s) × {instPreview.length} kishten me se{" "}
                  <b>{instResult.created} nayi bani</b> aur{" "}
                  <b>{instResult.skipped} pehle se thi</b> (isliye skip ho gayi — dohra charge nahi laga).
                </div>
                <div className="text-xs text-green-700">Bani hui kishten har student ki Pending Dues me dikhengi.</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInstOpen(false)}>Band Karein</Button>
            <Button
              onClick={() => void confirmInst()}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={instBusy || !instClass || instPreview.length === 0}
            >
              {instBusy ? "Ban rahi hain…" : "Pakka — Kishten Banao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}