import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

const json = async (url: string) => (await fetch(url, { credentials: "include" })).json();
export default function Settings() {
  const { data: user } = useAuth(); const qc = useQueryClient();
  const manager = user?.role === "admin" || user?.role === "principal";
  const school = useQuery<any>({ queryKey: [`/api/schools/${user?.schoolId}`], queryFn: () => json(`/api/schools/${user?.schoolId}`), enabled: !!user });
  const sessions = useQuery<any[]>({ queryKey: ["/api/academic-sessions"], queryFn: () => json("/api/academic-sessions"), enabled: !!user });
  const [name, setName] = useState(""); const [sessionId, setSessionId] = useState(""); const [className, setClassName] = useState("");
  const saveSchool = useMutation({ mutationFn: (data: any) => apiRequest("PUT", `/api/schools/${user?.schoolId}`, data), onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/schools/${user?.schoolId}`] }) });
  const createSession = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/academic-sessions", data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] }); setName(""); } });
  const activate = useMutation({ mutationFn: (id: number) => apiRequest("POST", `/api/academic-sessions/${id}/activate`), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/academic-sessions"] }) });
  const createClass = useMutation({ mutationFn: (data: any) => apiRequest("POST", "/api/management/classes", data), onSuccess: () => setClassName("") });
  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 ml-64 p-8 max-w-5xl"><h1 className="text-3xl font-bold text-slate-900">Settings & school management</h1><p className="mt-2 text-slate-600">Manage your school profile and academic structure. Historical records are never deleted.</p>
    <section className="mt-8 rounded-xl bg-white border p-6"><h2 className="text-xl font-semibold">School profile</h2><div className="grid md:grid-cols-2 gap-3 mt-4"><input className="border rounded p-2" value={school.data?.name ?? ""} onChange={e => school.data && (school.data.name=e.target.value)} placeholder="School name" /><input className="border rounded p-2" value={school.data?.contact ?? ""} onChange={e => school.data && (school.data.contact=e.target.value)} placeholder="Contact" /><input className="border rounded p-2 md:col-span-2" value={school.data?.address ?? ""} onChange={e => school.data && (school.data.address=e.target.value)} placeholder="Address" /></div>{manager && <button className="mt-4 bg-indigo-600 text-white rounded px-4 py-2" onClick={() => saveSchool.mutate({ name: school.data.name, contact: school.data.contact, address: school.data.address, logo: school.data.logo })}>Save profile</button>}</section>
    <section className="mt-6 rounded-xl bg-white border p-6"><h2 className="text-xl font-semibold">Academic sessions</h2>{manager && <div className="flex gap-2 mt-4"><input className="border rounded p-2" value={name} onChange={e=>setName(e.target.value)} placeholder="New session, e.g. 2026-27" /><button className="bg-indigo-600 text-white rounded px-4" onClick={()=>createSession.mutate({name,isActive:false})}>Create</button></div>}<div className="mt-4 space-y-2">{sessions.data?.map(s=><div className="flex justify-between border rounded p-3" key={s.id}><span>{s.name} {s.isActive && <b className="text-green-700">(active)</b>}</span>{manager && !s.isActive && <button className="text-indigo-700" onClick={()=>activate.mutate(s.id)}>Activate</button>}</div>)}</div></section>
    {manager && <section className="mt-6 rounded-xl bg-white border p-6"><h2 className="text-xl font-semibold">Classes</h2><div className="flex gap-2 mt-4"><select className="border rounded p-2" value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Choose session</option>{sessions.data?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input className="border rounded p-2" value={className} onChange={e=>setClassName(e.target.value)} placeholder="Class name" /><button className="bg-indigo-600 text-white rounded px-4" onClick={()=>createClass.mutate({sessionId:Number(sessionId),name:className})}>Add class</button></div></section>}
  </main></div>;
}
