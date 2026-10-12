import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStudentSchema } from "@shared/schema";
import { useCreateStudent } from "@/hooks/use-students";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useLocation } from "wouter";
import { Bus, BookOpen } from "lucide-react";

const DEFAULT_STREAMS = [
  {
    id: -1,
    code: "PCM",
    name: "Science — Mathematics Group (PCM / गणित संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Mathematics",
    electiveOptions: "Computer Science, Informatics Practices, Physical Education, Sanskrit",
    maxElectives: 1,
  },
  {
    id: -2,
    code: "PCB",
    name: "Science — Biology Group (PCB / जीव विज्ञान संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Biology",
    electiveOptions: "Informatics Practices, Physical Education, Biotechnology, Mathematics (Additional)",
    maxElectives: 1,
  },
  {
    id: -3,
    code: "PCMB",
    name: "Science — Maths + Biology Combined (PCMB)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Physics, Chemistry, Mathematics, Biology",
    electiveOptions: "Physical Education, Computer Science",
    maxElectives: 1,
  },
  {
    id: -4,
    code: "COMMERCE",
    name: "Commerce Group (वाणिज्य संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Book Keeping & Accountancy, Business Studies",
    electiveOptions: "Economics, Informatics Practices, Business Mathematics, Industrial Organisation, Physical Education",
    maxElectives: 2,
  },
  {
    id: -5,
    code: "ARTS",
    name: "Arts / Humanities Group (कला संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "History, Political Science",
    electiveOptions: "Geography, Economics, Sociology, Psychology, Sanskrit, Home Science, Drawing & Painting",
    maxElectives: 2,
  },
  {
    id: -6,
    code: "AGRICULTURE",
    name: "Agriculture Group (कृषि संकाय)",
    compulsorySubjects: "Hindi, English",
    coreSubjects: "Elements of Science & Maths for Agriculture, Crop Production & Horticulture, Animal Husbandry & Poultry Farming",
    electiveOptions: "Physical Education, Computer Basics",
    maxElectives: 1,
  },
];

