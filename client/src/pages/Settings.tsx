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
  const academicStreams = useQuery<any[]>({
    queryKey: ["/api/academic-streams"],
    queryFn: () => json("/api/academic-streams"),
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
  const [filterSectionClassId, setFilterSectionClassId] = useState("all");
  const [sectionName, setSectionName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectStream, setSubjectStream] = useState("All");
  const [subjectType, setSubjectType] = useState("core");

  // Stream & 11th-12th Electives States
  const [streamName, setStreamName] = useState("");
  const [streamCode, setStreamCode] = useState("");
  const [streamCompulsory, setStreamCompulsory] = useState("Hindi, English");
  const [streamCore, setStreamCore] = useState("");
  const [streamElectives, setStreamElectives] = useState("");
  const [streamMaxElectives, setStreamMaxElectives] = useState("1");

  // User Creation & Linking States
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("teacher");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [autoLinkStaffId, setAutoLinkStaffId] = useState("");
  const [autoLinkStudentId, setAutoLinkStudentId] = useState("");
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

  const deleteClass = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/management/classes/${id}?sessionId=${activeSession?.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/management/classes"] });
      qc.invalidateQueries({ queryKey: ["/api/management/sections"] });
      setMessage("Class removed.");
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

  const deleteSection = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/management/sections/${id}?sessionId=${activeSession?.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/management/sections"] });
      setMessage("Section deleted.");
    },
  });

  const createSubject = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/subjects", {
        name: subjectName,
        code: subjectCode || undefined,
        stream: subjectStream,
        subjectType,
        applicableClasses: subjectStream === "All" ? "All" : "11,12",
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

  const applyBoardPreset = useMutation({
    mutationFn: (board: "MPBSE" | "CBSE" | "STATE" | "ICSE") =>
      apiRequest("POST", "/api/academic-streams/preset", { board }),
    onSuccess: (_, board) => {
      qc.invalidateQueries({ queryKey: ["/api/academic-streams"] });
      qc.invalidateQueries({ queryKey: ["/api/subjects"] });
      qc.invalidateQueries({ queryKey: [`/api/schools/${user?.schoolId}`] });
      setMessage(`${board} Class 11–12 streams & elective subjects configured automatically!`);
    },
  });

  const createStream = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/academic-streams", {
        name: streamName,
        code: streamCode.toUpperCase().replace(/\s+/g, "_"),
        compulsorySubjects: streamCompulsory,
        coreSubjects: streamCore,
        electiveOptions: streamElectives,
        maxElectives: Number(streamMaxElectives) || 1,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academic-streams"] });
      setStreamName("");
      setStreamCode("");
      setStreamCore("");
      setStreamElectives("");
      setMessage("Custom 11th–12th stream saved.");
    },
  });

  const deleteStream = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/academic-streams/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academic-streams"] });
      setMessage("Stream deleted.");
    },
  });

  const createUserAccount = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/school-users", {
        username: newUsername.trim(),
        name: newFullName.trim(),
        role: newRole,
        password: newUserPassword,
        staffId: autoLinkStaffId ? Number(autoLinkStaffId) : null,
        studentId: autoLinkStudentId ? Number(autoLinkStudentId) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/school-users"] });
      qc.invalidateQueries({ queryKey: ["/api/payroll/staff-links"] });
      qc.invalidateQueries({ queryKey: ["/api/student-user-links"] });
      setNewUsername("");
      setNewFullName("");
      setNewUserPassword("");
      setAutoLinkStaffId("");
      setAutoLinkStudentId("");
      setMessage("User login account created and linked successfully!");
    },
    onError: (err) =>
      setMessage(err instanceof Error ? `Error: ${err.message}` : "Unable to create user account."),
  });

  const resetUserPassword = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      apiRequest("POST", `/api/school-users/${id}/reset-password`, { newPassword }),
    onSuccess: () => setMessage("User password reset successfully."),
    onError: (err) =>
      setMessage(err instanceof Error ? `Error: ${err.message}` : "Password reset failed."),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/student-user-links"] });
      setMessage("Student linked to user login account.");
    },
    onError: (err) =>
      setMessage(err instanceof Error ? `Error: ${err.message}` : "Failed to link student."),
  });

  const linkStaffUser = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/payroll/staff-links", {
        staffId: Number(linkStaffId),
        userId: Number(linkStaffUserId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll/staff-links"] });
      setMessage("Staff member linked to user login account.");
    },
    onError: (err) =>
      setMessage(err instanceof Error ? `Error: ${err.message}` : "Failed to link staff."),
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
    onError: (err) =>
      setMessage(err instanceof Error ? `Error: ${err.message}` : "Failed to assign subject."),
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

  const bulkCreateStudentLogins = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/school-users/bulk-student-accounts", {
        defaultPassword: "Student@123",
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["/api/school-users"] });
      setMessage(
        `Bulk Student Portal Setup Complete! Created & linked ${res?.createdCount ?? 0} new student/parent login accounts (${res?.skippedCount ?? 0} already had accounts). Default Password: Student's Contact No (or Student@123).`,
      );
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : "Bulk student account generation failed"),
  });

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

  const classOrderWeight = (name: string) => {
    const clean = name.trim().toLowerCase();
    if (clean === "nursery") return -3;
    if (clean === "lkg" || clean === "kg1") return -2;
    if (clean === "ukg" || clean === "kg2") return -1;
    const num = Number(clean);
    if (!Number.isNaN(num)) return num;
    return 100;
  };
  const sortedClasses = [...(classes.data ?? [])].sort((a, b) => {
    const wa = classOrderWeight(a.name);
    const wb = classOrderWeight(b.name);
    if (wa !== wb) return wa - wb;
    return a.name.localeCompare(b.name);
  });
  const filteredSections = (sections.data ?? []).filter((sec) =>
    filterSectionClassId === "all" ? true : String(sec.classId) === filterSectionClassId,
  );

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
                  <CardTitle>Academic Sessions (शैक्षणिक सत्र)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. Session Name (सत्र का नाम) *
                      </label>
                      <Input
                        placeholder="e.g., 2026-27"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Session Start Date (प्रारंभ तिथि)
                      </label>
                      <Input
                        type="date"
                        value={sessionStart}
                        onChange={(e) => setSessionStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. Session End Date (समाप्ति तिथि)
                      </label>
                      <Input
                        type="date"
                        value={sessionEnd}
                        onChange={(e) => setSessionEnd(e.target.value)}
                      />
                    </div>
                    <Button
                      className="h-10"
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
                      {sortedClasses.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-slate-50 px-3 py-1.5 text-sm font-medium"
                        >
                          <span>Class {c.name}</span>
                          <button
                            type="button"
                            title={`Delete Class ${c.name}`}
                            className="ml-1 text-slate-400 hover:text-red-600"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete Class ${c.name} and its sections from this session?`,
                                )
                              ) {
                                deleteClass.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>Sections (A, B, C...)</CardTitle>
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={filterSectionClassId}
                        onChange={(e) => setFilterSectionClassId(e.target.value)}
                      >
                        <option value="all">Filter: All Classes</option>
                        {sortedClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            Class {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <select
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {sortedClasses.map((c) => (
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
                    <p className="text-xs text-slate-500">
                      Tip: Sections are classroom divisions (A, B, C). For Class 11–12 subject streams (PCM, PCB, Commerce, Arts), use the Streams section below. Click the trash icon to delete any unwanted section.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {filteredSections.map((sec) => (
                        <span
                          key={sec.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-slate-50 px-3 py-1.5 text-xs font-medium"
                        >
                          <span>
                            Class {classById.get(sec.classId)?.name ?? sec.classId} - Section{" "}
                            {sec.name}
                          </span>
                          <button
                            type="button"
                            title="Delete section"
                            className="ml-1 text-slate-400 hover:text-red-600"
                            onClick={() => deleteSection.mutate(sec.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-indigo-200 bg-indigo-50/30">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <CardTitle>
                        Class 11th & 12th Streams & Elective Subjects (MP Board / CBSE / State Boards)
                      </CardTitle>
                      <p className="text-xs text-slate-600 mt-1">
                        Up to Class 10 all students follow common class subjects. After Class 10 (in 11th & 12th), students elect a Stream (PCM, PCB, Commerce, Arts/Humanities, Agriculture) and optional subjects as per board rules.Current Board:{" "}
                        <b className="text-indigo-700">
                          {school.data?.boardAffiliation || "MP Board (MPBSE)"}
                        </b>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => applyBoardPreset.mutate("MPBSE")}
                        disabled={applyBoardPreset.isPending}
                      >
                        1-Click Setup: MP Board (MPBSE)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBoardPreset.mutate("CBSE")}
                        disabled={applyBoardPreset.isPending}
                      >
                        Setup CBSE (10+2)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBoardPreset.mutate("STATE")}
                        disabled={applyBoardPreset.isPending}
                      >
                        Setup State Board (UP/RJ/BR/CG)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBoardPreset.mutate("ICSE")}
                        disabled={applyBoardPreset.isPending}
                      >
                        Setup ICSE / ISC
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-white p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Add / Customize Stream Combination (Class 11–12)
                    </div>
                    <div className="grid gap-3 md:grid-cols-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          1. Stream Name (स्ट्रीम का नाम) *
                        </label>
                        <Input
                          placeholder="e.g., Science - PCM"
                          value={streamName}
                          onChange={(e) => setStreamName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          2. Stream Code (शॉर्ट कोड) *
                        </label>
                        <Input
                          placeholder="e.g., PCM, PCB, COMMERCE, ARTS"
                          value={streamCode}
                          onChange={(e) => setStreamCode(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          3. Compulsory Languages (अनिवार्य भाषा विषय)
                        </label>
                        <Input
                          placeholder="e.g., Hindi, English"
                          value={streamCompulsory}
                          onChange={(e) => setStreamCompulsory(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          4. Core Stream Subjects (मुख्य विषय — कॉमा से अलग) *
                        </label>
                        <Input
                          placeholder="e.g., Physics, Chemistry, Mathematics"
                          value={streamCore}
                          onChange={(e) => setStreamCore(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          5. Optional / Elective Subjects (ऐच्छिक विषय)
                        </label>
                        <Input
                          placeholder="e.g., Computer Science, IP, PE"
                          value={streamElectives}
                          onChange={(e) => setStreamElectives(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            6. Max Electives Allowed (कितने ऐच्छिक विषय चुन सकते हैं)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="5"
                            placeholder="1"
                            value={streamMaxElectives}
                            onChange={(e) => setStreamMaxElectives(e.target.value)}
                          />
                        </div>
                        <Button
                          className="h-10"
                          onClick={() => createStream.mutate()}
                          disabled={
                            createStream.isPending || !streamName.trim() || !streamCode.trim()
                          }
                        >
                          Save Stream
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!academicStreams.data?.length ? (
                    <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-slate-600">
                      No Class 11–12 streams configured yet. Click{" "}
                      <b>&ldquo;1-Click Setup: MP Board (MPBSE)&rdquo;</b> (or your state/CBSE board) above to automatically set up PCM, PCB, Commerce, Arts, and Agriculture streams and subjects!
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(academicStreams.data ?? []).map((st: any) => (
                        <div
                          key={st.id}
                          className="rounded-lg border bg-white p-4 shadow-sm space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 mr-2">
                                {st.code}
                              </span>
                              <span className="font-semibold text-slate-900">{st.name}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 h-7 px-2"
                              onClick={() => deleteStream.mutate(st.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="text-xs space-y-1 text-slate-600">
                            <div>
                              <b>Compulsory Languages:</b> {st.compulsorySubjects || "—"}
                            </div>
                            <div>
                              <b>Core Subjects:</b> {st.coreSubjects || "—"}
                            </div>
                            <div>
                              <b>Elective Choices (Pick up to {st.maxElectives}):</b>{" "}
                              {st.electiveOptions || "None"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subjects Master (विषय सूची)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-5 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. Subject Name (विषय का नाम) *
                      </label>
                      <Input
                        placeholder="e.g., Mathematics"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Subject Code (विषय कोड - वैकल्पिक)
                      </label>
                      <Input
                        placeholder="e.g., MATH-101"
                        value={subjectCode}
                        onChange={(e) => setSubjectCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. Target Class / Stream (किस क्लास/स्ट्रीम के लिए)
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={subjectStream}
                        onChange={(e) => setSubjectStream(e.target.value)}
                      >
                        <option value="All">All Classes (1st–10th Common)</option>
                        <option value="PCM">11th–12th Science (PCM)</option>
                        <option value="PCB">11th–12th Science (PCB)</option>
                        <option value="COMMERCE">11th–12th Commerce</option>
                        <option value="ARTS">11th–12th Arts / Humanities</option>
                        <option value="AGRICULTURE">11th–12th Agriculture</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        4. Subject Type (विषय का प्रकार)
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={subjectType}
                        onChange={(e) => setSubjectType(e.target.value)}
                      >
                        <option value="core">Core / Main Subject</option>
                        <option value="compulsory_language">Compulsory Language</option>
                        <option value="elective">Optional / Elective</option>
                        <option value="vocational">Vocational / Additional</option>
                      </select>
                    </div>
                    <Button
                      className="h-10"
                      onClick={() => createSubject.mutate()}
                      disabled={createSubject.isPending || !subjectName.trim()}
                    >
                      Add Subject
                    </Button>
                  </div>
                  <div className="divide-y rounded-lg border bg-white max-h-96 overflow-y-auto">
                    {(subjects.data ?? []).map((subj) => (
                      <div key={subj.id} className="flex items-center justify-between p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{subj.name}</span>
                          {subj.code && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {subj.code}
                            </span>
                          )}
                          {subj.stream && subj.stream !== "All" && (
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Stream: {subj.stream}
                            </span>
                          )}
                          {subj.subjectType && (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 capitalize">
                              {String(subj.subjectType).replace("_", " ")}
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
              <Card className="border-indigo-200 bg-indigo-50/20">
                <CardHeader>
                  <CardTitle>
                    Create Login Account (Teacher / Accountant / Principal / Staff / Student)
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-1">
                    You can use either an <b>Email ID</b> (e.g., <code>sharma@school.com</code>) or a{" "}
                    <b>Username</b> (e.g., <code>teacher.sharma</code>) as the Login ID. Optionally select an existing Staff or Student below to auto-fill and link in 1 click!
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm"
                      value={autoLinkStaffId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        setAutoLinkStaffId(sid);
                        setAutoLinkStudentId("");
                        const st = (staffList.data ?? []).find((x) => String(x.id) === sid);
                        if (st) {
                          setNewFullName(st.name);
                          setNewRole(
                            st.designation === "Teacher"
                              ? "teacher"
                              : st.designation === "Principal"
                                ? "principal"
                                : st.designation === "Accountant"
                                  ? "accountant"
                                  : "staff",
                          );
                          const slug = st.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")
                            .slice(0, 12);
                          if (slug && !newUsername) setNewUsername(`${slug}@school.com`);
                        }
                      }}
                    >
                      <option value="">
                        Optional: Auto-fill & Link from Staff Directory...
                      </option>
                      {(staffList.data ?? []).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.designation})
                        </option>
                      ))}
                    </select>

                    <select
                      className="h-10 rounded-md border bg-white px-3 text-sm"
                      value={autoLinkStudentId}
                      onChange={(e) => {
                        const stId = e.target.value;
                        setAutoLinkStudentId(stId);
                        setAutoLinkStaffId("");
                        const st = (students.data ?? []).find((x) => String(x.id) === stId);
                        if (st) {
                          setNewFullName(st.name);
                          setNewRole("student");
                          const slug = st.name
                            .toLowerCase()
                            .replace(/[^a-z0-9]/g, "")
                            .slice(0, 10);
                          if (slug && !newUsername) setNewUsername(`${slug}@student.com`);
                        }
                      }}
                    >
                      <option value="">
                        Optional: Auto-fill & Link from Students Directory...
                      </option>
                      {(students.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 md:grid-cols-5 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. Full Name (पूरा नाम) *
                      </label>
                      <Input
                        className="bg-white"
                        placeholder="e.g., Rajesh Sharma"
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. Login ID or Email (लॉगिन आईडी) *
                      </label>
                      <Input
                        className="bg-white"
                        placeholder="e.g., sharma@school.com"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. Account Role (भूमिका) *
                      </label>
                      <select
                        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
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
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        4. Password (कम से कम 6 अक्षर) *
                      </label>
                      <Input
                        type="password"
                        className="bg-white"
                        placeholder="Min 6 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      className="h-10"
                      onClick={() => createUserAccount.mutate()}
                      disabled={
                        createUserAccount.isPending ||
                        !newUsername.trim() ||
                        !newFullName.trim() ||
                        newUserPassword.length < 6
                      }
                    >
                      {createUserAccount.isPending ? "Creating..." : "Create Login Account"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-200 bg-emerald-50/40">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-emerald-950">
                        Student / Parent Self-Service Portal Accounts (Read-Only View for Parents & Students)
                      </CardTitle>
                      <p className="text-xs text-slate-600 mt-1">
                        <b>Note:</b> School operations (Fees, Results, Attendance, ID Cards, TC) work directly from <b>Student Records</b> without needing login accounts. Student Login Accounts are <b>optional Read-Only Portal accounts</b> so Parents/Students can view their own Report Card, Fee Receipts, Attendance, Homework, Timetable & Notices on their phone.
                      </p>
                    </div>
                    <Button
                      onClick={() => bulkCreateStudentLogins.mutate()}
                      disabled={bulkCreateStudentLogins.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {bulkCreateStudentLogins.isPending
                        ? "Generating Accounts..."
                        : "1-Click Auto-Create All Student Portal Logins"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-emerald-900">
                  Clicking <b>&ldquo;1-Click Auto-Create All Student Portal Logins&rdquo;</b> automatically creates &amp; links a Read-Only Portal Login for every admitted student (<b>Login ID = Admission No</b> in lowercase, <b>Password = Student@123</b>) — no need to create or link 1,000 students manually!
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
                          <th className="p-3 text-left">Login ID / Email</th>
                          <th className="p-3 text-left">Role</th>
                          <th className="p-3 text-left">Status</th>
                          {manager && <th className="p-3 text-left">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(schoolUsers.data ?? []).map((u) => (
                          <tr key={u.id} className="border-t">
                            <td className="p-3 font-medium">{u.name}</td>
                            <td className="p-3 font-mono text-xs">{u.username}</td>
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
                            {manager && (
                              <td className="p-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => unlockAccount.mutate(u.id)}
                                >
                                  <Unlock className="h-3.5 w-3.5 mr-1" /> Unlock
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const pwd = window.prompt(
                                      `Enter new password for ${u.name} (${u.username}) [min 6 chars]:`,
                                    );
                                    if (pwd && pwd.trim().length >= 6) {
                                      resetUserPassword.mutate({
                                        id: u.id,
                                        newPassword: pwd.trim(),
                                      });
                                    }
                                  }}
                                >
                                  Reset Password
                                </Button>
                                {isAdmin && u.id !== user?.id && (
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
