import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiDel, apiGet, apiPost } from "@/lib/api";
import { Link2, Plus, Trash2, UserCheck } from "lucide-react";

// 🔗 Teacher Login Link + Class Assignments (v3.3) — Staff View
// dialog ke andar ka hissa. Do kaam:
//  1. Staff record ko kisi teacher LOGIN (user account) se jodna —
//     iske baad teacher ki chutti (leave) jaisi suvidhao me pehchan
//     contact-number ke andaze se nahi, pakke link se hogi.
//     API: POST /api/staff/:id/link-user { userId }
//     Login ki list: GET /api/users (principal ko apne school ke
//     accounts milte hain) — sirf teacher/staff/accountant roles.
//  2. Class/Section/Subject ki zimmedari (assignments) — teacher
//     konsi class ko kya padhata hai + class-teacher hai ya nahi.
//     API: GET/POST /api/teacher-assignments, DELETE /api/teacher-assignments/:id
// ⚠️ Merge fix (v3.3): server par assignment LOGIN USER (userId)
// se judta hai, staff record se nahi — isliye list poori aati hai
// aur yahan jude hue login (currentLinkedId) se chhaanti hai;
// naya assignment bhi usi userId par banta hai. Login na juda ho
// to assignment nahi ban sakta (pehle upar se login jodo).

const CLASSES = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11", "12",
];
const SECTIONS = ["A", "B", "C", "D", "E"];

interface AssignmentRow {
  id: number;
  userId: number | null;
  classText: string;
  section: string;
  subject: string;
  isClassTeacher: boolean;
}

function adaptAssignment(a: any): AssignmentRow {
  return {
    id: a?.id,
    userId: a?.userId ?? null,
    classText: a?.class ?? a?.className ?? "",
    section: a?.section ?? "",
    subject: a?.subject ?? "",
    isClassTeacher: !!(a?.isClassTeacher ?? a?.classTeacher),
  };
}

