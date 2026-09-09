import { useStaff, useCreateStaff, useUpdateStaff } from "@/hooks/use-staff";
import { QueryError } from "@/components/QueryState";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStaffSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

export default function Staff() {
  const { data: staff, isLoading, isError, error, refetch } = useStaff();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingStaff, setEditingStaff] = useState<number | null>(null);

  const form = useForm({
    resolver: zodResolver(insertStaffSchema),
    defaultValues: {
      name: "",
      designation: "Teacher",
      basicSalary: 0,
      contact: ""
    }
  });

  const onSubmit = (data: z.infer<typeof insertStaffSchema>) => {
    const options = {
      onSuccess: () => { setOpen(false); setEditingStaff(null); form.reset(); toast({ title: editingStaff ? "Staff member updated" : "Staff member added successfully" }); },
      onError: (error: Error) => toast({ variant: "destructive", title: "Staff operation failed", description: error.message }),
    };
    if (editingStaff) updateStaff.mutate({ id: editingStaff, ...data }, options);
    else createStaff.mutate(data, options);
  };

  const filteredStaff = staff?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.designation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-slate-500 mt-1">Manage teachers and support staff</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingStaff(null); form.reset({ name: "", designation: "Teacher", basicSalary: 0, contact: "" }); }} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add New Staff Member"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="designation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Designation</FormLabel>
                          <FormControl>
                            <select 
                              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                              {...field}
                            >
                              <option value="Teacher">Teacher</option>
                              <option value="Clerk">Clerk</option>
                              <option value="Peon">Peon</option>
                              <option value="Principal">Principal</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="basicSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Basic Salary</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={e => field.onChange(parseInt(e.target.value))} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="contact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Number</FormLabel>
                        <FormControl>
                          <Input placeholder="10-digit mobile" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={createStaff.isPending}>
                    {createStaff.isPending ? "Adding..." : "Add Staff Member"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-border mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search staff..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead className="text-right">Join Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError ? (
                <TableRow><TableCell colSpan={6}><QueryError message={error instanceof Error ? error.message : "Unable to load staff."} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading staff...</TableCell>
                </TableRow>
              ) : filteredStaff?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No staff found.</TableCell>
                </TableRow>
              ) : (
                filteredStaff?.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        s.designation === 'Teacher' ? 'bg-purple-50 text-purple-700' :
                        s.designation === 'Principal' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {s.designation}
                      </span>
                    </TableCell>
                    <TableCell>{s.contact}</TableCell>
                    <TableCell>₹{s.basicSalary.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-500">
                      {s.joinDate ? new Date(s.joinDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell><Button variant="outline" size="sm" onClick={() => { setEditingStaff(s.id); form.reset({ name: s.name, designation: s.designation, basicSalary: s.basicSalary, contact: s.contact }); setOpen(true); }}>Edit</Button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
