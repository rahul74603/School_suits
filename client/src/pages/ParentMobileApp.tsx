import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-students";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone,
  Home,
  Megaphone,
  BookOpen,
  CalendarCheck,
  Wallet,
  Bell,
  Bus,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Download,
  LogOut,
  User,
  Award,
  FileText,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  Sparkles,
} from "lucide-react";

type TabType = "home" | "notices" | "study" | "attendance" | "fees";

export default function ParentMobileApp() {
  const { data: user } = useAuth();
  const logout = useLogout();
  const { toast } = useToast();

  const isStaffOrAdmin = user?.role !== "student";
  const { data: allStudents } = useStudents();

  const [previewStudentId, setPreviewStudentId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [studySubTab, setStudySubTab] = useState<"homework" | "timetable">("homework");
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Leave form state inside Parent App
  const [leaveType, setLeaveType] = useState("sick");
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const overviewUrl =
    isStaffOrAdmin && previewStudentId
      ? `/api/parent-app/overview?studentId=${previewStudentId}`
      : "/api/parent-app/overview";

  const {
    data: overview,
    isLoading,
    refetch,
  } = useQuery<any>({
    queryKey: [overviewUrl],
  });

  const applyLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!leaveReason.trim()) throw new Error("कृपया छुट्टी का कारण लिखें (Please enter reason)");
      const res = await apiRequest("POST", "/api/leaves", {
        applicantType: "student",
        studentId: overview?.student?.id ?? undefined,
        leaveType,
        fromDate,
        toDate,
        reason: leaveReason.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [overviewUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaves"] });
      setLeaveReason("");
      toast({
        title: "छुट्टी का आवेदन भेज दिया गया (Leave Sent to Principal)",
        description: "प्रिंसिपल द्वारा स्वीकृत होते ही यहाँ स्टेटस दिख जाएगा।",
      });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleInstallAndroidApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      setShowApkGuide(true);
    }
  };

  const student = overview?.student;
  const school = overview?.school;
  const session = overview?.session;
  const notices: any[] = overview?.notices ?? [];
  const homework: any[] = overview?.homework ?? [];
  const timetable: any[] = overview?.timetable ?? [];
  const attendance = overview?.attendance ?? {
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    percentage: 0,
    todayStatus: null,
    records: [],
  };
  const fees = overview?.fees ?? {
    totalExpected: 0,
    totalPaid: 0,
    totalDiscount: 0,
    pendingBalance: 0,
    payments: [],
  };
  const leaves: any[] = overview?.leaves ?? [];
  const transport = overview?.transport;
  const certificates: any[] = overview?.certificates ?? [];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-start md:py-6">
      {/* Top Preview Bar for School Admin / Principal / Staff */}
      {isStaffOrAdmin && (
        <div className="w-full max-w-4xl mb-4 px-4">
          <div className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" /> ERP Dashboard
              </Link>
              <div>
                <div className="text-sm font-bold flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  Parent Lite Android App Preview (पैरेंट्स मोबाइल ऐप प्रीव्यू)
                </div>
                <div className="text-[11px] text-slate-300">
                  जब माता-पिता बच्चे के ID/Password से लॉगिन करेंगे तो उन्हें अपने फोन पर यही लाइटवेट ऐप दिखेगा।
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={previewStudentId}
                onChange={(e) => setPreviewStudentId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-xs text-white"
              >
                <option value="">-- Preview Any Student (कोई भी बच्चा चुनें) --</option>
                {(allStudents ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.class}-{s.section}) | Adm: {s.admissionNo}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowApkGuide(!showApkGuide)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Android APK कैसे बनेगा?
              </button>
            </div>
          </div>

          {/* Complete Hindi/English Guide on how the Android Lite App & APK works */}
          {showApkGuide && (
            <div className="mt-3 bg-blue-950/90 border border-blue-700 text-blue-50 rounded-2xl p-5 space-y-3 text-xs leading-relaxed shadow-xl">
              <div className="flex items-center justify-between border-b border-blue-800 pb-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Parents के लिए Lightweight Android App कैसे काम करता है? (100% Ready System)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowApkGuide(false)}
                  className="text-blue-300 hover:text-white font-bold"
                >
                  ✕ बंद करें
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900/80 border border-blue-800/60 p-3.5 rounded-xl space-y-1.5">
                  <div className="font-bold text-amber-300">
                    1. एक ही Database व Server (अलग सिस्टम नहीं बनाना!)
                  </div>
                  <p className="text-slate-200">
                    स्कूल में आप कंप्यूटर पर जो भी **Attendance, Notice, Homework, Fee Receipt, Exam Result या Leave Approval** करेंगे, वह **तुरंत रियल-टाइम में** पैरेंट्स के इस मोबाइल ऐप में दिखेगा।
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-blue-800/60 p-3.5 rounded-xl space-y-1.5">
                  <div className="font-bold text-emerald-300">
                    2. तरीका A: Direct Android Lite App (केवल 500 KB — बिना Play Store खर्चे के)
                  </div>
                  <p className="text-slate-200">
                    हमने इसमें **PWA (Android WebAPK)** लगा दिया है। जब पैरेंट्स अपने फोन के Chrome में स्कूल का लिंक खोलकर **"Install App"** दबाएंगे, तो फोन की होम-स्क्रीन पर **School App आइकॉन** बन जाएगा और बिना ब्राउज़र बार के असली ऐप की तरह खुलेगा!
                  </p>
                </div>

                <div className="bg-slate-900/80 border border-blue-800/60 p-3.5 rounded-xl space-y-1.5">
                  <div className="font-bold text-cyan-300">
                    3. तरीका B: WhatsApp या Play Store के लिए `.apk` फाइल (2 MB Lite APK)
                  </div>
                  <p className="text-slate-200">
                    जब आप इस सॉफ्टवेयर को ऑनलाइन सर्वर (VPS / Render / Railway / Cloud) पर डाल देंगे, तो **PWABuilder.com** या **Android WebView / Capacitor** से 2 मिनट में **2 MB की `.apk` फाइल** बन जाती है जिसे आप WhatsApp ग्रुप पर सभी पैरेंट्स को भेज सकते हैं!
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 text-[11px] text-slate-200">
                <strong>पैरेंट्स का ID / Password कहाँ से बनेगा?</strong> 👉 बाएं मेनू में{" "}
                <Link href="/settings" className="text-amber-300 underline font-bold">
                  Settings → Student Portal Logins → Generate All Missing Student Logins (1-Click)
                </Link>{" "}
                पर क्लिक करते ही पूरे स्कूल के बच्चों का Login ID (Admission No) और Password (`student123`) एक क्लिक में तैयार हो जाता है!
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Phone Container (Full screen on Mobile, Phone Frame on Desktop) */}
      <div className="w-full max-w-md bg-slate-50 min-h-screen md:min-h-[820px] md:max-h-[880px] md:rounded-[36px] md:border-[8px] md:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Android Status & App Header Bar */}
        <header className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white px-4 pt-4 pb-5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center font-extrabold text-lg border border-white/25">
                🏫
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight line-clamp-1">
                  {school?.name || "School Parent App"}
                </h1>
                <p className="text-[11px] text-blue-100">
                  Session: {session?.name || "Current Session"} • Lite Parent Portal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleInstallAndroidApp}
                className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold flex items-center gap-1 border border-white/20"
                title="Install Lite App on Phone"
              >
                <Download className="w-3.5 h-3.5" /> App
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {!isStaffOrAdmin && (
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-600"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Child Identity Pill inside App Header */}
          {student && (
            <div className="mt-3.5 bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white text-blue-700 font-extrabold text-base flex items-center justify-center shadow">
                  {student.name?.charAt(0) || "S"}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{student.name}</div>
                  <div className="text-[11px] text-blue-100">
                    Class {student.class}-{student.section}
                    {student.stream ? ` (${student.stream})` : ""} • Roll:{" "}
                    {student.rollNo || "-"}
                  </div>
                  <div className="text-[10px] text-blue-200 font-mono">
                    Adm No: {student.admissionNo} | Father: Shri {student.fatherName}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    attendance.todayStatus === "present"
                      ? "bg-emerald-400 text-slate-950"
                      : attendance.todayStatus === "absent"
                      ? "bg-rose-400 text-white"
                      : "bg-amber-300 text-slate-950"
                  }`}
                >
                  {attendance.todayStatus
                    ? `Today: ${attendance.todayStatus}`
                    : "Active"}
                </span>
              </div>
            </div>
          )}
        </header>

        {/* Scrollable App Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              Loading child information...
            </div>
          ) : !student ? (
            <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 space-y-2">
              <User className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-800">No Student Linked Yet</div>
              <p className="text-xs text-slate-500">
                कृपया स्कूल एडमिन से संपर्क करें या ऊपर ड्रॉपडाउन से कोई विद्यार्थी चुनें।
              </p>
            </div>
          ) : (
            <>
              {/* ================= TAB 1: HOME ================= */}
              {activeTab === "home" && (
                <div className="space-y-4">
                  {/* 4 Quick Highlights */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab("attendance")}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Attendance (उपस्थिति)
                        </span>
                        <CalendarCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1">
                        {attendance.percentage}%
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium">
                        {attendance.presentDays} Present / {attendance.totalDays} Days
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("fees")}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Pending Fee (बकाया फीस)
                        </span>
                        <Wallet className="w-4 h-4 text-amber-600" />
                      </div>
                      <div
                        className={`text-2xl font-extrabold mt-1 ${
                          fees.pendingBalance > 0 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        ₹{fees.pendingBalance.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Paid: ₹{fees.totalPaid.toLocaleString("en-IN")}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("study");
                        setStudySubTab("homework");
                      }}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Homework (होमवर्क)
                        </span>
                        <BookOpen className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {homework.length} Tasks
                      </div>
                      <div className="text-[11px] text-blue-600 font-medium">
                        Class {student.class}-{student.section}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("notices")}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          School Notices (सूचनाएं)
                        </span>
                        <Bell className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="text-xl font-extrabold text-slate-900 mt-1">
                        {notices.length} Notices
                      </div>
                      <div className="text-[11px] text-purple-600 font-medium">
                        Tap to read circulars
                      </div>
                    </button>
                  </div>

                  {/* Latest School Notices on Home */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Megaphone className="w-4 h-4 text-blue-600" />
                        Latest School Notices (स्कूल की ताज़ा सूचनाएं)
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab("notices")}
                        className="text-[11px] text-blue-600 font-semibold"
                      >
                        View All →
                      </button>
                    </div>

                    {notices.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        कोई नई सूचना नहीं है (No active notices).
                      </p>
                    ) : (
                      notices.slice(0, 2).map((n: any) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-900">{n.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase font-semibold">
                              {n.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-2">{n.content}</p>
                          <div className="text-[10px] text-slate-400">{n.publishDate}</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Today's Homework Preview */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        Recent Homework (आज का होमवर्क)
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("study");
                          setStudySubTab("homework");
                        }}
                        className="text-[11px] text-blue-600 font-semibold"
                      >
                        See All →
                      </button>
                    </div>

                    {homework.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">
                        अभी कोई होमवर्क असाइन नहीं किया गया है।
                      </p>
                    ) : (
                      homework.slice(0, 3).map((hw: any) => (
                        <div
                          key={hw.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2"
                        >
                          <div>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 mb-1">
                              {hw.subjectName}
                            </span>
                            <div className="font-bold text-xs text-slate-900">{hw.title}</div>
                            {hw.description && (
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                                {hw.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-slate-400">Due Date</div>
                            <div className="text-[11px] font-bold text-rose-600">
                              {hw.dueDate}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* School Bus / Transport Card */}
                  {transport && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                          <Bus className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Bus: {transport.routeName} ({transport.vehicleNo})
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Stop: {transport.stopName} • Driver: {transport.driverName || "-"}
                          </div>
                        </div>
                      </div>
                      {transport.driverPhone && (
                        <a
                          href={`tel:${transport.driverPhone}`}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                    </div>
                  )}

                  {/* School Helpline Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        School Office Helpline (स्कूल कार्यालय संपर्क)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {school?.contactPhone || "Contact School Office"} • {school?.email || ""}
                      </div>
                    </div>
                    {school?.contactPhone && (
                      <a
                        href={`tel:${school.contactPhone}`}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call School
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ================= TAB 2: NOTICES ================= */}
              {activeTab === "notices" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl p-4 border border-slate-200">
                    <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-blue-600" />
                      School Notice Board (स्कूल सूचना पट्ट)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      छुट्टी, परीक्षा, PTM एवं स्कूल के सभी आधिकारिक सर्कुलर
                    </p>
                  </div>

                  {notices.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-200">
                      अभी कोई सूचना जारी नहीं की गई है।
                    </div>
                  ) : (
                    notices.map((n: any) => (
                      <div
                        key={n.id}
                        className={`bg-white rounded-2xl p-4 border shadow-sm space-y-2 ${
                          n.isPinned ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {n.category}
                          </span>
                          <span className="text-[11px] text-slate-400">{n.publishDate}</span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900">{n.title}</h3>
                        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                          {n.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ================= TAB 3: STUDY (HOMEWORK & TIMETABLE) ================= */}
              {activeTab === "study" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setStudySubTab("homework")}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        studySubTab === "homework"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      📚 Homework ({homework.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudySubTab("timetable")}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        studySubTab === "timetable"
                          ? "bg-white text-blue-700 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      🕒 Class Timetable
                    </button>
                  </div>

                  {studySubTab === "homework" ? (
                    homework.length === 0 ? (
                      <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-200">
                        Class {student.class}-{student.section} के लिए अभी कोई होमवर्क नहीं है।
                      </div>
                    ) : (
                      homework.map((hw: any) => (
                        <div
                          key={hw.id}
                          className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              {hw.subjectName}
                            </span>
                            <span className="text-[11px] font-semibold text-rose-600">
                              Due: {hw.dueDate}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-slate-900">{hw.title}</div>
                          {hw.description && (
                            <p className="text-xs text-slate-600 whitespace-pre-line">
                              {hw.description}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 pt-1">
                            Assigned: {hw.assignedDate} • By {hw.teacherName}
                          </div>
                        </div>
                      ))
                    )
                  ) : timetable.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-200">
                      Class {student.class}-{student.section} का टाइम-टेबल अभी उपलब्ध नहीं है।
                    </div>
                  ) : (
                    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                      (day) => {
                        const daySlots = timetable
                          .filter((t: any) => t.dayOfWeek === day)
                          .sort((a: any, b: any) => a.periodNo - b.periodNo);
                        if (!daySlots.length) return null;
                        return (
                          <div
                            key={day}
                            className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2"
                          >
                            <div className="font-bold text-xs uppercase tracking-wider text-blue-700 border-b border-slate-100 pb-1.5">
                              {day}
                            </div>
                            <div className="space-y-1.5">
                              {daySlots.map((slot: any) => (
                                <div
                                  key={slot.id}
                                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800">
                                      P{slot.periodNo}: {slot.subjectName}
                                    </span>
                                    <div className="text-[11px] text-slate-500">
                                      Teacher: {slot.teacherName}
                                    </div>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-600">
                                    {slot.startTime}–{slot.endTime}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              )}

              {/* ================= TAB 4: ATTENDANCE & LEAVE ================= */}
              {activeTab === "attendance" && (
                <div className="space-y-4">
                  {/* Summary Card */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="font-bold text-sm text-slate-900">
                          Attendance Record (उपस्थिति रिकॉर्ड)
                        </h2>
                        <p className="text-[11px] text-slate-500">
                          Total Working Days Logged: {attendance.totalDays}
                        </p>
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-600">
                        {attendance.percentage}%
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="text-lg font-bold text-emerald-700">
                          {attendance.presentDays}
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-800">
                          Present (उपस्थित)
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                        <div className="text-lg font-bold text-rose-700">
                          {attendance.absentDays}
                        </div>
                        <div className="text-[10px] font-semibold text-rose-800">
                          Absent (अनुपस्थित)
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="text-lg font-bold text-amber-700">
                          {attendance.lateDays}
                        </div>
                        <div className="text-[10px] font-semibold text-amber-800">
                          Late / Leave
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Apply for Child Leave directly from Parent App */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-blue-600" />
                      Apply for Child Leave (बच्चे की छुट्टी के लिए आवेदन करें)
                    </h3>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">
                          Leave Type
                        </label>
                        <select
                          value={leaveType}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        >
                          <option value="sick">Sick (बीमारी)</option>
                          <option value="casual">Casual (आकस्मिक)</option>
                          <option value="emergency">Urgent (अति आवश्यक)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600">
                        Reason for Leave (छुट्टी का कारण लिखें) *
                      </label>
                      <input
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="उदा. बुखार होने के कारण 2 दिन का अवकाश..."
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => applyLeaveMutation.mutate()}
                      disabled={!leaveReason.trim() || applyLeaveMutation.isPending}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs disabled:opacity-50"
                    >
                      {applyLeaveMutation.isPending
                        ? "Sending..."
                        : "Submit Leave Application to Principal"}
                    </button>
                  </div>

                  {/* Leave Status History */}
                  {leaves.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                        Leave Applications Status (छुट्टी के आवेदन की स्थिति)
                      </h3>
                      {leaves.map((l: any) => (
                        <div
                          key={l.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-800">
                              {l.fromDate} → {l.toDate} ({l.leaveType})
                            </div>
                            <div className="text-[11px] text-slate-500">{l.reason}</div>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              l.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : l.status === "rejected"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {l.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Daily Attendance Log */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Recent Daily Attendance (दैनिक उपस्थिति)
                    </h3>
                    {attendance.records.length === 0 ? (
                      <p className="text-xs text-slate-400">No attendance records yet.</p>
                    ) : (
                      attendance.records.slice(0, 10).map((r: any) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-xs"
                        >
                          <span className="font-medium text-slate-700">{r.attendanceDate}</span>
                          <span
                            className={`inline-flex items-center gap-1 font-bold uppercase text-[11px] ${
                              r.status === "present"
                                ? "text-emerald-600"
                                : r.status === "absent"
                                ? "text-rose-600"
                                : "text-amber-600"
                            }`}
                          >
                            {r.status === "present" ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : r.status === "absent" ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {r.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ================= TAB 5: FEES, RESULTS & PROFILE ================= */}
              {activeTab === "fees" && (
                <div className="space-y-4">
                  {/* Fee Summary Card */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                    <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-blue-600" />
                      School Fee Statement (फीस का विवरण)
                    </h2>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-sm font-bold text-slate-800">
                          ₹{fees.totalExpected.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-slate-500">Total Fee</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="text-sm font-bold text-emerald-700">
                          ₹{fees.totalPaid.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-emerald-800">Paid (जमा)</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="text-sm font-bold text-amber-700">
                          ₹{fees.pendingBalance.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-amber-800">Pending (शेष)</div>
                      </div>
                    </div>

                    {/* Recent Fee Receipts */}
                    <div className="space-y-1.5 pt-2">
                      <div className="text-xs font-bold text-slate-700">
                        Fee Payment Receipts (जमा फीस की रसीदें)
                      </div>
                      {fees.payments.length === 0 ? (
                        <p className="text-xs text-slate-400">No fee payments recorded yet.</p>
                      ) : (
                        fees.payments.map((p: any) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-800">
                                Receipt #{p.receiptNo}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {p.paymentDate} • {p.paymentMode}
                              </div>
                            </div>
                            <div className="font-bold text-emerald-700">
                              ₹{Number(p.amountPaid).toLocaleString("en-IN")}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Quick Links to Report Card & Certificates */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href="/report-cards"
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 hover:border-blue-400"
                    >
                      <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Report Card</div>
                        <div className="text-[10px] text-slate-500">परीक्षा परिणाम देखें</div>
                      </div>
                    </Link>

                    <Link
                      href="/certificates"
                      className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 hover:border-blue-400"
                    >
                      <Award className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Certificates ({certificates.length})
                        </div>
                        <div className="text-[10px] text-slate-500">स्कूल प्रमाण-पत्र</div>
                      </div>
                    </Link>
                  </div>

                  {/* Complete Child Profile Details */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Complete Student Profile (विद्यार्थी का पूरा विवरण)
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Father's Name</span>
                        <span className="font-semibold text-slate-800">
                          Shri {student.fatherName}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Mother's Name</span>
                        <span className="font-semibold text-slate-800">
                          Smt. {student.motherName || "-"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Date of Birth</span>
                        <span className="font-semibold text-slate-800">
                          {student.dob || "-"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Blood Group</span>
                        <span className="font-semibold text-slate-800">
                          {student.bloodGroup || "-"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">Samagra ID</span>
                        <span className="font-semibold text-slate-800">
                          {student.samagraId || "-"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50">
                        <span className="text-[10px] text-slate-400 block">PEN / APAAR ID</span>
                        <span className="font-semibold text-slate-800">
                          {student.penNumber || student.apaarId || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Native Android Style 5-Tab Bottom Navigation Bar */}
        <nav className="absolute bottom-0 inset-x-0 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
          {[
            { id: "home", label: "Home", hindi: "होम", icon: Home },
            { id: "notices", label: "Notices", hindi: "सूचना", icon: Megaphone },
            { id: "study", label: "Study", hindi: "पढ़ाई", icon: BookOpen },
            { id: "attendance", label: "Attendance", hindi: "उपस्थिति", icon: CalendarCheck },
            { id: "fees", label: "Fees & Info", hindi: "फीस/रिजल्ट", icon: Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                  active ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5px]" : ""}`} />
                <span className="text-[10px] mt-0.5 leading-none">{tab.label}</span>
                <span className="text-[9px] text-slate-400 leading-tight">{tab.hindi}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
