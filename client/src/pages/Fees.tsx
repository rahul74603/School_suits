import { useState } from "react";
import { useFeeStructures, usePayments, useCollectFee, useDefaulters } from "@/hooks/use-fees";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, IndianRupee, FileWarning, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeePaymentSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";

export default function Fees() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("collect");
  const { data: structures } = useFeeStructures();
  const { data: payments } = usePayments();
  const { data: defaulters } = useDefaulters({ month: format(new Date(), 'MMMM') });
  
  const collectFee = useCollectFee();

  const form = useForm({
    resolver: zodResolver(insertFeePaymentSchema),
    defaultValues: {
      studentId: 0,
      amount: 0,
      month: format(new Date(), 'MMMM'),
      year: new Date().getFullYear(),
      receiptNo: `REC-${Date.now()}`,
      remarks: "",
      schoolId: 1
    }
  });

  const onSubmit = (data: z.infer<typeof insertFeePaymentSchema>) => {
    collectFee.mutate(data, {
      onSuccess: () => {
        toast({
          title: "Payment Recorded",
          description: `Receipt ${data.receiptNo} generated successfully.`,
        });
        form.reset({
          studentId: 0,
          amount: 0,
          month: format(new Date(), 'MMMM'),
          year: new Date().getFullYear(),
          receiptNo: `REC-${Date.now()}`,
          remarks: "",
          schoolId: 1
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record payment. Please try again.",
        });
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Fees Management</h1>
          <p className="text-slate-500 mt-1">Collect fees, manage structures, and track defaulters</p>
        </header>

        <Tabs defaultValue="collect" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="bg-white p-1 rounded-xl border border-border shadow-sm">
            <TabsTrigger value="collect" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Collect Fee</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Payment History</TabsTrigger>
            <TabsTrigger value="defaulters" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Defaulters</TabsTrigger>
            <TabsTrigger value="structure" className="rounded-lg px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Fee Structure</TabsTrigger>
          </TabsList>

          <TabsContent value="collect">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>New Fee Collection</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="studentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Student ID</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter Student ID" 
                                type="number" 
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="month"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Month</FormLabel>
                              <FormControl>
                                <select 
                                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                                  {...field}
                                >
                                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="year"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (₹)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                  className="pl-9 text-lg font-bold" 
                                  type="number" 
                                  {...field}
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Remarks (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Cheque No / UPI ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full py-6 text-lg font-semibold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                        disabled={collectFee.isPending}
                      >
                        {collectFee.isPending ? "Processing..." : "Collect Payment"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Recent Transaction Preview or Student Details could go here */}
              <Card className="bg-blue-50 border-blue-100">
                <CardHeader>
                  <CardTitle className="text-blue-800">Student Info</CardTitle>
                </CardHeader>
                <CardContent className="text-blue-900">
                  <p className="text-sm opacity-70 mb-4">Enter a Student ID to see details and pending dues here.</p>
                  <div className="p-4 bg-white/50 rounded-lg border border-blue-200">
                    <div className="flex items-center text-sm font-medium mb-2">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                      No pending dues found
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="defaulters">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center text-red-600">
                  <FileWarning className="w-5 h-5 mr-2" />
                  Fee Defaulters - {format(new Date(), 'MMMM')}
                </CardTitle>
                <Button variant="outline" size="sm">Download Report</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Pending Amount</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defaulters?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Great! No defaulters for this month.
                        </TableCell>
                      </TableRow>
                    ) : (
                      defaulters?.map((defaulter: any) => (
                        <TableRow key={defaulter.studentId}>
                          <TableCell className="font-medium">{defaulter.name}</TableCell>
                          <TableCell>Class {defaulter.class}</TableCell>
                          <TableCell className="text-red-600 font-bold">₹{defaulter.amountPending}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                              Send Reminder
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
