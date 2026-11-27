import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { CalendarOff, School, RefreshCw, Check, X } from "lucide-react";

// 🌴 Leaves / Chutti (v3.0) — students aur staff ki chutti.
//  - List: principal/accountant ko poore school ki; teacher/staff
//    ko sirf apni (server waisa hi deta hai). Parent apni chutti
//    Parent App se lagata/dekhta hai.
//  - Faisla (Approve/Reject): sirf principal, sirf pending par —
//    server bhi yahi niyam rakhta hai.
//  - Nayi leave: Students tab me principal/teacher kisi bacche ki;
//    Staff tab me principal kisi staff ki, teacher/staff sirf apni
//    (server pehchan login se karta hai — staffId bhejna hi nahi).
//  - Super Admin: no-school card (har school ki chutti usi school
//    ki hai, mix nahi hoti).

interface LeaveRow {
  id: number;
  kind: string;
  studentId: number | null;
  staffId: number | null;
  studentName: string | null;
  staffName: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string | null;
}

interface StudentLite {
  id: number;
  name: string;
  class: string;
  section: string | null;
}

interface StaffLite {
  id: number;
  name: string;
  designation: string;
}

function todayText(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Approved ✅
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Rejected ❌
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          Pending ⏳
        </Badge>
      );
  }
}

export default function LeavesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isPrincipal = user?.role === "principal";

  const [tab, setTab] = useState<"student" | "staff">("student");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [staffList, setStaffList] = useState<StaffLite[]>([]);
  const [form, setForm] = useState({
    personId: "",
    fromDate: todayText(),
    toDate: todayText(),
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ kind: tab });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const data = await apiGet<LeaveRow[]>(`/api/leaves?${params.toString()}`);
      setRows(data ?? []);
    } catch (error) {
      toast({
        title: "Leaves load nahi ho payin",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  useEffect(() => {
    if (isSuperAdmin) return;
    (async () => {
      try {
        const data = await apiGet<StudentLite[]>("/api/students");
        setStudents(data ?? []);
      } catch {
        setStudents([]);
      }
      if (isPrincipal) {
        try {
          const data = await apiGet<StaffLite[]>("/api/staff");
          setStaffList(data ?? []);
        } catch {
          setStaffList([]);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Har school ki chuttiyan usi school ki hoti hain — Super
              Admin ke paas kisi school ki leave list nahi aati (data
              mix nahi hota). School ka Principal apne login se
              leaves dekhta aur faisla karta hai.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canRecord =
    tab === "student" ? isPrincipal || user?.role === "teacher" : true;

  const submit = async () => {
    if (!form.fromDate || !form.toDate || !form.reason.trim()) {
      toast({
        title: "Adhuri jaankari",
        description: "Tareekh aur karan (reason) lazmi hain.",
        variant: "destructive",
      });
      return;
    }
    if (tab === "student" && !form.personId) {
      toast({
        title: "Baccha chunein",
        description: "Kis bacche ki chutti hai, pehle wo chunein.",
        variant: "destructive",
      });
      return;
    }
    if (tab === "staff" && isPrincipal && !form.personId) {
      toast({
        title: "Staff chunein",
        description: "Kis staff ki chutti hai, pehle wo chunein.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        kind: tab,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason.trim(),
      };
      if (tab === "student") body.studentId = Number(form.personId);
      // Staff tab me principal ke liye staffId; teacher/staff ke
      // liye server pehchan khud karta hai (staffId nahi bhejte).
      if (tab === "staff" && isPrincipal) body.staffId = Number(form.personId);
      await apiPost("/api/leaves", body);
      toast({ title: "✅ Leave lag gayi (Pending)" });
      setForm((prev) => ({ ...prev, personId: "", reason: "" }));
      load();
    } catch (error) {
      toast({
        title: "Leave nahi lag payi",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const decide = async (row: LeaveRow, status: "approved" | "rejected") => {
    try {
      await apiPatch(`/api/leaves/${row.id}/decision`, { status });
      toast({
        title: status === "approved" ? "✅ Leave approved" : "Leave rejected",
      });
      load();
    } catch (error) {
      toast({
        title: "Faisla save nahi ho paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    }
  };

  const renderList = () => (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {loading ? "Load ho raha hai…" : "Is filter me koi leave nahi hai."}
        </p>
      )}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {row.kind === "student"
                  ? (row.studentName ?? "Student")
                  : (row.staffName ?? "Staff")}
              </span>
              {statusBadge(row.status)}
            </div>
            <p className="text-sm">
              {row.fromDate} → {row.toDate}
            </p>
            <p className="text-sm text-muted-foreground">{row.reason}</p>
          </div>
          {isPrincipal && row.status === "pending" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1 bg-green-600 hover:bg-green-700"
                onClick={() => decide(row, "approved")}
              >
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-red-700"
                onClick={() => decide(row, "rejected")}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderForm = () => {
    if (!canRecord) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {tab === "student" ? "Bacche ki leave lagao" : "Staff leave lagao"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tab === "student" && (
            <div className="space-y-1">
              <Label>Baccha</Label>
              <Select
                value={form.personId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, personId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Baccha chunein" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={String(student.id)}>
                      {student.name} — Class {student.class}
                      {student.section ? `-${student.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {tab === "staff" && isPrincipal && (
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select
                value={form.personId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, personId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Staff chunein" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((member) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.name} — {member.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {tab === "staff" && !isPrincipal && (
            <p className="text-sm text-muted-foreground">
              Ye leave aapki apni staff record ke liye lagegi (pehchan
              aapke login se hoti hai).
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kab se (From)</Label>
              <Input
                type="date"
                value={form.fromDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fromDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Kab tak (To)</Label>
              <Input
                type="date"
                value={form.toDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, toDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Karan (Reason)</Label>
            <Textarea
              value={form.reason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reason: e.target.value }))
              }
              rows={2}
              placeholder="Bukhaar hai / ghar me shaadi hai…"
            />
          </div>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Lag raha hai…" : "Leave lagao"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <CalendarOff className="h-7 w-7 text-blue-600" /> Leaves (Chutti)
        </h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Saari</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "student" | "staff")}>
        <TabsList>
          <TabsTrigger value="student">Students</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>
        <TabsContent value="student" className="space-y-4 pt-4">
          {renderForm()}
          {renderList()}
        </TabsContent>
        <TabsContent value="staff" className="space-y-4 pt-4">
          {renderForm()}
          {renderList()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
