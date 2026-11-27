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
import { useToast } from "@/hooks/use-toast";
import { apiDel, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { BookOpen, School, Trash2, RefreshCw } from "lucide-react";

// 📚 Homework (v3.0) — teacher/principal homework dete hain,
// parents apne Parent App me wahi homework dekhte hain (Parent
// Overview me bacche ki class/section ke hisaab se filter hokar).
//  - Banana: principal + teacher (server requireRole yahi hai).
//  - Mitana: principal koi bhi; teacher sirf apna banaya hua
//    (server dusre ke homework ko 404 deta hai — button yahan bhi
//    wahi niyam dikhata hai).
//  - Super Admin ka koi school nahi — no-school card, koi API call
//    nahi (Notices wala pattern).

interface HomeworkRow {
  id: number;
  className: string;
  section: string | null;
  subject: string;
  title: string;
  description: string | null;
  dueDate: string;
  createdBy: number | null;
  createdAt: string | null;
}

const CLASSES = [
  "Nursery", "LKG", "UKG",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];

function todayText(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function HomeworkPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const canCreate = user?.role === "principal" || user?.role === "teacher";
  const canDeleteAny = user?.role === "principal";

  const [rows, setRows] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [form, setForm] = useState({
    className: "1",
    section: "",
    subject: "",
    title: "",
    description: "",
    dueDate: todayText(),
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const query =
        classFilter && classFilter !== "all"
          ? `?class=${encodeURIComponent(classFilter)}`
          : "";
      const data = await apiGet<HomeworkRow[]>(`/api/homework${query}`);
      setRows(data ?? []);
    } catch (error) {
      toast({
        title: "Homework load nahi ho paya",
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
  }, [classFilter]);

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
              Super Admin ka apna koi school nahi hota — homework har
              school ka apna hota hai aur dusre school ka data yahan
              kabhi nahi dikhta. School ke Principal/Teacher apne login
              se homework dete hain.
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

  const submit = async () => {
    if (!form.subject.trim() || !form.title.trim() || !form.dueDate) {
      toast({
        title: "Adhuri jaankari",
        description: "Subject, title aur due date lazmi hain.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/homework", {
        className: form.className,
        section: form.section.trim() ? form.section.trim() : null,
        subject: form.subject.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate,
      });
      toast({ title: "✅ Homework de diya gaya" });
      setForm((prev) => ({ ...prev, subject: "", title: "", description: "" }));
      load();
    } catch (error) {
      toast({
        title: "Homework save nahi ho paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: HomeworkRow) => {
    try {
      await apiDel(`/api/homework/${row.id}`);
      toast({ title: "Homework hata diya gaya" });
      load();
    } catch (error) {
      toast({
        title: "Homework nahi hat paya",
        description:
          error instanceof Error ? error.message : "Dobara koshish karein",
        variant: "destructive",
      });
    }
  };

  const today = todayText();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <BookOpen className="h-7 w-7 text-blue-600" /> Homework
        </h1>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Naya Homework do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Class</Label>
                <Select
                  value={form.className}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, className: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((cls) => (
                      <SelectItem key={cls} value={cls}>
                        Class {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Section (khaali = poori class)</Label>
                <Input
                  value={form.section}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, section: e.target.value }))
                  }
                  placeholder="A"
                />
              </div>
              <div className="space-y-1">
                <Label>Due Date (kab tak)</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="Maths"
                />
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Chapter 5 ke sawal 1–10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description (chaaho to)</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={2}
                placeholder="Koi khaas hidayat…"
              />
            </div>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Save ho raha hai…" : "Homework do"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Diya hua Homework</CardTitle>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Class filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Saari Classes</SelectItem>
              {CLASSES.map((cls) => (
                <SelectItem key={cls} value={cls}>
                  Class {cls}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Load ho raha hai…"
                : "Abhi koi homework nahi hai."}
            </p>
          )}
          {rows.map((row) => {
            const overdue = row.dueDate < today;
            const mine = row.createdBy != null && row.createdBy === user?.id;
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                      {row.subject}
                    </Badge>
                    <Badge variant="secondary">
                      Class {row.className}
                      {row.section ? `-${row.section}` : ""}
                    </Badge>
                    {overdue && (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium break-words">{row.title}</p>
                  {row.description && (
                    <p className="text-sm text-muted-foreground break-words">
                      {row.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Due: {row.dueDate}
                  </p>
                </div>
                {(canDeleteAny || mine) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(row)}
                    aria-label="Homework hatayein"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
