import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiDel, apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Bus,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  School,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

// 🚌 Transport (v3.3) — bus routes aur unpar chalne wale bacche.
// Server par routes aur student→route jod pehle se tha (Settings
// me sirf route banta tha, bacche jodne ki screen kahin nahi thi):
//   GET    /api/transport-routes            (principal/accountant/staff)
//   POST   /api/transport-routes            (principal/accountant)
//   PUT    /api/transport-routes/:id        (principal/accountant) — route edit
//   DELETE /api/transport-routes/:id        (sirf principal)
//   PUT    /api/students/:id/transport      (principal/staff) { transportId | null }
//   GET    /api/students                    (baccho ki transportId yahi se)
// Route record me gaadi number + driver naam/contact bhi hai
// (v3.3 server columns) — form (naya + edit dono) aur card par
// dikhte hain.

interface RouteRow {
  id: number;
  routeName: string;
  amount: number;
  vehicleNo: string;
  driverName: string;
  driverContact: string;
}

interface StudentRow {
  id: number;
  name: string;
  class: string;
  section: string | null;
  admissionNo: string | null;
  transportId: number | null;
}

export default function Transport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isPrincipal = user?.role === "principal";
  const canAddRoute =
    user?.role === "principal" || user?.role === "accountant";
  const canAssign = user?.role === "principal" || user?.role === "staff";

  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [routeForm, setRouteForm] = useState({
    routeName: "",
    amount: "",
    vehicleNo: "",
    driverName: "",
    driverContact: "",
  });
  const [addingRoute, setAddingRoute] = useState(false);

  const [editTarget, setEditTarget] = useState<RouteRow | null>(null);
  const [editForm, setEditForm] = useState({
    routeName: "",
    amount: "",
    vehicleNo: "",
    driverName: "",
    driverContact: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RouteRow | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [busyStudent, setBusyStudent] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const [routeData, studentData] = await Promise.all([
        apiGet<any[]>("/api/transport-routes"),
        apiGet<any[]>("/api/students"),
      ]);
      setRoutes(
        (routeData || []).map((r) => ({
          id: r.id,
          routeName: r.routeName ?? "",
          amount: r.amount ?? 0,
          vehicleNo: r.vehicleNo ?? "",
          driverName: r.driverName ?? "",
          driverContact: r.driverContact ?? "",
        })),
      );
      setStudents(
        (studentData || []).map((s) => ({
          id: s.id,
          name: s.name ?? "",
          class: s.class ?? "",
          section: s.section ?? null,
          admissionNo: s.admissionNo ?? null,
          transportId: s.transportId ?? null,
        })),
      );
    } catch (e: any) {
      toast({
        title: "Transport data load nahi hua",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [isSuperAdmin, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const studentsByRoute = useMemo(() => {
    const map = new Map<number, StudentRow[]>();
    for (const s of students) {
      if (s.transportId != null) {
        const list = map.get(s.transportId) || [];
        list.push(s);
        map.set(s.transportId, list);
      }
    }
    return map;
  }, [students]);

  const unassignedCount = useMemo(
    () => students.filter((s) => s.transportId == null).length,
    [students],
  );

  const addRoute = async () => {
    if (!routeForm.routeName.trim()) {
      toast({ title: "Route ka naam lazmi hai", variant: "destructive" });
      return;
    }
    setAddingRoute(true);
    try {
      await apiPost("/api/transport-routes", {
        routeName: routeForm.routeName.trim(),
        amount: parseInt(routeForm.amount) || 0,
        vehicleNo: routeForm.vehicleNo.trim() || null,
        driverName: routeForm.driverName.trim() || null,
        driverContact: routeForm.driverContact.trim() || null,
      });
      toast({ title: "✅ Route ban gaya" });
      setIsAddOpen(false);
      setRouteForm({
        routeName: "",
        amount: "",
        vehicleNo: "",
        driverName: "",
        driverContact: "",
      });
      await load();
    } catch (e: any) {
      toast({
        title: "Route nahi ban paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setAddingRoute(false);
  };

  const openEdit = (route: RouteRow) => {
    setEditTarget(route);
    setEditForm({
      routeName: route.routeName,
      amount: String(route.amount ?? ""),
      vehicleNo: route.vehicleNo,
      driverName: route.driverName,
      driverContact: route.driverContact,
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editForm.routeName.trim()) {
      toast({ title: "Route ka naam lazmi hai", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      await apiPut(`/api/transport-routes/${editTarget.id}`, {
        routeName: editForm.routeName.trim(),
        amount: parseInt(editForm.amount) || 0,
        vehicleNo: editForm.vehicleNo.trim() || null,
        driverName: editForm.driverName.trim() || null,
        driverContact: editForm.driverContact.trim() || null,
      });
      toast({ title: "✅ Route badal gaya" });
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast({
        title: "Route save nahi ho paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setSavingEdit(false);
  };

  const deleteRoute = async () => {
    if (!deleteTarget) return;
    try {
      await apiDel(`/api/transport-routes/${deleteTarget.id}`);
      toast({ title: "Route hata diya gaya" });
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast({
        title: "Route nahi hat paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
  };

  const setStudentRoute = async (
    student: StudentRow,
    transportId: number | null,
  ) => {
    setBusyStudent(student.id);
    try {
      await apiPut(`/api/students/${student.id}/transport`, { transportId });
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, transportId } : s)),
      );
      toast({
        title:
          transportId == null
            ? `${student.name} ko route se hata diya`
            : `✅ ${student.name} ko route mil gaya`,
      });
    } catch (e: any) {
      toast({
        title: "Route nahi badal paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setBusyStudent(null);
  };

  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there is no transport data here. Each
              school&apos;s Principal manages bus routes from their own
              login.
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
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800">
            <Bus className="h-8 w-8 text-orange-600" /> Transport — Bus
            Routes
          </h1>
          <p className="text-gray-500 mt-1">
            Kul {routes.length} route • {students.length - unassignedCount}{" "}
            bacche bus par • {unassignedCount} bina route ke
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {canAddRoute && (
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" /> Naya Route
            </Button>
          )}
        </div>
      </div>

      {loading && routes.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Load ho raha hai…
        </p>
      ) : routes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500 space-y-2">
            <Bus className="h-10 w-10 mx-auto text-gray-300" />
            <p>Abhi koi bus route nahi hai.</p>
            {canAddRoute && (
              <p className="text-sm">
                "Naya Route" dabakar pehla route banayein — fir baccho ko
                uspar jodein.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routes.map((route) => {
            const riders = studentsByRoute.get(route.id) || [];
            const expanded = expandedRoute === route.id;
            const candidates = students.filter(
              (s) =>
                s.transportId !== route.id &&
                (assignSearch.trim() === "" ||
                  s.name
                    .toLowerCase()
                    .includes(assignSearch.trim().toLowerCase()) ||
                  (s.admissionNo || "")
                    .toLowerCase()
                    .includes(assignSearch.trim().toLowerCase())),
            );
            return (
              <Card key={route.id} className="border-t-4 border-t-orange-500">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg break-words">
                        🚌 {route.routeName}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Mahina kiraya: ₹{route.amount.toLocaleString()} •{" "}
                        {riders.length} bacche
                      </p>
                      {(route.vehicleNo ||
                        route.driverName ||
                        route.driverContact) && (
                        <p className="text-sm text-gray-500 mt-0.5 break-words">
                          {route.vehicleNo && <>🚐 {route.vehicleNo}</>}
                          {route.driverName && (
                            <>
                              {route.vehicleNo ? " • " : ""}Driver:{" "}
                              {route.driverName}
                            </>
                          )}
                          {route.driverContact && (
                            <>
                              {route.vehicleNo || route.driverName
                                ? " • "
                                : ""}
                              <Phone className="inline h-3.5 w-3.5 -mt-0.5" />{" "}
                              {route.driverContact}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpandedRoute(expanded ? null : route.id)
                        }
                      >
                        <Users className="h-4 w-4 mr-1" />
                        {expanded ? "Band karein" : "Bacche dekhein"}
                      </Button>
                      {canAddRoute && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(route)}
                          aria-label="Route badlein"
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {isPrincipal && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(route)}
                          aria-label="Route hatao"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Is route ke bacche ({riders.length})
                      </p>
                      {riders.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Abhi koi baccha is route par nahi hai.
                        </p>
                      ) : (
                        riders.map((s) => (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2"
                          >
                            <div className="min-w-0">
                              <span className="font-medium text-sm break-words">
                                {s.name}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                Class {s.class}
                                {s.section ? `-${s.section}` : ""}
                                {s.admissionNo
                                  ? ` • Adm. ${s.admissionNo}`
                                  : ""}
                              </span>
                            </div>
                            {canAssign && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-700 hover:bg-red-50 shrink-0"
                                disabled={busyStudent === s.id}
                                onClick={() => void setStudentRoute(s, null)}
                              >
                                <UserMinus className="h-4 w-4 mr-1" /> Hatao
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {canAssign && (
                      <div className="space-y-2 border-t pt-3">
                        <Label className="text-sm font-medium">
                          Baccha jodein
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            className="pl-9"
                            placeholder="Naam ya Admission No. se khojein…"
                            value={assignSearch}
                            onChange={(e) => setAssignSearch(e.target.value)}
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {candidates.slice(0, 30).map((s) => (
                            <div
                              key={s.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                            >
                              <div className="min-w-0 text-sm">
                                <span className="break-words">{s.name}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  Class {s.class}
                                  {s.section ? `-${s.section}` : ""}
                                  {s.transportId != null
                                    ? " • dusre route par hai"
                                    : ""}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 min-h-[36px]"
                                disabled={busyStudent === s.id}
                                onClick={() =>
                                  void setStudentRoute(s, route.id)
                                }
                              >
                                <UserPlus className="h-4 w-4 mr-1" /> Jodo
                              </Button>
                            </div>
                          ))}
                          {candidates.length === 0 && (
                            <p className="text-sm text-gray-500 py-2">
                              Koi baccha nahi mila.
                            </p>
                          )}
                          {candidates.length > 30 && (
                            <p className="text-[11px] text-gray-400">
                              Aur {candidates.length - 30} bacche — khoj
                              likh kar kam karein.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Route ka naam, kiraya, gaadi ya driver badalna ho to card par
        pencil (✏️) wale button se edit karein. Bus kiraya bacche ki
        fees me transport hisse se apne aap judta hai.
      </p>

      {/* Naya Route Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Naya Bus Route</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Route ka Naam *</Label>
              <Input
                value={routeForm.routeName}
                onChange={(e) =>
                  setRouteForm({ ...routeForm, routeName: e.target.value })
                }
                placeholder="e.g., City Route, Rampur Route"
              />
            </div>
            <div className="space-y-2">
              <Label>Mahina Kiraya (₹)</Label>
              <Input
                type="number"
                value={routeForm.amount}
                onChange={(e) =>
                  setRouteForm({ ...routeForm, amount: e.target.value })
                }
                placeholder="e.g., 800"
              />
            </div>
            <div className="space-y-2">
              <Label>Gaadi Number (Vehicle No.)</Label>
              <Input
                value={routeForm.vehicleNo}
                onChange={(e) =>
                  setRouteForm({ ...routeForm, vehicleNo: e.target.value })
                }
                placeholder="e.g., UP93 AB 1234"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Driver ka Naam</Label>
                <Input
                  value={routeForm.driverName}
                  onChange={(e) =>
                    setRouteForm({ ...routeForm, driverName: e.target.value })
                  }
                  placeholder="e.g., Ramesh Kumar"
                />
              </div>
              <div className="space-y-2">
                <Label>Driver ka Mobile</Label>
                <Input
                  value={routeForm.driverContact}
                  onChange={(e) =>
                    setRouteForm({
                      ...routeForm,
                      driverContact: e.target.value,
                    })
                  }
                  placeholder="e.g., 9876543210"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void addRoute()}
              disabled={addingRoute}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {addingRoute ? "Ban raha hai…" : "Route Banao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Edit Dialog (v3.3 merge — PUT /api/transport-routes/:id) */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Route Badlein — {editTarget?.routeName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Route ka Naam *</Label>
              <Input
                value={editForm.routeName}
                onChange={(e) =>
                  setEditForm({ ...editForm, routeName: e.target.value })
                }
                placeholder="e.g., City Route, Rampur Route"
              />
            </div>
            <div className="space-y-2">
              <Label>Mahina Kiraya (₹)</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) =>
                  setEditForm({ ...editForm, amount: e.target.value })
                }
                placeholder="e.g., 800"
              />
            </div>
            <div className="space-y-2">
              <Label>Gaadi Number (Vehicle No.)</Label>
              <Input
                value={editForm.vehicleNo}
                onChange={(e) =>
                  setEditForm({ ...editForm, vehicleNo: e.target.value })
                }
                placeholder="e.g., UP93 AB 1234"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Driver ka Naam</Label>
                <Input
                  value={editForm.driverName}
                  onChange={(e) =>
                    setEditForm({ ...editForm, driverName: e.target.value })
                  }
                  placeholder="e.g., Ramesh Kumar"
                />
              </div>
              <div className="space-y-2">
                <Label>Driver ka Mobile</Label>
                <Input
                  value={editForm.driverContact}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      driverContact: e.target.value,
                    })
                  }
                  placeholder="e.g., 9876543210"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveEdit()}
              disabled={savingEdit}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {savingEdit ? "Save ho raha hai…" : "Badlav Save karein"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Route hatayein?
            </DialogTitle>
            <DialogDescription>
              <b>{deleteTarget?.routeName}</b> route delete ho jayega.
              Is route par abhi{" "}
              <b>
                {deleteTarget
                  ? (studentsByRoute.get(deleteTarget.id) || []).length
                  : 0}
              </b>{" "}
              bacche jude hain — pehle unhe hata lein, warna unka
              transport jod atka reh sakta hai.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deleteRoute()}>
              Haan, Delete karein
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
