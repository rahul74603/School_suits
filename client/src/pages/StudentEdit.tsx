import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/QueryState";
import { useStudent, useUpdateStudent } from "@/hooks/use-students";
import { useEffect } from "react";

export default function StudentEdit() {
  const { id } = useParams<{ id: string }>(); const [, setLocation] = useLocation(); const query = useStudent(Number(id)); const update = useUpdateStudent();
  const form = useForm({ defaultValues: { name: "", fatherName: "", motherName: "", class: "", section: "", rollNo: "", contact: "", address: "", dob: "" } });
  useEffect(() => { if (query.data) form.reset({ name: query.data.name, fatherName: query.data.fatherName, motherName: query.data.motherName || "", class: query.data.class, section: query.data.section, rollNo: query.data.rollNo || "", contact: query.data.contact, address: query.data.address || "", dob: query.data.dob || "" }); }, [query.data, form]);
  if (query.isLoading) return <div className="p-8">Loading student...</div>; if (query.isError) return <div className="p-8"><QueryError message={query.error.message} /></div>; if (!query.data) return <div className="p-8"><QueryError message="Student not found." /></div>;
  return <div className="flex min-h-screen bg-slate-50"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="max-w-2xl"><h1 className="text-3xl font-bold mb-6">Edit student</h1><form className="space-y-4 bg-white p-6 rounded-xl" onSubmit={form.handleSubmit(async (data) => { await update.mutateAsync({ id: Number(id), ...data, dob: data.dob || undefined }); setLocation(`/students/${id}`); })}>{(["name","fatherName","motherName","class","section","rollNo","contact","address","dob"] as const).map((field) => <label key={field} className="block text-sm font-medium">{field === "fatherName" ? "Father/guardian" : field}<Input className="mt-1" type={field === "dob" ? "date" : "text"} {...form.register(field)} /></label>)}<div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setLocation(`/students/${id}`)}>Cancel</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving..." : "Save changes"}</Button></div>{update.isError && <p className="text-sm text-red-600">{update.error.message}</p>}</form></div></main></div>;
}
