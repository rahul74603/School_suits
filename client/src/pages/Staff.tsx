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
import { UserPlus, Search, KeyRound, BookOpen, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStaffSchema, type Staff as StaffType } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

export default function Staff() {
  const { data: user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "principal";
  const qc = useQueryClient();
  const { data: staff, isLoading, isError, error, refetch } = useStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { toast } = useToast();

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

  // Standalone Assign Class & Subject Dialog for a Teacher
  const [assignTargetUser, setAssignTargetUser] = useState<{
    userId: number;
    staffName: string;
  } | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassName, setSelectedClassName] = useState("10");
  const [selectedSectionName, setSelectedSectionName] = useState("A");

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

  const subjects = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { credentials: "include" });
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

  const userById = new Map((schoolUsers.data ?? []).map((u) => [u.id, u]));
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]));
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

  const assignSubjectMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/teacher-subject-assignments", {
        teacherUserId: assignTargetUser?.userId,
        subjectId: Number(selectedSubjectId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      toast({ title: "Subject assigned to teacher" });
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Assignment failed",
        description: err.message,
      }),
  });

  const removeSubjectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-subject-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

  const assignClassMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/teacher-class-assignments", {
        teacherUserId: assignTargetUser?.userId,
        className: selectedClassName,
        section: selectedSectionName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      toast({ title: "Class & section assigned to teacher" });
    },
    onError: (err: Error) =>
      toast({
        variant: "destructive",
        title: "Class assignment failed",
        description: err.message,
      }),
  });

  const removeClassMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-class-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

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
                  : "You can click 'Create Login' on their row.",
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Staff & Teachers Directory
            </h1>
            <p className="text-slate-500 mt-1">
              Add teachers & staff, create their login ID/email & role, and assign classes & subjects in one place
            </p>
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
                          <Input placeholder="e.g., Rajesh Sharma" {...field} />
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
                              onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}
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
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Login ID / Email & Role</TableHead>
                <TableHead>Assigned Classes & Subjects</TableHead>
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

                  return (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
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
                                .slice(0, 12);
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
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {teacherClasses.map((ca) => (
                                <span
                                  key={ca.id}
                                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                                >
                                  Class {ca.className}-{ca.section}
                                </span>
                              ))}
                              {teacherSubjects.map((sa) => (
                                <span
                                  key={sa.id}
                                  className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                                >
                                  {subjectById.get(sa.subjectId)?.name ?? `Subj #${sa.subjectId}`}
                                </span>
                              ))}
                            </div>
                            {isManager && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-indigo-700"
                                onClick={() =>
                                  setAssignTargetUser({
                                    userId: linkedUser.id,
                                    staffName: s.name,
                                  })
                                }
                              >
                                <BookOpen className="w-3 h-3 mr-1" />
                                Assign Class / Subject
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {linkedUser ? "—" : "Create Teacher Login first"}
                          </span>
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
                  placeholder="e.g., sharma@school.com or teacher.sharma"
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

        {/* Assign Class & Subject Modal for Teacher */}
        <Dialog
          open={!!assignTargetUser}
          onOpenChange={(openState) => !openState && setAssignTargetUser(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Assign Classes & Subjects — {assignTargetUser?.staffName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-lg border p-3 space-y-3">
                <div className="text-sm font-semibold">1. Assign Class & Section</div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={selectedClassName}
                    onChange={(e) => setSelectedClassName(e.target.value)}
                  >
                    {[
                      "Nursery",
                      "LKG",
                      "UKG",
                      "1",
                      "2",
                      "3",
                      "4",
                      "5",
                      "6",
                      "7",
                      "8",
                      "9",
                      "10",
                      "11",
                      "12",
                    ].map((c) => (
                      <option key={c} value={c}>
                        Class {c}
                      </option>
                    ))}
                  </select>
                  <Input
                    className="h-9"
                    placeholder="Section (A, B...)"
                    value={selectedSectionName}
                    onChange={(e) => setSelectedSectionName(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => assignClassMutation.mutate()}
                    disabled={assignClassMutation.isPending || !selectedSectionName.trim()}
                  >
                    Assign Class
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(assignments.data?.classes ?? [])
                    .filter((ca) => ca.teacherUserId === assignTargetUser?.userId)
                    .map((ca) => (
                      <span
                        key={ca.id}
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
                      >
                        Class {ca.className}-{ca.section}
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => removeClassMutation.mutate(ca.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="text-sm font-semibold">2. Assign Subject</div>
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject...</option>
                    {(subjects.data ?? []).map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {subj.name} {subj.code ? `(${subj.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => assignSubjectMutation.mutate()}
                    disabled={assignSubjectMutation.isPending || !selectedSubjectId}
                  >
                    Assign Subject
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(assignments.data?.subjects ?? [])
                    .filter((sa) => sa.teacherUserId === assignTargetUser?.userId)
                    .map((sa) => (
                      <span
                        key={sa.id}
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"
                      >
                        {subjectById.get(sa.subjectId)?.name ?? `Subject #${sa.subjectId}`}
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
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
