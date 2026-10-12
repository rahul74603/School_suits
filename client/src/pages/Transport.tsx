import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Bus, Trash2 } from "lucide-react";
import type { Student, StudentTransportAllocation, TransportRoute } from "@shared/schema";

export default function Transport() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const canManage = ["admin", "principal", "accountant", "staff"].includes(user?.role ?? "");
  const isStudent = user?.role === "student";

  const [routeName, setRouteName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverContact, setDriverContact] = useState("");
  const [stops, setStops] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("1200");
  const [capacity, setCapacity] = useState("40");

  const [studentId, setStudentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [stopName, setStopName] = useState("");
  const [allocFee, setAllocFee] = useState("1200");
  const [message, setMessage] = useState("");

  const routes = useQuery<TransportRoute[]>({
    queryKey: ["/api/transport/routes"],
    queryFn: async () => (await fetch("/api/transport/routes", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const allocations = useQuery<StudentTransportAllocation[]>({
    queryKey: ["/api/transport/allocations"],
    queryFn: async () =>
      (await fetch("/api/transport/allocations", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const students = useQuery<Student[]>({
    queryKey: ["/api/students"],
    queryFn: async () => (await fetch("/api/students", { credentials: "include" })).json(),
    enabled: canManage,
  });

  const studentById = new Map((students.data ?? []).map((s) => [s.id, s]));
  const routeById = new Map((routes.data ?? []).map((r) => [r.id, r]));

  const createRoute = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/transport/routes", {
        routeName,
        vehicleNo,
        driverName,
        driverContact,
        stops,
        monthlyFee: Number(monthlyFee),
        capacity: Number(capacity),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport/routes"] });
      setRouteName("");
      setVehicleNo("");
      setDriverName("");
      setDriverContact("");
      setStops("");
      setMessage("Transport route added.");
    },
  });

  const allocateStudent = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/transport/allocations", {
        studentId: Number(studentId),
        routeId: Number(routeId),
        stopName,
        monthlyFee: Number(allocFee),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport/allocations"] });
      setStopName("");
      setMessage("Student assigned to transport route.");
    },
  });

  const removeAllocation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transport/allocations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/transport/allocations"] }),
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transport & Bus Routes</h1>
          <p className="text-slate-500 mt-1">
            Manage school buses, driver contacts, route stops, and student transport allocations.
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {canManage && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Add Bus / Transport Route</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Route Name (e.g., Route 1 - MP Nagar)"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                  />
                  <Input
                    placeholder="Vehicle No (e.g., MP-04-PA-1234)"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  />
                  <Input
                    placeholder="Driver Name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                  <Input
                    placeholder="Driver Contact"
                    value={driverContact}
                    onChange={(e) => setDriverContact(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Monthly Fee (₹)"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Seat Capacity"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
                <Input
                  placeholder="Major Stops (comma separated, e.g., New Market, Roshanpura, Board Office)"
                  value={stops}
                  onChange={(e) => setStops(e.target.value)}
                />
                <Button
                  onClick={() => createRoute.mutate()}
                  disabled={
                    createRoute.isPending ||
                    !routeName.trim() ||
                    !vehicleNo.trim() ||
                    !driverName.trim() ||
                    !stops.trim()
                  }
                >
                  {createRoute.isPending ? "Saving..." : "Add Route"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Assign Student to Bus Route</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select Student...</option>
                  {(students.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={routeId}
                  onChange={(e) => {
                    setRouteId(e.target.value);
                    const r = routeById.get(Number(e.target.value));
                    if (r) setAllocFee(String((r as any).monthlyFee ?? r.amount ?? 500));
                  }}
                >
                  <option value="">Select Bus Route...</option>
                  {(routes.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.routeName} {r.vehicleNo ? `(${r.vehicleNo})` : ""} — ₹
                      {(r as any).monthlyFee ?? r.amount}/mo
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Pickup / Drop Stop Name"
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Monthly Transport Fee (₹)"
                    value={allocFee}
                    onChange={(e) => setAllocFee(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => allocateStudent.mutate()}
                  disabled={allocateStudent.isPending || !studentId || !routeId || !stopName.trim()}
                >
                  {allocateStudent.isPending ? "Assigning..." : "Allocate Transport"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(routes.data ?? []).map((r) => {
            const count = (allocations.data ?? []).filter((a) => a.routeId === r.id).length;
            return (
              <Card key={r.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <Bus className="h-5 w-5 text-indigo-600" />
                      {r.routeName}
                    </div>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {r.vehicleNo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <b>Driver:</b> {r.driverName} ({r.driverContact})
                  </p>
                  <p className="text-xs text-slate-600">
                    <b>Stops:</b> {r.stops}
                  </p>
                  <div className="pt-2 border-t flex justify-between text-xs text-slate-500">
                    <span>Fee: ₹{(r as any).monthlyFee ?? r.amount}/month</span>
                    <span>
                      Occupancy: {count} / {r.capacity ?? 40} seats
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isStudent ? "My Transport Allocation" : "Student Transport Allocations"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-left">Student</th>
                    <th className="p-3 text-left">Route & Vehicle</th>
                    <th className="p-3 text-left">Stop Name</th>
                    <th className="p-3 text-left">Monthly Fee</th>
                    {canManage && <th className="p-3 text-left">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {!allocations.data?.length ? (
                    <tr>
                      <td className="p-6 text-center text-slate-500" colSpan={5}>
                        No student transport allocations recorded.
                      </td>
                    </tr>
                  ) : (
                    allocations.data.map((a) => {
                      const st = studentById.get(a.studentId);
                      const rt = routeById.get(a.routeId);
                      return (
                        <tr key={a.id} className="border-t">
                          <td className="p-3 font-medium">
                            {st ? `${st.name} (${st.class}-${st.section})` : `Student #${a.studentId}`}
                          </td>
                          <td className="p-3">
                            {rt ? `${rt.routeName} (${rt.vehicleNo})` : `Route #${a.routeId}`}
                          </td>
                          <td className="p-3">{a.stopName}</td>
                          <td className="p-3 font-semibold">₹{a.monthlyFee}</td>
                          {canManage && (
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => removeAllocation.mutate(a.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