export default function StaffAssignments({
  staffId,
  staffName,
  linkedUserId,
}: {
  staffId: number;
  staffName: string;
  linkedUserId?: number | null;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    linkedUserId != null ? String(linkedUserId) : "",
  );
  const [currentLinkedId, setCurrentLinkedId] = useState<number | null>(
    linkedUserId ?? null,
  );
  const [linking, setLinking] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [form, setForm] = useState({
    className: "",
    section: "A",
    subject: "",
    isClassTeacher: false,
  });
  const [adding, setAdding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingList(true);
    try {
      // Server staffId filter nahi karta — poori list aati hai,
      // jude hue login ki chhaant render par hoti hai (neeche).
      const list = await apiGet<any[]>("/api/teacher-assignments");
      setAssignments((list || []).map(adaptAssignment));
    } catch {
      setAssignments([]);
    }
    setLoadingList(false);
    try {
      const all = await apiGet<any[]>("/api/users");
      setUsers(
        (all || []).filter((u: any) =>
          ["teacher", "staff", "accountant"].includes(u.role),
        ),
      );
    } catch {
      setUsers([]);
    }
  }, [staffId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (linkedUserId != null) {
      setCurrentLinkedId(linkedUserId);
      setSelectedUserId(String(linkedUserId));
    }
  }, [linkedUserId]);

  const linkedUser = users.find((u) => u.id === currentLinkedId);

  // Is staff ke jude LOGIN ke assignments hi iske hain (server
  // userId par rakhta hai) — baaki teachers ke yahan nahi dikhenge.
  const myAssignments =
    currentLinkedId == null
      ? []
      : assignments.filter((a) => a.userId === currentLinkedId);

  const doLink = async () => {
    if (!selectedUserId) return;
    setLinking(true);
    try {
      await apiPost(`/api/staff/${staffId}/link-user`, {
        userId: parseInt(selectedUserId),
      });
      setCurrentLinkedId(parseInt(selectedUserId));
      toast({
        title: "✅ Login jud gaya",
        description: `${staffName} ab is login se juda hai — chutti jaisi suvidhaon me pehchan pakki hogi.`,
      });
      await loadAll();
    } catch (e: any) {
      toast({
        title: "Link nahi ho paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setLinking(false);
  };

  const addAssignment = async () => {
    if (currentLinkedId == null) {
      toast({
        title: "Pehle login jodo",
        description:
          "Assignment teacher ke LOGIN par lagta hai — pehle upar wale hisse se is staff ko ek teacher login se jodein.",
        variant: "destructive",
      });
      return;
    }
    if (!form.className || !form.subject.trim()) {
      toast({
        title: "Class aur Subject lazmi hain",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      await apiPost("/api/teacher-assignments", {
        userId: currentLinkedId,
        className: form.className,
        section: form.section || undefined,
        subject: form.subject.trim(),
        isClassTeacher: form.isClassTeacher,
      });
      toast({ title: "✅ Assignment jud gaya" });
      setForm({ className: "", section: "A", subject: "", isClassTeacher: false });
      await loadAll();
    } catch (e: any) {
      toast({
        title: "Assignment nahi jud paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
    setAdding(false);
  };

  const removeAssignment = async (row: AssignmentRow) => {
    try {
      await apiDel(`/api/teacher-assignments/${row.id}`);
      toast({ title: "Assignment hata diya gaya" });
      await loadAll();
    } catch (e: any) {
      toast({
        title: "Nahi hat paya",
        description: e?.message || "Dobara koshish karein.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-t pt-4 space-y-5">
      <h4 className="font-bold flex items-center gap-2">
        <Link2 className="h-4 w-4" /> Login &amp; Class Assignments
      </h4>

      {/* 1) Login se jodo */}
      <div className="bg-slate-50 rounded-lg p-3 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-blue-600" /> Teacher Login se
          jodo
        </p>
        {currentLinkedId != null && (
          <p className="text-sm text-green-700">
            ✅ Abhi juda hua login:{" "}
            <b>
              {linkedUser
                ? `${linkedUser.name || linkedUser.username} (${linkedUser.username})`
                : `User #${currentLinkedId}`}
            </b>
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0 space-y-1">
            <Label className="text-xs">Login chunein (teacher accounts)</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Login chunein…" />
              </SelectTrigger>
              <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200 max-h-[220px]">
                {users.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Koi teacher login nahi mila — pehle Schools/Users se
                    teacher ka account banao.
                  </div>
                ) : (
                  users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.username} — {u.username} ({u.role})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => void doLink()}
            disabled={!selectedUserId || linking}
            className="bg-blue-600 hover:bg-blue-700 shrink-0 min-h-[40px]"
          >
            {linking ? "Jud raha hai…" : "Login Jodo"}
          </Button>
        </div>
        <p className="text-[11px] text-gray-400">
          Ek staff record ek hi login se judega. Judne ke baad teacher
          apne login se chutti ki arzi de sakega — pehchan number
          milane ke andaze se nahi hogi.
        </p>
      </div>

      {/* 2) Assignments */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Class / Subject ki zimmedari</p>
        {currentLinkedId == null && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Assignment teacher ke login par lagta hai — pehle upar
            wale hisse se is staff ko ek teacher login se jodein, fir
            zimmedari dein.
          </p>
        )}
        {loadingList ? (
          <p className="text-sm text-gray-500">Load ho raha hai…</p>
        ) : myAssignments.length === 0 ? (
          <p className="text-sm text-gray-500">
            Abhi koi assignment nahi hai — neeche se pehla jodein.
          </p>
        ) : (
          <div className="space-y-2">
            {myAssignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2 bg-white"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-medium text-sm">
                    Class {a.classText}
                    {a.section ? `-${a.section}` : ""}
                  </span>
                  <span className="text-sm text-gray-600 break-words">
                    {a.subject}
                  </span>
                  {a.isClassTeacher && (
                    <Badge className="bg-purple-100 text-purple-800">
                      Class Teacher
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeAssignment(a)}
                  aria-label="Assignment hatao"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Class</Label>
            <Select
              value={form.className}
              onValueChange={(v) => setForm({ ...form, className: v })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Chunein" />
              </SelectTrigger>
              <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200 max-h-[200px]">
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Section</Label>
            <Select
              value={form.section}
              onValueChange={(v) => setForm({ ...form, section: v })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-[9999] shadow-xl border-gray-200">
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className="text-xs">Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g., Maths"
            />
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className="text-xs">Class Teacher?</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={form.isClassTeacher}
                onCheckedChange={(c) => setForm({ ...form, isClassTeacher: c })}
              />
              <span className="text-sm text-gray-600">
                {form.isClassTeacher ? "Haan" : "Nahi"}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => void addAssignment()}
          disabled={adding}
          variant="outline"
          className="min-h-[40px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          {adding ? "Jud raha hai…" : "Assignment Jodo"}
        </Button>
      </div>
    </div>
  );
}
