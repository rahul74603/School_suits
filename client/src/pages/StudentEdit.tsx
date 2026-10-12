import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/QueryState";
import { useStudent, useUpdateStudent } from "@/hooks/use-students";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { useEffect } from "react";

export default function StudentEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { classOptions, sectionOptions } = useSchoolCatalog();
  const query = useStudent(Number(id));
  const update = useUpdateStudent();
  const form = useForm({
    defaultValues: {
      name: "",
      fatherName: "",
      motherName: "",
      class: "",
      section: "",
      rollNo: "",
      contact: "",
      address: "",
      dob: "",
    },
  });

  useEffect(() => {
    if (query.data) {
      form.reset({
        name: query.data.name,
        fatherName: query.data.fatherName,
        motherName: query.data.motherName || "",
        class: query.data.class,
        section: query.data.section,
        rollNo: query.data.rollNo || "",
        contact: query.data.contact,
        address: query.data.address || "",
        dob: query.data.dob || "",
      });
    }
  }, [query.data, form]);

  if (query.isLoading) return <div className="p-8">Loading student...</div>;
  if (query.isError)
    return (
      <div className="p-8">
        <QueryError message={query.error.message} />
      </div>
    );
  if (!query.data)
    return (
      <div className="p-8">
        <QueryError message="Student not found." />
      </div>
    );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold mb-6">Edit Student Profile</h1>
          <form
            className="space-y-4 bg-white p-6 rounded-xl border shadow-sm"
            onSubmit={form.handleSubmit(async (data) => {
              await update.mutateAsync({
                id: Number(id),
                ...data,
                dob: data.dob || undefined,
              });
              setLocation(`/students/${id}`);
            })}
          >
            <label className="block text-sm font-medium">
              Student Full Name
              <Input className="mt-1" {...form.register("name")} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">
                Father / Guardian Name
                <Input className="mt-1" {...form.register("fatherName")} />
              </label>
              <label className="block text-sm font-medium">
                Mother Name
                <Input className="mt-1" {...form.register("motherName")} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <label className="block text-sm font-medium">
                Class (Dropdown)
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("class")}
                >
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Section (Dropdown)
                <select
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                  {...form.register("section")}
                >
                  {sectionOptions.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Roll No
                <Input className="mt-1" {...form.register("rollNo")} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium">
                Contact Number
                <Input className="mt-1" {...form.register("contact")} />
              </label>
              <label className="block text-sm font-medium">
                Date of Birth
                <Input className="mt-1" type="date" {...form.register("dob")} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Address
              <Input className="mt-1" {...form.register("address")} />
            </label>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(`/students/${id}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            {update.isError && (
              <p className="text-sm text-red-600">{update.error.message}</p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
