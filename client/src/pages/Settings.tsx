import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const json = async (url: string) => (await fetch(url, { credentials: "include" })).json();

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

  const school = useQuery<any>({
    queryKey: [`/api/schools/${user?.schoolId}`],
    queryFn: () => json(`/api/schools/${user?.schoolId}`),
    enabled: !!user,
  });

  const sessions = useQuery<any[]>({
    queryKey: ["/api/academic-sessions"],
    queryFn: async () => {
      const data = await json("/api/academic-sessions");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const transportRoutes = useQuery<TransportRoute[]>({
    queryKey: ["/api/transport-routes", manager],
    queryFn: async () => {
      const data = await json(manager ? "/api/transport-routes?includeInactive=true" : "/api/transport-routes");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [className, setClassName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [routeName, setRouteName] = useState("");
  const [routeAmount, setRouteAmount] = useState("");
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [routeMessage, setRouteMessage] = useState("");

  const saveSchool = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/schools/${user?.schoolId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/schools/${user?.schoolId}`] }),
  });

  const createSession = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/academic-sessions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] });
      setName("");
    },
  });

  const activate = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/academic-sessions/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] }),
  });

  const createClass = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/management/classes", data),
    onSuccess: () => setClassName(""),
  });

  const changePassword = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/change-password", {
      currentPassword,
      newPassword,
      confirmPassword,
    }),
    onSuccess: () => {
      setSecurityMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => setSecurityMessage(error instanceof Error ? error.message : "Password change failed"),
  });

  const createRoute = useMutation({
    mutationFn: (data: { routeName: string; amount: number }) =>
      apiRequest("POST", "/api/transport-routes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setRouteName("");
      setRouteAmount("");
      setRouteMessage("Bus route added successfully.");
    },
    onError: (error) => setRouteMessage(error instanceof Error ? error.message : "Unable to add bus route."),
  });

  const updateRoute = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { routeName?: string; amount?: number } }) =>
      apiRequest("PATCH", `/api/transport-routes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setEditingRouteId(null);
      setRouteName("");
      setRouteAmount("");
      setRouteMessage("Bus route updated successfully.");
    },
    onError: (error) => setRouteMessage(error instanceof Error ? error.message : "Unable to update bus route."),
  });

  const deactivateRoute = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/transport-routes/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/transport-routes"] });
      setRouteMessage("Bus route deactivated. Existing student records are preserved.");
    },
    onError: (error) => setRouteMessage(error instanceof Error ? error.message : "Unable to deactivate bus route."),
  });

  const submitRoute = () => {
    const trimmedName = routeName.trim();
    const amount = Number(routeAmount);
    if (!trimmedName || !Number.isInteger(amount) || amount <= 0) {
      setRouteMessage("Enter a route name and a positive whole-number monthly charge.");
      return;
    }

    if (editingRouteId) {
      updateRoute.mutate({ id: editingRouteId, data: { routeName: trimmedName, amount } });
    } else {
      createRoute.mutate({ routeName: trimmedName, amount });
    }
  };

  const startEditRoute = (route: TransportRoute) => {
    setEditingRouteId(route.id);
    setRouteName(route.routeName);
    setRouteAmount(String(route.amount));
    setRouteMessage("");
  };

  const cancelRouteEdit = () => {
    setEditingRouteId(null);
    setRouteName("");
    setRouteAmount("");
    setRouteMessage("");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 max-w-5xl">
        <h1 className="text-3xl font-bold text-slate-900">Settings & school management</h1>
        <p className="mt-2 text-slate-600">Manage your school profile and academic structure. Historical records are never deleted.</p>

        <section className="mt-8 rounded-xl bg-white border p-6">
          <h2 className="text-xl font-semibold">Account security</h2>
          <p className="text-sm text-slate-500 mt-1">Use at least 12 characters with uppercase, lowercase, number, and symbol.</p>
          <div className="grid md:grid-cols-3 gap-3 mt-4">
            <input className="border rounded p-2" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Current password" />
            <input className="border rounded p-2" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" />
            <input className="border rounded p-2" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
          </div>
          <button className="mt-4 bg-indigo-600 text-white rounded px-4 py-2" disabled={changePassword.isPending} onClick={() => changePassword.mutate()}>
            Change password
          </button>
          {securityMessage && <p className="mt-2 text-sm">{securityMessage}</p>}
        </section>

        <section className="mt-8 rounded-xl bg-white border p-6">
          <h2 className="text-xl font-semibold">School profile</h2>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <input className="border rounded p-2" value={school.data?.name ?? ""} onChange={e => school.data && (school.data.name = e.target.value)} placeholder="School name" />
            <input className="border rounded p-2" value={school.data?.contact ?? ""} onChange={e => school.data && (school.data.contact = e.target.value)} placeholder="Contact" />
            <input className="border rounded p-2 md:col-span-2" value={school.data?.address ?? ""} onChange={e => school.data && (school.data.address = e.target.value)} placeholder="Address" />
          </div>
          {manager && (
            <button className="mt-4 bg-indigo-600 text-white rounded px-4 py-2" onClick={() => saveSchool.mutate({
              name: school.data.name,
              contact: school.data.contact,
              address: school.data.address,
              logo: school.data.logo,
            })}>
              Save profile
            </button>
          )}
        </section>

        <section className="mt-6 rounded-xl bg-white border p-6">
          <h2 className="text-xl font-semibold">Academic sessions</h2>
          {manager && (
            <div className="flex gap-2 mt-4">
              <input className="border rounded p-2" value={name} onChange={e => setName(e.target.value)} placeholder="New session, e.g. 2026-27" />
              <button className="bg-indigo-600 text-white rounded px-4" onClick={() => createSession.mutate({ name, isActive: false })}>Create</button>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {sessions.data?.map(s => (
              <div className="flex justify-between border rounded p-3" key={s.id}>
                <span>{s.name} {s.isActive && <b className="text-green-700">(active)</b>}</span>
                {manager && !s.isActive && <button className="text-indigo-700" onClick={() => activate.mutate(s.id)}>Activate</button>}
              </div>
            ))}
          </div>
        </section>

        {manager && (
          <>
            <section className="mt-6 rounded-xl bg-white border p-6">
              <h2 className="text-xl font-semibold">Classes</h2>
              <div className="flex flex-col md:flex-row gap-2 mt-4">
                <select className="border rounded p-2" value={sessionId} onChange={e => setSessionId(e.target.value)}>
                  <option value="">Choose session</option>
                  {sessions.data?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="border rounded p-2" value={className} onChange={e => setClassName(e.target.value)} placeholder="Class name" />
                <button className="bg-indigo-600 text-white rounded px-4" onClick={() => createClass.mutate({ sessionId: Number(sessionId), name: className })}>Add class</button>
              </div>
            </section>

            <section className="mt-6 rounded-xl bg-white border p-6">
              <h2 className="text-xl font-semibold">Bus Routes & Charges</h2>
              <p className="text-sm text-slate-500 mt-1">Create and manage school transport routes. Deactivating a route does not remove existing student history.</p>

              <div className="grid md:grid-cols-[1fr_180px_auto_auto] gap-2 mt-4">
                <input className="border rounded p-2" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Route name, e.g. City Route" />
                <input className="border rounded p-2" type="number" min="1" step="1" value={routeAmount} onChange={e => setRouteAmount(e.target.value)} placeholder="Monthly charge ₹" />
                <button className="bg-indigo-600 text-white rounded px-4" onClick={submitRoute} disabled={createRoute.isPending || updateRoute.isPending}>
                  {editingRouteId ? "Save Route" : "Add Route"}
                </button>
                {editingRouteId && <button className="border rounded px-4" onClick={cancelRouteEdit}>Cancel</button>}
              </div>
              {routeMessage && <p className="mt-2 text-sm text-slate-600">{routeMessage}</p>}

              <div className="mt-5">
                {transportRoutes.isLoading ? <p>Loading bus routes...</p> : transportRoutes.data?.length ? (
                  <div className="space-y-2">
                    {transportRoutes.data.map(route => (
                      <div key={route.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-3">
                        <div>
                          <div className="font-medium">{route.routeName}</div>
                          <div className="text-sm text-slate-500">₹{route.amount.toLocaleString()} / month · {route.isActive ? "Active" : "Inactive"}</div>
                        </div>
                        <div className="flex gap-2">
                          <button className="border rounded px-3 py-1.5" onClick={() => startEditRoute(route)}>Edit</button>
                          {route.isActive && (
                            <button
                              className="border border-red-200 text-red-700 rounded px-3 py-1.5"
                              disabled={deactivateRoute.isPending}
                              onClick={() => {
                                if (window.confirm(`Deactivate "${route.routeName}"? Existing student assignments are preserved.`)) {
                                  deactivateRoute.mutate(route.id);
                                }
                              }}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-slate-500">No bus routes configured yet.</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