export default function Admissions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createStudent = useCreateStudent();

  type TransportRoute = {
    id: number;
    routeName: string;
    amount: number;
    isActive: boolean;
  };

  const transportRoutes = useQuery<TransportRoute[]>({
    queryKey: ["/api/transport-routes"],
    queryFn: async () => {
      const response = await fetch("/api/transport-routes", { credentials: "include" });
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const streamsQuery = useQuery<any[]>({
    queryKey: ["/api/academic-streams"],
    queryFn: async () => {
      const res = await fetch("/api/academic-streams", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const availableStreams =
    streamsQuery.data && streamsQuery.data.length > 0 ? streamsQuery.data : DEFAULT_STREAMS;

  const form = useForm({
    resolver: zodResolver(insertStudentSchema),
    defaultValues: {
      admissionNo: "",
      name: "",
      fatherName: "",
      motherName: "",
      class: "1",
      section: "A",
      rollNo: "",
      aadhaar: "",
      category: "General",
      contact: "",
      address: "",
      dob: undefined,
      transportId: null,
      stream: null as string | null,
      streamId: null as number | null,
      electedSubjects: null as string | null,
    },
  });

  const selectedClass = form.watch("class");
  const isHigherSecondary = selectedClass === "11" || selectedClass === "12";

  const [selectedStreamCode, setSelectedStreamCode] = useState<string>("");
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);

  const currentStreamObj = availableStreams.find((s) => s.code === selectedStreamCode);

  useEffect(() => {
    if (!isHigherSecondary) {
      setSelectedStreamCode("");
      setSelectedElectives([]);
      form.setValue("stream", null);
      form.setValue("streamId", null);
      form.setValue("electedSubjects", null);
    } else if (!selectedStreamCode && availableStreams.length > 0) {
      setSelectedStreamCode(availableStreams[0].code);
    }
  }, [isHigherSecondary, availableStreams, selectedStreamCode, form]);

  useEffect(() => {
    if (!isHigherSecondary || !currentStreamObj) return;
    const compulsory = (currentStreamObj.compulsorySubjects || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const core = (currentStreamObj.coreSubjects || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const combined = [...compulsory, ...core, ...selectedElectives].join(", ");
    form.setValue("stream", `${currentStreamObj.code} - ${currentStreamObj.name}`);
    form.setValue("streamId", currentStreamObj.id > 0 ? currentStreamObj.id : null);
    form.setValue("electedSubjects", combined);
  }, [isHigherSecondary, currentStreamObj, selectedElectives, form]);

  const toggleElective = (subj: string) => {
    setSelectedElectives((prev) =>
      prev.includes(subj) ? prev.filter((item) => item !== subj) : [...prev, subj],
    );
  };

  const onSubmit = (data: z.infer<typeof insertStudentSchema>) => {
    createStudent.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Admission Successful",
          description: `Student ${data.name} has been admitted to Class ${data.class}${data.stream ? ` (${data.stream})` : ""}.`,
        });
        setLocation("/students");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create admission record.",
        });
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8 max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900">New Admission</h1>
          <p className="text-slate-500 mt-1">Register a new student for the academic year</p>
        </header>

        <div className="max-w-3xl mx-auto">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Student Details</CardTitle>
              <CardDescription>Fill in the required information below.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="admissionNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Admission Number (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Leave blank to generate safely" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Student Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Full Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Class Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="class"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Class</FormLabel>
                          <FormControl>
                            <select
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                              {...field}
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
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section</FormLabel>
                          <FormControl>
                            <Input placeholder="A, B, C..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rollNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roll No (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Class 11 & 12 Stream & Subject Selection */}
                  {isHigherSecondary && (
                    <Card className="border-indigo-200 bg-indigo-50/40">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                          Higher Secondary Stream & Elective Subjects (Class {selectedClass})
                        </CardTitle>
                        <CardDescription>
                          After Class 10, students in Class 11 & 12 elect their Stream (PCM, PCB, Commerce, Arts/Humanities, Agriculture) and optional subjects.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Select Stream / Faculty (संकाय)
                          </label>
                          <select
                            className="w-full px-3 py-2 rounded-md border border-input bg-white text-sm"
                            value={selectedStreamCode}
                            onChange={(e) => {
                              setSelectedStreamCode(e.target.value);
                              setSelectedElectives([]);
                            }}
                          >
                            {availableStreams.map((st: any) => (
                              <option key={st.code} value={st.code}>
                                {st.code} — {st.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {currentStreamObj && (
                          <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
                            <div>
                              <span className="text-xs font-semibold uppercase text-slate-500 block mb-1">
                                Compulsory Languages (Included)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {(currentStreamObj.compulsorySubjects || "")
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean)
                                  .map((subj: string) => (
                                    <span
                                      key={subj}
                                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800"
                                    >
                                      ✓ {subj}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-semibold uppercase text-slate-500 block mb-1">
                                Core Stream Subjects (Included)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {(currentStreamObj.coreSubjects || "")
                                  .split(",")
                                  .map((s: string) => s.trim())
                                  .filter(Boolean)
                                  .map((subj: string) => (
                                    <span
                                      key={subj}
                                      className="rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800"
                                    >
                                      ✓ {subj}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            {currentStreamObj.electiveOptions && (
                              <div>
                                <span className="text-xs font-semibold uppercase text-slate-500 block mb-1">
                                  Optional / Elective Subjects (Select up to{" "}
                                  {currentStreamObj.maxElectives || 1})
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {currentStreamObj.electiveOptions
                                    .split(",")
                                    .map((s: string) => s.trim())
                                    .filter(Boolean)
                                    .map((subj: string) => {
                                      const checked = selectedElectives.includes(subj);
                                      return (
                                        <label
                                          key={subj}
                                          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                                            checked
                                              ? "border-indigo-600 bg-indigo-600 text-white"
                                              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={checked}
                                            onChange={() => toggleElective(subj)}
                                          />
                                          {checked ? "✓ " : "+ "}
                                          {subj}
                                        </label>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            <div className="pt-2 border-t text-xs text-slate-600">
                              <b>Final Elected Subjects:</b>{" "}
                              {form.watch("electedSubjects") || "None"}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Parents Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father&apos;s Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="motherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother&apos;s Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number</FormLabel>
                          <FormControl>
                            <Input placeholder="10-digit number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="aadhaar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Aadhaar No (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Transport */}
                  <Card className="border border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bus className="w-4 h-4" />
                        Transport / Bus Service
                      </CardTitle>
                      <CardDescription>
                        Optional. Assign an active bus route to this student.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="transportId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bus Route</FormLabel>
                            <FormControl>
                              <select
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                                value={field.value == null ? "" : String(field.value)}
                                onChange={(e) =>
                                  field.onChange(e.target.value ? Number(e.target.value) : null)
                                }
                              >
                                <option value="">No Transport</option>
                                {transportRoutes.data?.map((route) => (
                                  <option key={route.id} value={route.id}>
                                    {route.routeName} — ₹{route.amount.toLocaleString()}/month
                                  </option>
                                ))}
                              </select>
                            </FormControl>
                            {transportRoutes.isLoading && (
                              <p className="text-xs text-slate-500">Loading routes...</p>
                            )}
                            {!transportRoutes.isLoading &&
                              transportRoutes.data?.length === 0 && (
                                <p className="text-xs text-slate-500">
                                  No active bus routes configured. You can add them in Settings.
                                </p>
                              )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setLocation("/students")}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full" disabled={createStudent.isPending}>
                      {createStudent.isPending ? "Submitting..." : "Complete Admission"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
