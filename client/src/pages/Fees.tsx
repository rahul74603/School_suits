import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useFeeStructures, usePayments, useCollectFee, useDefaulters, useCreateFeeStructure } from "@/hooks/use-fees";
import { useActiveSession, useSchool } from "@/hooks/use-core";
import { useUpdateFeeStructure, useDeleteFeeStructure } from "@/hooks/use-fees-admin";
import { useStudents } from "@/hooks/use-students";
import { useAuth } from "@/hooks/use-auth";
import { QueryError } from "@/components/QueryState";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeePaymentSchema, insertFeeStructureSchema, type FeePayment } from "@shared/schema";
import { Printer, Bus } from "lucide-react";
import { z } from "zod";

export default function Fees() {
  const { data: user } = useAuth();
  const isStudent = user?.role === "student";
  const canCollect = ["admin", "accountant"].includes(user?.role ?? "");
  const canManageDues = ["admin", "principal", "accountant", "staff"].includes(user?.role ?? "");

  const { toast } = useToast();
  const school = useSchool();
  const session = useActiveSession();
  const students = useStudents();
  const structures = useFeeStructures();
  const payments = usePayments({ sessionId: session.data?.id ? String(session.data.id) : undefined });
  const month = format(new Date(), "MMMM");
  const defaulters = useDefaulters({ month, year: new Date().getFullYear() });
  const collect = useCollectFee();
  const createStructure = useCreateFeeStructure();

  const paymentForm = useForm({
    resolver: zodResolver(insertFeePaymentSchema),
    defaultValues: {
      studentId: 0,
      amount: 0,
      month,
      year: new Date().getFullYear(),
      receiptNo: `REC-${Date.now()}`,
      remarks: "",
    },
  });
  const structureForm = useForm({
    resolver: zodResolver(insertFeeStructureSchema),
    defaultValues: { class: "1", monthlyFee: 0, admissionFee: 0, examFee: 0, otherFee: 0 },
  });

  const queryClient = useQueryClient();
  const [tab, setTab] = useState(isStudent ? "history" : "collect");
  const [editingStructure, setEditingStructure] = useState<number | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FeePayment | null>(null);

  // Student Due creation state
  const [dueStudentId, setDueStudentId] = useState("");
  const [dueDescription, setDueDescription] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const dues = useQuery<any[]>({
    queryKey: ["/api/student-dues"],
    queryFn: async () => (await fetch("/api/student-dues", { credentials: "include" })).json(),
  });

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

  const createDue = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/student-dues", {
        studentId: Number(dueStudentId),
        description: dueDescription,
        amount: Number(dueAmount),
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student-dues"] });
      setDueDescription("");
      setDueAmount("");
      toast({ title: "Student due created" });
    },
  });

  const dueStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/student-dues/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/student-dues"] }),
  });

  const updateStructure = useUpdateFeeStructure();
  const deleteStructure = useDeleteFeeStructure();

  const studentById = new Map((students.data ?? []).map((s) => [s.id, s]));
  const structureByClass = new Map((structures.data ?? []).map((s) => [s.class, s]));

  const submitPayment = (data: z.infer<typeof insertFeePaymentSchema>) =>
    collect.mutate(data, {
      onSuccess: (created) => {
        toast({ title: "Payment recorded" });
        setSelectedReceipt(created);
        paymentForm.reset({
          ...paymentForm.getValues(),
          studentId: 0,
          amount: 0,
          receiptNo: `REC-${Date.now()}`,
        });
      },
      onError: (error) =>
        toast({ variant: "destructive", title: "Payment failed", description: error.message }),
    });

  const submitStructure = (data: z.infer<typeof insertFeeStructureSchema>) => {
    const options = {
      onSuccess: () => {
        toast({ title: editingStructure ? "Fee structure updated" : "Fee structure created" });
        structureForm.reset();
        setEditingStructure(null);
      },
      onError: (error: Error) =>
        toast({
          variant: "destructive",
          title: "Fee structure failed",
          description: error.message,
        }),
    };
    if (editingStructure) updateStructure.mutate({ id: editingStructure, ...data }, options);
    else createStructure.mutate(data, options);
  };

  const error = [structures, payments, session, transportRoutes].find((q) => q.isError);
  const receiptStudent = selectedReceipt ? studentById.get(selectedReceipt.studentId) : undefined;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-3xl font-bold">Fees, Dues & Receipts</h1>
            <p className="text-slate-500 mt-1">
              Active session: {session.data?.name || "not available"}
            </p>
          </div>
          {selectedReceipt && (
            <div className="flex gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print Fee Receipt
              </Button>
              <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
                Close Receipt
              </Button>
            </div>
          )}
        </div>

        {selectedReceipt && (
          <div className="rounded-xl border-2 border-slate-800 bg-white p-8 shadow-md">
            <div className="border-b pb-4 text-center">
              <h2 className="text-xl font-bold uppercase">
                {school.data?.name || "SchoolSuite Academy"}
              </h2>
              <p className="text-xs text-slate-600">{school.data?.address}</p>
              <p className="text-xs text-slate-500">Contact: {school.data?.contact}</p>
              <div className="mt-2 inline-block rounded bg-slate-900 px-4 py-1 text-xs font-bold uppercase text-white">
                Official Fee Payment Receipt
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <b>Receipt No:</b> {selectedReceipt.receiptNo}
              </div>
              <div>
                <b>Payment Date:</b> {new Date(selectedReceipt.paymentDate).toLocaleDateString()}
              </div>
              <div>
                <b>Student Name:</b>{" "}
                {receiptStudent?.name || `Student #${selectedReceipt.studentId}`}
              </div>
              <div>
                <b>Admission No:</b> {receiptStudent?.admissionNo || "—"}
              </div>
              <div>
                <b>Class / Section:</b>{" "}
                {receiptStudent ? `${receiptStudent.class}-${receiptStudent.section}` : "—"}
              </div>
              <div>
                <b>Fee Period:</b> {selectedReceipt.month || "General"} / {selectedReceipt.year}
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-slate-100 p-4 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Total Amount Received</span>
              <span className="text-2xl font-extrabold text-slate-900">
                ₹{selectedReceipt.amount.toLocaleString()}
              </span>
            </div>
            {selectedReceipt.remarks && (
              <p className="mt-3 text-xs text-slate-600">
                <b>Remarks:</b> {selectedReceipt.remarks}
              </p>
            )}
            <div className="mt-10 flex justify-between text-xs text-slate-500 pt-4 border-t">
              <span>Computer Generated Receipt</span>
              <span>Cashier / Accountant Signature</span>
            </div>
          </div>
        )}

        {error && (
          <QueryError
            message={
              error.error instanceof Error ? error.error.message : "Unable to load fee data."
            }
            onRetry={() => error.refetch()}
          />
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-6 print:hidden">
          <TabsList>
            {canCollect && <TabsTrigger value="collect">Collect Fee</TabsTrigger>}
            <TabsTrigger value="history">Payment History & Receipts</TabsTrigger>
            {!isStudent && <TabsTrigger value="defaulters">Defaulters</TabsTrigger>}
            <TabsTrigger value="dues">Student Dues</TabsTrigger>
            {canCollect && <TabsTrigger value="structure">Fee Structure</TabsTrigger>}
            <TabsTrigger value="transport">
              <Bus className="w-4 h-4 mr-1" /> Transport
            </TabsTrigger>
          </TabsList>

          {canCollect && (
            <TabsContent value="collect">
              <Card>
                <CardHeader>
                  <CardTitle>New Fee Collection</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="max-w-xl space-y-4"
                    onSubmit={paymentForm.handleSubmit(submitPayment)}
                  >
                    <div>
                      <label className="block text-sm font-medium mb-1">Select Student</label>
                      <select
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                        value={paymentForm.watch("studentId") || ""}
                        onChange={(e) => {
                          const sid = Number(e.target.value);
                          paymentForm.setValue("studentId", sid);
                          const st = studentById.get(sid);
                          if (st) {
                            const str = structureByClass.get(st.class);
                            const busRoute = st.transportId
                              ? transportRoutes.data?.find((r) => r.id === st.transportId)
                              : undefined;
                            const baseFee = str ? str.monthlyFee : 0;
                            const busFee = busRoute ? busRoute.amount : 0;
                            if (baseFee + busFee > 0) {
                              paymentForm.setValue("amount", baseFee + busFee);
                            }
                          }
                        }}
                      >
                        <option value="">Choose student...</option>
                        {(students.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-sm font-medium">
                        Amount (₹)
                        <Input
                          className="mt-1"
                          type="number"
                          {...paymentForm.register("amount", { valueAsNumber: true })}
                        />
                      </label>
                      <label className="block text-sm font-medium">
                        Year
                        <Input
                          className="mt-1"
                          type="number"
                          {...paymentForm.register("year", { valueAsNumber: true })}
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-sm font-medium">
                        Month
                        <select
                          className="mt-1 w-full h-10 border rounded-md px-3 text-sm"
                          {...paymentForm.register("month")}
                        >
                          {[
                            "January",
                            "February",
                            "March",
                            "April",
                            "May",
                            "June",
                            "July",
                            "August",
                            "September",
                            "October",
                            "November",
                            "December",
                          ].map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium">
                        Receipt No
                        <Input className="mt-1" {...paymentForm.register("receiptNo")} />
                      </label>
                    </div>

                    <label className="block text-sm font-medium">
                      Remarks (Payment Mode / Notes)
                      <Input
                        className="mt-1"
                        placeholder="e.g., Cash / UPI / Cheque"
                        {...paymentForm.register("remarks")}
                      />
                    </label>

                    <Button disabled={collect.isPending}>
                      {collect.isPending ? "Processing..." : "Collect Payment & Generate Receipt"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Payment History & Printable Receipts</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.isLoading ? (
                  <p>Loading payments...</p>
                ) : payments.data?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Month/Year</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.data.map((p) => {
                        const st = studentById.get(p.studentId);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono font-semibold">{p.receiptNo}</TableCell>
                            <TableCell>
                              {st ? `${st.name} (${st.class}-${st.section})` : `#${p.studentId}`}
                            </TableCell>
                            <TableCell className="font-semibold">
                              ₹{p.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {p.month || "—"}/{p.year}
                            </TableCell>
                            <TableCell>{new Date(p.paymentDate).toLocaleDateString()}</TableCell>
                            <TableCell>{p.remarks || "—"}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedReceipt(p)}
                              >
                                <Printer className="h-3.5 w-3.5 mr-1" /> Receipt
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-500">No payments in the active session.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {!isStudent && (
            <TabsContent value="defaulters">
              <Card>
                <CardHeader>
                  <CardTitle>Defaulters for {month}</CardTitle>
                </CardHeader>
                <CardContent>
                  {defaulters.isLoading ? (
                    <p>Loading defaulters...</p>
                  ) : defaulters.data?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Outstanding</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {defaulters.data.map((d) => (
                          <TableRow key={d.studentId}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>
                              {d.class}-{d.section}
                            </TableCell>
                            <TableCell>₹{d.amountPaid}</TableCell>
                            <TableCell className="text-red-600 font-bold">
                              ₹{d.amountPending}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-slate-500">No students with outstanding monthly fees.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="dues" className="space-y-6">
            {canManageDues && (
              <Card>
                <CardHeader>
                  <CardTitle>Record New Student Due / Fine / Obligation</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-5">
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={dueStudentId}
                    onChange={(e) => setDueStudentId(e.target.value)}
                  >
                    <option value="">Select Student...</option>
                    {(students.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.class}-{s.section})
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Description (e.g., Lab Fee / Book Due)"
                    value={dueDescription}
                    onChange={(e) => setDueDescription(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount (₹)"
                    value={dueAmount}
                    onChange={(e) => setDueAmount(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  <Button
                    onClick={() => createDue.mutate()}
                    disabled={
                      createDue.isPending ||
                      !dueStudentId ||
                      !dueDescription.trim() ||
                      Number(dueAmount) <= 0
                    }
                  >
                    Add Due
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Student Dues Register</CardTitle>
              </CardHeader>
              <CardContent>
                {dues.isLoading ? (
                  <p>Loading dues...</p>
                ) : dues.data?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        {canManageDues && <TableHead>Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dues.data.map((d) => {
                        const st = studentById.get(d.studentId);
                        return (
                          <TableRow key={d.id}>
                            <TableCell>
                              {st ? `${st.name} (${st.class}-${st.section})` : `#${d.studentId}`}
                            </TableCell>
                            <TableCell>{d.description}</TableCell>
                            <TableCell className="font-semibold">₹{d.amount}</TableCell>
                            <TableCell>{d.dueDate || "—"}</TableCell>
                            <TableCell className="capitalize">{d.status}</TableCell>
                            {canManageDues && (
                              <TableCell className="flex gap-2">
                                {d.status === "open" && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        dueStatus.mutate({ id: d.id, status: "settled" })
                                      }
                                    >
                                      Mark Settled
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => dueStatus.mutate({ id: d.id, status: "void" })}
                                    >
                                      Void
                                    </Button>
                                  </>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-500">No dues recorded for the active session.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transport">
            <Card>
              <CardHeader>
                <CardTitle>Transport / Bus Charges</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500 mb-4">
                  Active bus routes and their monthly charges. Student route assignment is managed from the Students directory and Transport module.
                </p>
                {transportRoutes.isLoading ? (
                  <p>Loading transport routes...</p>
                ) : transportRoutes.data?.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Monthly Charge</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transportRoutes.data.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-medium">{route.routeName}</TableCell>
                          <TableCell>₹{route.amount.toLocaleString()}</TableCell>
                          <TableCell>{route.isActive ? "Active" : "Inactive"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-500">No active transport routes configured.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {canCollect && (
            <TabsContent value="structure">
              <Card>
                <CardHeader>
                  <CardTitle>Fee Structures</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 items-end"
                    onSubmit={structureForm.handleSubmit(submitStructure)}
                  >
                    {(
                      ["class", "monthlyFee", "admissionFee", "examFee", "otherFee"] as const
                    ).map((field) => (
                      <label key={field} className="text-sm font-medium capitalize">
                        {field}
                        <Input
                          className="mt-1"
                          type={field === "class" ? "text" : "number"}
                          {...structureForm.register(field, {
                            valueAsNumber: field !== "class",
                          })}
                        />
                      </label>
                    ))}
                    <div className="flex gap-2">
                      <Button type="submit">{editingStructure ? "Save" : "Add"}</Button>
                      {editingStructure && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditingStructure(null);
                            structureForm.reset();
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                  {structures.isLoading ? (
                    <p>Loading structures...</p>
                  ) : structures.data?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Class</TableHead>
                          <TableHead>Monthly</TableHead>
                          <TableHead>Admission</TableHead>
                          <TableHead>Exam</TableHead>
                          <TableHead>Other</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {structures.data.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell>Class {s.class}</TableCell>
                            <TableCell>₹{s.monthlyFee}</TableCell>
                            <TableCell>₹{s.admissionFee}</TableCell>
                            <TableCell>₹{s.examFee}</TableCell>
                            <TableCell>₹{s.otherFee}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingStructure(s.id);
                                  structureForm.reset({
                                    class: s.class,
                                    monthlyFee: s.monthlyFee,
                                    admissionFee: s.admissionFee,
                                    examFee: s.examFee,
                                    otherFee: s.otherFee,
                                  });
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deleteStructure.isPending}
                                onClick={() => {
                                  if (window.confirm("Delete this unused fee structure?"))
                                    deleteStructure.mutate(s.id, {
                                      onError: (error) =>
                                        toast({
                                          variant: "destructive",
                                          title: "Cannot delete structure",
                                          description: error.message,
                                        }),
                                    });
                                }}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-slate-500">No fee structures in the active session.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
