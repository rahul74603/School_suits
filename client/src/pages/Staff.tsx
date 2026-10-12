import { useStaff, useCreateStaff, useUpdateStaff } from "@/hooks/use-staff";
import { QueryError } from "@/components/QueryState";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  UserPlus,
  Search,
  KeyRound,
  BookOpen,
  Trash2,
  Radio,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStaffSchema, type Staff as StaffType } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { z } from "zod";

const PERIOD_PRESETS = [
  { periodNo: 1, label: "Period 1 (08:00 - 08:45)", start: "08:00", end: "08:45" },
  { periodNo: 2, label: "Period 2 (08:45 - 09:30)", start: "08:45", end: "09:30" },
  { periodNo: 3, label: "Period 3 (09:30 - 10:15)", start: "09:30", end: "10:15" },
  { periodNo: 4, label: "Period 4 (10:30 - 11:15)", start: "10:30", end: "11:15" },
  { periodNo: 5, label: "Period 5 (11:15 - 12:00)", start: "11:15", end: "12:00" },
  { periodNo: 6, label: "Period 6 (12:00 - 12:45)", start: "12:00", end: "12:45" },
  { periodNo: 7, label: "Period 7 (13:15 - 14:00)", start: "13:15", end: "14:00" },
  { periodNo: 8, label: "Period 8 (14:00 - 14:45)", start: "14:00", end: "14:45" },
];

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export default function Staff() {
  const { data: user } = useAuth();
  const { classOptions, sectionOptions, subjects, subjectMap } = useSchoolCatalog();
  const isManager = user?.role === "admin" || user?.role === "principal";
  const qc = useQueryClient();
  const { data: staff, isLoading, isError, error, refetch } = useStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { toast } = useToast();

  // Live clock for real-time teacher status
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const currentDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingStaff, setEditingStaff] = useState<number | null>(null);

  // Integrated Login Creation inside Add Staff Dialog
  const [createLoginNow, setCreateLoginNow] = useState(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRole, setLoginRole] = useState("teacher");

  // Standalone Create Login Dialog for existing staff
  const [loginTargetStaff, setLoginTargetStaff] = useState<StaffType | null>(null);
  const [modalUsername, setModalUsername] = useState("");
  const [modalPassword, setModalPassword] = useState("");
  const [modalRole, setModalRole] = useState("teacher");

  // Unified Assign Class, Section, Subject & Period Modal
  const [assignTargetUser, setAssignTargetUser] = useState<{
    userId: number;
    staffName: string;
  } | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(["1"]);
  const [selectedSectionName, setSelectedSectionName] = useState("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [includeSchedule, setIncludeSchedule] = useState(true);
  const [periodClass, setPeriodClass] = useState("1");
  const [periodSection, setPeriodSection] = useState("A");
  const [selectedDays, setSelectedDays] = useState<string[]>([...ALL_DAYS]);
  const [periodNo, setPeriodNo] = useState("1");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");

  const schoolUsers = useQuery<any[]>({
    queryKey: ["/api/school-users"],
    queryFn: async () => {
      const res = await fetch("/api/school-users", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && isManager,
  });

  const staffLinks = useQuery<any[]>({
    queryKey: ["/api/payroll/staff-links"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/staff-links", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && isManager,
  });

  const assignments = useQuery<{ subjects: any[]; classes: any[] }>({
    queryKey: ["/api/teacher-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/teacher-assignments", { credentials: "include" });
      return res.ok ? res.json() : { subjects: [], classes: [] };
    },
    enabled: !!user && isManager,
  });

  const timetable = useQuery<any[]>({
    queryKey: ["/api/timetable"],
    queryFn: async () => {
      const res = await fetch("/api/timetable", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const conflicts = useQuery<any[]>({
    queryKey: ["/api/timetable/conflicts"],
    queryFn: async () => {
      const res = await fetch("/api/timetable/conflicts", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user && isManager,
  });

  const resolveConflictsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/timetable/resolve-conflicts", {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
      toast({
        title: "Duplicate & Clashing Periods Cleaned!",
        description: `Removed ${res?.removed ?? 0} clashing entries so no teacher or classroom has a same-time conflict.`,
      });
    },
  });

  const userById = new Map((schoolUsers.data ?? []).map((u) => [u.id, u]));
  const linkByStaffId = new Map((staffLinks.data ?? []).map((l) => [l.staffId, l]));

  const form = useForm({
    resolver: zodResolver(insertStaffSchema),
    defaultValues: {
      name: "",
      designation: "Teacher",
      basicSalary: 15000,
      contact: "",
    },
  });

  const createLoginMutation = useMutation({
    mutationFn: (payload: {
      username: string;
      name: string;
      role: string;
      password: string;
      staffId: number;
    }) => apiRequest("POST", "/api/school-users", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/school-users"] });
      qc.invalidateQueries({ queryKey: ["/api/payroll/staff-links"] });
      toast({
        title: "Login account created & linked!",
        description: "Staff member can now sign in with their Login ID / Email and password.",
      });
      setLoginTargetStaff(null);
      setModalUsername("");
      setModalPassword("");
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Could not create login account",
        description: err.message,
      }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/teacher-class-assignments/bulk", {
        teacherUserId: assignTargetUser?.userId,
        classes: selectedClasses,
        section: selectedSectionName,
        subjectId: selectedSubjectId ? Number(selectedSubjectId) : null,
        schedule:
          includeSchedule && selectedSubjectId && selectedDays.length > 0
            ? {
                days: selectedDays,
                periodNo: Number(periodNo),
                startTime,
                endTime,
                periodClass,
                periodSection,
              }
            : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
      toast({
        title: "Saved without any clash!",
        description: includeSchedule
          ? `Authorized classes saved & Period ${periodNo} (${startTime}–${endTime}) scheduled for Class ${periodClass}-${periodSection}.`
          : `Assigned ${selectedClasses.map((c) => `Class ${c}`).join(", ")}.`,
      });
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Schedule Clash / Error",
        description: err.message,
      }),
  });

  const removeSubjectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-subject-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

  const removeClassMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-class-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

  const removePeriodMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timetable"] });
      qc.invalidateQueries({ queryKey: ["/api/timetable/conflicts"] });
    },
  });

  const toggleClassSelection = (cls: string) => {
    setSelectedClasses((prev) => {
      const next = prev.includes(cls) ? prev.filter((item) => item !== cls) : [...prev, cls];
      if (next.length > 0 && !next.includes(periodClass)) {
        setPeriodClass(next[0]);
      }
      return next;
    });
  };

  const selectClassRange = (list: string[]) => {
    const filtered = list.filter((c) => classOptions.includes(c));
    setSelectedClasses(filtered);
    if (filtered.length > 0) setPeriodClass(filtered[0]);
  };

  const onSubmit = (data: z.infer<typeof insertStaffSchema>) => {
    if (editingStaff) {
      updateStaff.mutate(
        { id: editingStaff, ...data },
        {
          onSuccess: () => {
            setOpen(false);
            setEditingStaff(null);
            form.reset();
            toast({ title: "Staff member updated" });
          },
          onError: (err: Error) =>
            toast({
              variant: "destructive",
              title: "Staff update failed",
              description: err.message,
            }),
        },
      );
      return;
    }

    createStaff.mutate(data, {
      onSuccess: async (createdStaff) => {
        if (createLoginNow && loginUsername.trim() && loginPassword.trim()) {
          try {
            await apiRequest("POST", "/api/school-users", {
              username: loginUsername.trim(),
              name: data.name,
              role: loginRole,
              password: loginPassword,
              staffId: createdStaff.id,
            });
            qc.invalidateQueries({ queryKey: ["/api/school-users"] });
            qc.invalidateQueries({ queryKey: ["/api/payroll/staff-links"] });
            toast({
              title: "Staff & Login Account Created!",
              description: `${data.name} can now log in with ID "${loginUsername.trim()}".`,
            });
          } catch (err) {
            toast({
              variant: "destructive",
              title: "Staff added, but login creation failed",
              description:
                err instanceof Error
                  ? err.message
                  : "You can click 'Create Login ID' on their row.",
            });
          }
        } else {
          toast({ title: "Staff member added successfully" });
        }
        setOpen(false);
        setEditingStaff(null);
        setLoginUsername("");
        setLoginPassword("");
        form.reset();
      },
      onError: (err: Error) =>
        toast({
          variant: "destructive",
          title: "Staff operation failed",
          description: err.message,
        }),
    });
  };

  const filteredStaff = staff?.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.designation.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Staff & Teachers Directory
            </h1>
            <p className="text-slate-500 mt-1">
              Manage teachers, login ID/email, class authorizations, and clash-free live periods
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-700 flex items-center gap-2 shadow-sm">
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>
                <b>Live Clock:</b> {currentDayName},{" "}
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingStaff(null);
                    setCreateLoginNow(true);
                    setLoginUsername("");
                    setLoginPassword("");
                    setLoginRole("teacher");
                    form.reset({
                      name: "",
                      designation: "Teacher",
                      basicSalary: 15000,
                      contact: "",
                    });
                  }}
                  className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Teacher / Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingStaff ? "Edit Staff Member" : "Add New Teacher / Staff Member"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Pankaj Sharma" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="designation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Designation</FormLabel>
                            <FormControl>
                              <select
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                                value={field.value}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  const val = e.target.value;
                                  if (val === "Teacher") setLoginRole("teacher");
                                  else if (val === "Principal") setLoginRole("principal");
                                  else if (val === "Accountant") setLoginRole("accountant");
                                  else setLoginRole("staff");
                                }}
                              >
                                <option value="Teacher">Teacher</option>
                                <option value="Principal">Principal</option>
                                <option value="Accountant">Accountant</option>
                                <option value="Clerk">Clerk</option>
                                <option value="Peon">Support Staff / Peon</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="basicSalary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Basic Salary (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value || "0", 10))
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <FormControl>
                            <Input placeholder="10-digit mobile" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!editingStaff && isManager && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-indigo-950 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createLoginNow}
                            onChange={(e) => setCreateLoginNow(e.target.checked)}
                          />
                          Also create Login Account (Email / Username & Role) right now
                        </label>

                        {createLoginNow && (
                          <div className="space-y-3 pt-1">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                  Login ID or Email
                                </label>
                                <Input
                                  className="bg-white"
                                  placeholder="e.g., sharma@school.com"
                                  value={loginUsername}
                                  onChange={(e) => setLoginUsername(e.target.value)}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">
                                  App Role
                                </label>
                                <select
                                  className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                                  value={loginRole}
                                  onChange={(e) => setLoginRole(e.target.value)}
                                >
                                  <option value="teacher">Teacher</option>
                                  <option value="accountant">Accountant</option>
                                  <option value="principal">Principal</option>
                                  <option value="staff">Staff / Office</option>
                                  {user?.role === "admin" && <option value="admin">Admin</option>}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Login Password (min 6 characters)
                              </label>
                              <Input
                                type="password"
                                className="bg-white"
                                placeholder="e.g., Teacher@123"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={createStaff.isPending}>
                      {createStaff.isPending
                        ? "Saving..."
                        : editingStaff
                          ? "Save Changes"
                          : createLoginNow && loginUsername.trim()
                            ? "Add Staff & Create Login Account"
                            : "Add Staff Member"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* CLASH DETECTOR BANNER */}
        {isManager && (conflicts.data ?? []).length > 0 && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                ⚠️ Duplicate / Same-Time Period Clash Detected ({conflicts.data!.length} conflicts)
              </div>
              <p className="text-xs text-red-800">
                {conflicts.data![0]?.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={resolveConflictsMutation.isPending}
              onClick={() => resolveConflictsMutation.mutate()}
            >
              {resolveConflictsMutation.isPending
                ? "Cleaning Clashes..."
                : "1-Click Clean All Duplicate Clashes"}
            </Button>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-border mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search teachers or staff..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name & Designation</TableHead>
                <TableHead>Login ID / Email & Role</TableHead>
                <TableHead>Assigned Classes & Subjects</TableHead>
                <TableHead>Live Status (Right Now)</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <QueryError
                      message={error instanceof Error ? error.message : "Unable to load staff."}
                      onRetry={() => refetch()}
                    />
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading staff...
                  </TableCell>
                </TableRow>
              ) : filteredStaff?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No staff found. Click &ldquo;Add Teacher / Staff&rdquo; above to add your first teacher!
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff?.map((s) => {
                  const link = linkByStaffId.get(s.id);
                  const linkedUser = link ? userById.get(link.userId) : undefined;
                  const teacherClasses = linkedUser
                    ? (assignments.data?.classes ?? []).filter(
                        (ca) => ca.teacherUserId === linkedUser.id,
                      )
                    : [];
                  const teacherSubjects = linkedUser
                    ? (assignments.data?.subjects ?? []).filter(
                        (sa) => sa.teacherUserId === linkedUser.id,
                      )
                    : [];
                  const teacherPeriods = linkedUser
                    ? (timetable.data ?? []).filter((t) => t.teacherUserId === linkedUser.id)
                    : [];
                  const livePeriodNow = teacherPeriods.find((t) => {
                    if (t.dayOfWeek !== currentDayName) return false;
                    const st = timeToMinutes(t.startTime);
                    const et = timeToMinutes(t.endTime);
                    return st !== -1 && et !== -1 && currentMinutes >= st && currentMinutes <= et;
                  });

                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <span
                          className={`mt-1 inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            s.designation === "Teacher"
                              ? "bg-purple-50 text-purple-700"
                              : s.designation === "Principal"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.designation}
                        </span>
                      </TableCell>
                      <TableCell>
                        {linkedUser ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs font-semibold text-indigo-700">
                              {linkedUser.username}
                            </div>
                            <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                              Role: {linkedUser.role}
                            </span>
                          </div>
                        ) : isManager ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-indigo-200 text-indigo-700"
                            onClick={() => {
                              setLoginTargetStaff(s);
                              const suggested = s.name
                                .toLowerCase()
                                .replace(/[^a-z0-9]/g, "")
                                .slice(0, 14);
                              setModalUsername(suggested ? `${suggested}@school.com` : "");
                              setModalPassword("");
                              setModalRole(
                                s.designation === "Teacher"
                                  ? "teacher"
                                  : s.designation === "Principal"
                                    ? "principal"
                                    : s.designation === "Accountant"
                                      ? "accountant"
                                      : "staff",
                              );
                            }}
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            Create Login ID
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">No login linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {linkedUser && linkedUser.role === "teacher" ? (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1">
                              {teacherClasses.map((ca) => (
                                <span
                                  key={ca.id}
                                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                                >
                                  Class {ca.className}-
                                  {ca.section === "ALL" ? "All Sections" : ca.section}
                                </span>
                              ))}
                              {teacherSubjects.map((sa) => (
                                <span
                                  key={sa.id}
                                  className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                                >
                                  {subjectMap.get(sa.subjectId)?.name ?? `Subj #${sa.subjectId}`}
                                </span>
                              ))}
                            </div>
                            {isManager && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100"
                                onClick={() =>
                                  setAssignTargetUser({
                                    userId: linkedUser.id,
                                    staffName: s.name,
                                  })
                                }
                              >
                                <BookOpen className="w-3.5 h-3.5 mr-1" />
                                Assign Class, Subject & Period
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {linkedUser ? "—" : "Create Teacher Login first"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {livePeriodNow ? (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
                              LIVE: Class {livePeriodNow.className}-
                              {livePeriodNow.section}
                            </div>
                            <div className="text-emerald-700 font-medium mt-0.5">
                              {subjectMap.get(livePeriodNow.subjectId)?.name ?? "Subject"} · P
                              {livePeriodNow.periodNo} ({livePeriodNow.startTime}–
                              {livePeriodNow.endTime})
                            </div>
                          </div>
                        ) : teacherPeriods.length > 0 ? (
                          <div className="text-xs text-slate-500">
                            <span className="inline-block h-2 w-2 rounded-full bg-slate-300 mr-1.5" />
                            Free right now ({teacherPeriods.length} scheduled slots)
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No period scheduled</span>
                        )}
                      </TableCell>
                      <TableCell>{s.contact}</TableCell>
                      <TableCell>₹{s.basicSalary.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingStaff(s.id);
                            form.reset({
                              name: s.name,
                              designation: s.designation,
                              basicSalary: s.basicSalary,
                              contact: s.contact,
                            });
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create Login Account Modal for existing staff */}
        <Dialog
          open={!!loginTargetStaff}
          onOpenChange={(openState) => !openState && setLoginTargetStaff(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Create Login Account for {loginTargetStaff?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Login ID / Email Address
                </label>
                <Input
                  placeholder="e.g., pankajsharma@school.com"
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">System Role</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={modalRole}
                  onChange={(e) => setModalRole(e.target.value)}
                >
                  <option value="teacher">Teacher (Attendance, Homework, Exams)</option>
                  <option value="accountant">Accountant (Fees, Payroll, Expenses)</option>
                  <option value="principal">Principal (Full Academic & Staff Access)</option>
                  <option value="staff">Staff (Admissions, Students, Transport)</option>
                  {user?.role === "admin" && <option value="admin">Admin</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Initial Password (min 6 characters)
                </label>
                <Input
                  type="password"
                  placeholder="Enter password (e.g., Teacher@123)"
                  value={modalPassword}
                  onChange={(e) => setModalPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLoginTargetStaff(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    createLoginMutation.isPending ||
                    !modalUsername.trim() ||
                    modalPassword.length < 6
                  }
                  onClick={() => {
                    if (!loginTargetStaff) return;
                    createLoginMutation.mutate({
                      username: modalUsername.trim(),
                      name: loginTargetStaff.name,
                      role: modalRole,
                      password: modalPassword,
                      staffId: loginTargetStaff.id,
                    });
                  }}
                >
                  {createLoginMutation.isPending ? "Creating..." : "Create & Link Account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Unified Assign Classes, Sections, Subject & Clash-Free Live Period Modal */}
        <Dialog
          open={!!assignTargetUser}
          onOpenChange={(openState) => !openState && setAssignTargetUser(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Assign Classes, Subject & Clash-Free Period — {assignTargetUser?.staffName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Step 1: Select 1 or Multiple Classes for Teacher Access */}
              <div className="rounded-lg border bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">
                    1. Teacher Authorized Class(es) (Attendance / Homework / Marks Access)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => selectClassRange(["1", "2", "3", "4", "5"])}
                    >
                      1st to 5th
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => selectClassRange(["6", "7", "8"])}
                    >
                      6th to 8th
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => selectClassRange(["9", "10"])}
                    >
                      9th & 10th
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => selectClassRange(["11", "12"])}
                    >
                      11th & 12th
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {classOptions.map((cls) => {
                    const active = selectedClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClassSelection(cls)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {active ? "✓ " : ""}Class {cls}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. Authorized Section Scope (Dropdown)
                    </label>
                    <select
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm font-medium"
                      value={selectedSectionName}
                      onChange={(e) => {
                        setSelectedSectionName(e.target.value);
                        if (e.target.value !== "ALL") setPeriodSection(e.target.value);
                      }}
                    >
                      <option value="ALL">
                        All Sections (A, B, C, D... Sabhi Sections ka Access)
                      </option>
                      {sectionOptions.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec} Only
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      3. Subject (Dropdown)
                    </label>
                    <select
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm font-medium"
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                    >
                      <option value="">Select Subject...</option>
                      {subjects.map((subj) => (
                        <option key={subj.id} value={subj.id}>
                          {subj.name} {subj.code ? `(${subj.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 2: Live Classroom Period (1 Teacher = 1 Specific Class + 1 Specific Section per Period!) */}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSchedule}
                    onChange={(e) => setIncludeSchedule(e.target.checked)}
                  />
                  <Clock className="w-4 h-4 text-indigo-600" />
                  4. Schedule Live Classroom Period (1 Teacher = 1 Classroom at a Time)
                </label>

                {includeSchedule && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-indigo-900 bg-white/80 rounded p-2 border border-indigo-100">
                      <b>Anti-Clash Rule:</b> Ek period/time par ek teacher sirf <b>1 specific Class + 1 specific Section</b> me live padha sakta hai. Niche chunein ki is Period me teacher kis classroom me jayega:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Classroom (Class)
                        </label>
                        <select
                          className="h-9 w-full rounded-md border bg-white px-2 text-xs font-semibold"
                          value={periodClass}
                          onChange={(e) => setPeriodClass(e.target.value)}
                        >
                          {classOptions.map((c) => (
                            <option key={c} value={c}>
                              Class {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Section
                        </label>
                        <select
                          className="h-9 w-full rounded-md border bg-white px-2 text-xs font-semibold"
                          value={periodSection}
                          onChange={(e) => setPeriodSection(e.target.value)}
                        >
                          {sectionOptions.map((sec) => (
                            <option key={sec} value={sec}>
                              Section {sec}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Period Slot
                        </label>
                        <select
                          className="h-9 w-full rounded-md border bg-white px-2 text-xs font-medium"
                          value={periodNo}
                          onChange={(e) => {
                            const p = e.target.value;
                            setPeriodNo(p);
                            const found = PERIOD_PRESETS.find(
                              (item) => String(item.periodNo) === p,
                            );
                            if (found) {
                              setStartTime(found.start);
                              setEndTime(found.end);
                            }
                          }}
                        >
                          {PERIOD_PRESETS.map((p) => (
                            <option key={p.periodNo} value={p.periodNo}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Start Time
                        </label>
                        <Input
                          type="time"
                          className="h-9 bg-white"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          End Time
                        </label>
                        <Input
                          type="time"
                          className="h-9 bg-white"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">
                          Days of Week
                        </span>
                        <button
                          type="button"
                          className="text-xs text-indigo-700 font-semibold hover:underline"
                          onClick={() => setSelectedDays([...ALL_DAYS])}
                        >
                          Select All Days (Mon–Sat)
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_DAYS.map((day) => {
                          const checked = selectedDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() =>
                                setSelectedDays((prev) =>
                                  prev.includes(day)
                                    ? prev.filter((d) => d !== day)
                                    : [...prev, day],
                                )
                              }
                              className={`rounded border px-2.5 py-1 text-xs font-medium ${
                                checked
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "bg-white text-slate-600"
                              }`}
                            >
                              {checked ? "✓ " : ""}
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                disabled={bulkAssignMutation.isPending || selectedClasses.length === 0}
                onClick={() => bulkAssignMutation.mutate()}
              >
                {bulkAssignMutation.isPending
                  ? "Checking Clashes & Saving..."
                  : includeSchedule && selectedSubjectId
                    ? `Save Authorization & Assign Period ${periodNo} to Class ${periodClass}-${periodSection}`
                    : `Save Class Authorization (${selectedClasses.length} Class${
                        selectedClasses.length > 1 ? "es" : ""
                      })`}
              </Button>

              {/* Current Assignments & Scheduled Periods for this Teacher */}
              <div className="rounded-lg border p-3 space-y-3 bg-white">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Current Assigned Classes, Subjects & Periods
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(assignments.data?.classes ?? [])
                    .filter((ca) => ca.teacherUserId === assignTargetUser?.userId)
                    .map((ca) => (
                      <span
                        key={ca.id}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
                      >
                        Class {ca.className}-
                        {ca.section === "ALL" ? "All Sections" : ca.section}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeClassMutation.mutate(ca.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  {(assignments.data?.subjects ?? [])
                    .filter((sa) => sa.teacherUserId === assignTargetUser?.userId)
                    .map((sa) => (
                      <span
                        key={sa.id}
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
                      >
                        {subjectMap.get(sa.subjectId)?.name ?? `Subject #${sa.subjectId}`}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeSubjectMutation.mutate(sa.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto pt-1 border-t">
                  {(timetable.data ?? [])
                    .filter((t) => t.teacherUserId === assignTargetUser?.userId)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50"
                      >
                        <span>
                          <b>{t.dayOfWeek}</b> · Period {t.periodNo} ({t.startTime}–{t.endTime}) ·{" "}
                          <b>
                            Class {t.className}-{t.section}
                          </b>{" "}
                          · {subjectMap.get(t.subjectId)?.name ?? `Subject #${t.subjectId}`}
                        </span>
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removePeriodMutation.mutate(t.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
