import { Sidebar } from "@/components/Sidebar";
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

export default function Admissions() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createStudent = useCreateStudent();

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
      dob: undefined
    }
  });

  const onSubmit = (data: z.infer<typeof insertStudentSchema>) => {
    createStudent.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Admission Successful",
          description: `Student ${data.name} has been admitted to Class ${data.class}.`,
        });
        setLocation("/students");
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create admission record.",
        });
      }
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
                              {["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(c => (
                                <option key={c} value={c}>{c}</option>
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

                  {/* Parents Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father's Name</FormLabel>
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
                          <FormLabel>Mother's Name</FormLabel>
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
                        <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4 pt-4">
                    <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/students")}>
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
