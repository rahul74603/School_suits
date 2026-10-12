import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Trash2, Unlock } from "lucide-react";

const json = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
};

type TransportRoute = {
  id: number;
  schoolId: number;
  routeName: string;
  amount: number;
  isActive: boolean;
};

export default function Settings() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const manager = user?.role === "admin" || user?.role === "principal";
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState(manager ? "school" : "security");
  const [message, setMessage] = useState("");

  // Queries
  const school = useQuery<any>({
    queryKey: [`/api/schools/${user?.schoolId}`],
    queryFn: async () => (await fetch(`/api/schools/${user?.schoolId}`, { credentials: "include" })).json(),
    enabled: !!user?.schoolId,
  });
  const sessions = useQuery<any[]>({
    queryKey: ["/api/academic-sessions"],
    queryFn: async () => {
      const data = await json("/api/academic-sessions");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });
  const activeSession = (sessions.data ?? []).find((s) => s.isActive);

  const classes = useQuery<any[]>({
    queryKey: ["/api/management/classes", activeSession?.id],
    queryFn: () => json(`/api/management/classes?sessionId=${activeSession?.id}`),
    enabled: !!activeSession?.id && manager,
  });
  const sections = useQuery<any[]>({
    queryKey: ["/api/management/sections", activeSession?.id],
    queryFn: () => json(`/api/management/sections?sessionId=${activeSession?.id}`),
    enabled: !!activeSession?.id && manager,
  });
  const subjects = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    queryFn: () => json("/api/subjects"),
    enabled: !!user && manager,
  });
  const schoolUsers = useQuery<any[]>({
    queryKey: ["/api/school-users"],
    queryFn: () => json("/api/school-users"),
    enabled: !!user && manager,
  });
  const assignments = useQuery<{ subjects: any[]; classes: any[] }>({
    queryKey: ["/api/teacher-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/teacher-assignments", { credentials: "include" });
      return res.ok ? res.json() : { subjects: [], classes: [] };
    },
    enabled: !!user && manager,
  });
  const students = useQuery<any[]>({
    queryKey: ["/api/students"],
    queryFn: () => json("/api/students"),
    enabled: !!user && manager,
  });
  const staffList = useQuery<any[]>({
    queryKey: ["/api/staff"],
    queryFn: () => json("/api/staff"),
    enabled: !!user && manager,
  });
  const auditEvents = useQuery<any[]>({
    queryKey: ["/api/audit-events"],
    queryFn: () => json("/api/audit-events?limit=100"),
    enabled: !!user && manager,
  });

  // Controlled School Profile State
  const [schoolName, setSchoolName] = useState("");
  const [schoolContact, setSchoolContact] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolLogo, setSchoolLogo] = useState("");

  useEffect(() => {
    if (school.data) {
      setSchoolName(school.data.name ?? "");
      setSchoolContact(school.data.contact ?? "");
      setSchoolAddress(school.data.address ?? "");
      setSchoolLogo(school.data.logo ?? "");
    }
  }, [school.data]);

  // Session & Academic States
  const [newSessionName, setNewSessionName] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [className, setClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  // User Creation & Linking States
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [linkStudentId, setLinkStudentId] = useState("");
  const [linkStudentUserId, setLinkStudentUserId] = useState("");
  const [linkStaffId, setLinkStaffId] = useState("");
  const [linkStaffUserId, setLinkStaffUserId] = useState("");

  // Teacher Assignment States
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");
  const [assignClassTeacherId, setAssignClassTeacherId] = useState("");
  const [assignClassName, setAssignClassName] = useState("");
  const [assignSectionName, setAssignSectionName] = useState("");

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mutations
  const saveSchool = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/schools/${user?.schoolId}`, {
        name: schoolName,
        contact: schoolContact,
        address: schoolAddress,
        logo: schoolLogo || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/schools/${user?.schoolId}`] });
      setMessage("School profile updated.");
    },
  });

  const createSession = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/academic-sessions", {
        name: newSessionName,
        startDate: sessionStart || null,
        endDate: sessionEnd || null,
        isActive: false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] });
      setNewSessionName("");
      setMessage("Academic session created.");
    },
  });

  const activateSession = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/academic-sessions/${id}/activate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/academic-sessions/active"] });
      setMessage("Active academic session switched.");
    },
  });

  const createClass = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/management/classes", {
        sessionId: activeSession?.id,
        name: className,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/management/classes"] });
      setClassName("");
      setMessage("Class added to active session.");
    },
  });

  const createSection = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/management/sections", {
        sessionId: activeSession?.id,
        classId: Number(selectedClassId),
        name: sectionName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/management/sections"] });
      setSectionName("");
      setMessage("Section added.");
    },
  });

  const createSubject = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/subjects", {
        name: subjectName,
        code: subjectCode || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      setSubjectName("");
      setSubjectCode("");
      setMessage("Subject created.");
    },
  });

  const deleteSubject = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/subjects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/subjects"] }),
  });

  const createUserAccount = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/school-users", {
        username: newUsername,
        name: newFullName,
        role: newRole,
        password: newUserPassword,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/school-users"] });
      setNewUsername("");
      setNewFullName("");
      setNewUserPassword("");
      setMessage("User login account created.");
    },
  });

  const unlockAccount = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/school-users/${id}/unlock`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/school-users"] });
      setMessage("Account unlocked.");
    },
  });

  const toggleUserActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/school-users/${id}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/school-users"] }),
  });

  const linkStudentUser = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/student-user-links", {
        studentId: Number(linkStudentId),
        userId: Number(linkStudentUserId),
      }),
    onSuccess: () => setMessage("Student linked to user login account."),
  });

  const linkStaffUser = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/payroll/staff-links", {
        staffId: Number(linkStaffId),
        userId: Number(linkStaffUserId),
      }),
    onSuccess: () => setMessage("Staff member linked to user login account."),
  });

  const assignSubjectToTeacher = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/teacher-subject-assignments", {
        teacherUserId: Number(assignTeacherId),
        subjectId: Number(assignSubjectId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      setMessage("Subject assigned to teacher.");
    },
  });

  const removeSubjectAssignment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-subject-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

  const assignClassToTeacher = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/teacher-class-assignments", {
        teacherUserId: Number(assignClassTeacherId),
        className: assignClassName,
        section: assignSectionName,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] });
      setAssignClassName("");
      setAssignSectionName("");
      setMessage("Class/section assigned to teacher.");
    },
  });

  const removeClassAssignment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teacher-class-assignments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/teacher-assignments"] }),
  });

  const transportRoutes = useQuery<TransportRoute[]>({
    queryKey: ["/api/transport-routes", manager],
    queryFn: async () => {
      const data = await json(manager ? "/api/transport-routes?includeInactive=true" : "/api/transport-routes");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });
  const [routeName, setRouteName] = useState("");
  const [routeAmount, setRouteAmount] = useState("");
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);

  const changePassword = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    onSuccess: () => {
      setMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Password change failed"),
  });

  const createRoute = useMutation({
    mutationFn: (data: { routeName: string; amount: number }) =>
      apiRequest("POST", "/api/transport-routes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setRouteName("");
      setRouteAmount("");
      setMessage("Bus route added successfully.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to add bus route."),
  });

  const updateRoute = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { routeName?: string; amount?: number } }) =>
      apiRequest("PATCH", `/api/transport-routes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setEditingRouteId(null);
      setRouteName("");
      setRouteAmount("");
      setMessage("Bus route updated successfully.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to update bus route."),
  });

  const deactivateRoute = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/transport-routes/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setMessage("Bus route deactivated. Existing student records are preserved.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to deactivate bus route."),
  });

  const submitRoute = () => {
    const trimmedName = routeName.trim();
    const amount = Number(routeAmount);
    if (!trimmedName || !Number.isInteger(amount) || amount <= 0) {
      setMessage("Enter a route name and a positive whole-number monthly charge.");
      return;
    }
    if (editingRouteId) {
      updateRoute.mutate({ id: editingRouteId, data: { routeName: trimmedName, amount } });
    } else {
      createRoute.mutate({ routeName: trimmedName, amount });
    }
  };

  const teacherUsers = (schoolUsers.data ?? []).filter((u) => u.role === "teacher");
  const studentUsers = (schoolUsers.data ?? []).filter((u) => u.role === "student");
  const staffRoleUsers = (schoolUsers.data ?? []).filter((u) =>
    ["teacher", "staff"].includes(u.role),
  );
  const userById = new Map((schoolUsers.data ?? []).map((u) => [u.id, u]));
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  const classById = new Map((classes.data ?? []).map((c) => [c.id, c]));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings & School Administration</h1>
          <p className="mt-1 text-slate-500">
            Configure school profile, academic sessions, classes, subjects, user logins, teacher assignments, bus routes, and security.
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
            {message}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            {manager && <TabsTrigger value="school">School & Sessions</TabsTrigger>}
            {manager && <TabsTrigger value="academics">Classes, Sections & Subjects</TabsTrigger>}
            {manager && <TabsTrigger value="users">Users & Account Links</TabsTrigger>}
            {manager && <TabsTrigger value="assignments">Teacher Assignments</TabsTrigger>}
            {manager && <TabsTrigger value="transport">Bus Routes & Charges</TabsTrigger>}
            <TabsTrigger value="security">Security & Audit Logs</TabsTrigger>
          </TabsList>

          {manager && (
            <TabsContent value="school" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>School Profile & Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">School Name</label>
                      <Input
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="School Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Contact Number</label>
                      <Input
                        value={schoolContact}
                        onChange={(e) => setSchoolContact(e.target.value)}
                        placeholder="Phone / Contact"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Address</label>
                      <Input
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        placeholder="Complete School Address"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">Logo URL (optional)</label>
                      <Input
                        value={schoolLogo}
                        onChange={(e) => setSchoolLogo(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <Button onClick={() => saveSchool.mutate()} disabled={saveSchool.isPending}>
                    {saveSchool.isPending ? "Saving..." : "Save School Profile"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Academic Sessions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input
                      placeholder="Session Name (e.g., 2026-27)"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={sessionStart}
                      onChange={(e) => setSessionStart(e.target.value)}
                    />
                    <Input
                      type="date"
                      value={sessionEnd}
                      onChange={(e) => setSessionEnd(e.target.value)}
                    />
                    <Button
                      onClick={() => createSession.mutate()}
                      disabled={createSession.isPending || !newSessionName.trim()}
                    >
                      Create Session
                    </Button>
                  </div>
                  <div className="divide-y rounded-lg border bg-white">
                    {(sessions.data ?? []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <span className="font-semibold text-slate-900">{s.name}</span>
                          {s.startDate && s.endDate && (
                            <span className="ml-2 text-xs text-slate-500">
                              ({s.startDate} to {s.endDate})
                            </span>
                          )}
                          {s.isActive && (
                            <span className="ml-2 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                              Active Session
                            </span>
                          )}
                        </div>
                        {!s.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateSession.mutate(s.id)}
                          >
                            Set Active
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {manager && (
            <TabsContent value="academics" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Classes ({activeSession?.name || "Active Session"})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Class Name (e.g., 1, 2, 10, Nursery)"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                      />
                      <Button
                        onClick={() => createClass.mutate()}
                        disabled={createClass.isPending || !className.trim() || !activeSession}
                      >
                        Add Class
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(classes.data ?? []).map((c) => (
                        <span
                          key={c.id}
                          className="rounded-lg border bg-slate-50 px-3 py-1.5 text-sm font-medium"
                        >
                          Class {c.name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sections</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {(classes.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            Class {c.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Section (e.g., A, B, C)"
                        value={sectionName}
                        onChange={(e) => setSectionName(e.target.value)}
                      />
                      <Button
                        onClick={() => createSection.mutate()}
                        disabled={
                          createSection.isPending || !selectedClassId || !sectionName.trim()
                        }
                      >
                        Add Section
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(sections.data ?? []).map((sec) => (
                        <span
                          key={sec.id}
                          className="rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium"
                        >
                          Class {classById.get(sec.classId)?.name ?? sec.classId} - Section{" "}
                          {sec.name}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Subjects Master</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      placeholder="Subject Name (e.g., Mathematics)"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                    />
                    <Input
                      placeholder="Subject Code (optional, e.g., MATH-101)"
                      value={subjectCode}
                      onChange={(e) => setSubjectCode(e.target.value)}
                    />
                    <Button
                      onClick={() => createSubject.mutate()}
                      disabled={createSubject.isPending || !subjectName.trim()}
                    >
                      Add Subject
                    </Button>
                  </div>
                  <div className="divide-y rounded-lg border bg-white">
                    {(subjects.data ?? []).map((subj) => (
                      <div key={subj.id} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <span className="font-semibold text-slate-900">{subj.name}</span>
                          {subj.code && (
                            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {subj.code}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => deleteSubject.mutate(subj.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {manager && (
            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create School User Account (Role-Based Login)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-5">
                  <Input
                    placeholder="Full Name"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                  />
                  <Input
                    placeholder="Username (e.g., teacher.sharma)"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    {isAdmin && <option value="admin">Admin</option>}
                    <option value="principal">Principal</option>
                    <option value="accountant">Accountant</option>
                    <option value="teacher">Teacher</option>
                    <option value="staff">Staff</option>
                    <option value="student">Student / Parent</option>
                  </select>
                  <Input
                    type="password"
                    placeholder="Initial Password (min 8 chars)"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                  <Button
                    onClick={() => createUserAccount.mutate()}
                    disabled={
                      createUserAccount.isPending ||
                      !newUsername.trim() ||
                      !newFullName.trim() ||
                      newUserPassword.length < 8
                    }
                  >
                    Create User
                  </Button>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Link Student Record to Student Login</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={linkStudentId}
                      onChange={(e) => setLinkStudentId(e.target.value)}
                    >
                      <option value="">Select Student Record...</option>
                      {(students.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={linkStudentUserId}
                      onChange={(e) => setLinkStudentUserId(e.target.value)}
                    >
                      <option value="">Select Student Login Account...</option>
                      {studentUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} (@{u.username})
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => linkStudentUser.mutate()}
                      disabled={linkStudentUser.isPending || !linkStudentId || !linkStudentUserId}
                    >
                      Link Student Account
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Link Staff Record to Teacher/Staff Login</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={linkStaffId}
                      onChange={(e) => setLinkStaffId(e.target.value)}
                    >
                      <option value="">Select Staff Member...</option>
                      {(staffList.data ?? []).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} — {st.designation}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={linkStaffUserId}
                      onChange={(e) => setLinkStaffUserId(e.target.value)}
                    >
                      <option value="">Select Teacher/Staff Login Account...</option>
                      {staffRoleUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} (@{u.username} · {u.role})
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={() => linkStaffUser.mutate()}
                      disabled={linkStaffUser.isPending || !linkStaffId || !linkStaffUserId}
                    >
                      Link Staff Account
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Registered School User Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-3 text-left">Name</th>
                          <th className="p-3 text-left">Username</th>
                          <th className="p-3 text-left">Role</th>
                          <th className="p-3 text-left">Status</th>
                          {isAdmin && <th className="p-3 text-left">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(schoolUsers.data ?? []).map((u) => (
                          <tr key={u.id} className="border-t">
                            <td className="p-3 font-medium">{u.name}</td>
                            <td className="p-3 font-mono text-xs">@{u.username}</td>
                            <td className="p-3 uppercase text-xs font-semibold">{u.role}</td>
                            <td className="p-3">
                              {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                  Locked
                                </span>
                              ) : u.isActive === false ? (
                                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                                  Deactivated
                                </span>
                              ) : (
                                <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                  Active
                                </span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="p-3 flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unlockAccount.mutate(u.id)}
                                >
                                  <Unlock className="h-3.5 w-3.5 mr-1" /> Unlock
                                </Button>
                                {u.id !== user?.id && (
                                  <Button
                                    size="sm"
                                    variant={u.isActive === false ? "default" : "destructive"}
                                    onClick={() =>
                                      toggleUserActive.mutate({
                                        id: u.id,
                                        isActive: u.isActive === false,
                                      })
                                    }
                                  >
                                    {u.isActive === false ? "Activate" : "Deactivate"}
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {manager && (
            <TabsContent value="assignments" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Assign Teacher to Class & Section</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={assignClassTeacherId}
                        onChange={(e) => setAssignClassTeacherId(e.target.value)}
                      >
                        <option value="">Select Teacher</option>
                        {teacherUsers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (@{t.username})
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="Class (e.g., 1)"
                        value={assignClassName}
                        onChange={(e) => setAssignClassName(e.target.value)}
                      />
                      <Input
                        placeholder="Section (e.g., A)"
                        value={assignSectionName}
                        onChange={(e) => setAssignSectionName(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => assignClassToTeacher.mutate()}
                      disabled={
                        assignClassToTeacher.isPending ||
                        !assignClassTeacherId ||
                        !assignClassName.trim() ||
                        !assignSectionName.trim()
                      }
                    >
                      Assign Class
                    </Button>
                    <div className="divide-y rounded-lg border bg-white">
                      {(assignments.data?.classes ?? []).map((ca) => (
                        <div key={ca.id} className="flex items-center justify-between p-3 text-sm">
                          <span>
                            <b>{userById.get(ca.teacherUserId)?.name || `Teacher #${ca.teacherUserId}`}</b>{" "}
                            → Class {ca.className}-{ca.section}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => removeClassAssignment.mutate(ca.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Assign Teacher to Subject</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={assignTeacherId}
                        onChange={(e) => setAssignTeacherId(e.target.value)}
                      >
                        <option value="">Select Teacher</option>
                        {teacherUsers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (@{t.username})
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={assignSubjectId}
                        onChange={(e) => setAssignSubjectId(e.target.value)}
                      >
                        <option value="">Select Subject</option>
                        {(subjects.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={() => assignSubjectToTeacher.mutate()}
                      disabled={
                        assignSubjectToTeacher.isPending || !assignTeacherId || !assignSubjectId
                      }
                    >
                      Assign Subject
                    </Button>
                    <div className="divide-y rounded-lg border bg-white">
                      {(assignments.data?.subjects ?? []).map((sa) => (
                        <div key={sa.id} className="flex items-center justify-between p-3 text-sm">
                          <span>
                            <b>{userById.get(sa.teacherUserId)?.name || `Teacher #${sa.teacherUserId}`}</b>{" "}
                            → {subjectById.get(sa.subjectId)?.name || `Subject #${sa.subjectId}`}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => removeSubjectAssignment.mutate(sa.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Change Your Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-500">
                  Minimum 12 characters with uppercase, lowercase, number, and symbol.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
                  Change Password
                </Button>
              </CardContent>
            </Card>

            {manager && (
              <Card>
                <CardHeader>
                  <CardTitle>Security Audit Trail (Recent 100 Events)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border bg-white max-h-96">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-2.5 text-left">Timestamp</th>
                          <th className="p-2.5 text-left">Actor</th>
                          <th className="p-2.5 text-left">Role</th>
                          <th className="p-2.5 text-left">Action</th>
                          <th className="p-2.5 text-left">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(auditEvents.data ?? []).map((ev) => (
                          <tr key={ev.id} className="border-t">
                            <td className="p-2.5 text-slate-500">
                              {new Date(ev.createdAt).toLocaleString()}
                            </td>
                            <td className="p-2.5">
                              {userById.get(ev.actorUserId)?.name || `User #${ev.actorUserId ?? "—"}`}
                            </td>
                            <td className="p-2.5 uppercase">{ev.actorRole || "—"}</td>
                            <td className="p-2.5 font-mono">{ev.action}</td>
                            <td className="p-2.5">
                              {ev.targetType ? `${ev.targetType} #${ev.targetId ?? ""}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {manager && (
            <TabsContent value="transport" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bus Routes & Monthly Charges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Create and manage school transport routes. Deactivating a route does not remove existing student history.
                  </p>
                  <div className="grid md:grid-cols-[1fr_200px_auto_auto] gap-2">
                    <Input
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      placeholder="Route name, e.g. City Route"
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={routeAmount}
                      onChange={(e) => setRouteAmount(e.target.value)}
                      placeholder="Monthly charge ₹"
                    />
                    <Button
                      onClick={submitRoute}
                      disabled={createRoute.isPending || updateRoute.isPending}
                    >
                      {editingRouteId ? "Save Route" : "Add Route"}
                    </Button>
                    {editingRouteId && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingRouteId(null);
                          setRouteName("");
                          setRouteAmount("");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2 pt-2">
                    {transportRoutes.isLoading ? (
                      <p className="text-sm text-slate-500">Loading bus routes...</p>
                    ) : transportRoutes.data?.length ? (
                      transportRoutes.data.map((route) => (
                        <div
                          key={route.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-3"
                        >
                          <div>
                            <div className="font-medium">{route.routeName}</div>
                            <div className="text-sm text-slate-500">
                              ₹{route.amount.toLocaleString()} / month ·{" "}
                              {route.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingRouteId(route.id);
                                setRouteName(route.routeName);
                                setRouteAmount(String(route.amount));
                              }}
                            >
                              Edit
                            </Button>
                            {route.isActive && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deactivateRoute.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Deactivate "${route.routeName}"? Existing student assignments are preserved.`,
                                    )
                                  ) {
                                    deactivateRoute.mutate(route.id);
                                  }
                                }}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No bus routes configured yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
