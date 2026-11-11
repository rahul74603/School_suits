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
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Megaphone, School, Plus, RefreshCw } from "lucide-react";

// 📢 Notices (v1.6) — school ki suchnayein.
// Server API Phase 2 se taiyaar thi (GET/POST /api/notices), sirf
// screen nahi bani thi — isiliye parent/teacher app me notice padh
// hi nahi sakte the. Ye page wahi khaali jagah bharta hai; server me
// koi badlav nahi.
//  - List sab logged-in roles ko, lekin audience filter SERVER par
//    lagta hai: parent ko sirf all+parents wale, teacher ko all+
//    teachers wale, staff ko sirf all wale notices milte hain.
//    Principal/accountant ko (server ke niyam se) teeno dikhte hain.
//  - Banana sirf principal + teacher (POST par requireRole yahi hai).
//  - Super Admin ka koi school nahi (requireSchoolId 400 deta hai) —
//    Dashboard wala no-school card, koi API call nahi.

type NoticeAudience = "all" | "teachers" | "parents";

interface Notice {
  id: number;
  title: string;
  body: string | null;
  audience: string | null;
  createdBy: number | null;
  createdAt: string | null;
}

const AUDIENCE_OPTIONS: Array<{ value: NoticeAudience; label: string }> = [
  { value: "all", label: "Sabke liye (Students, Parents aur Staff)" },
  { value: "parents", label: "Sirf Parents ke liye" },
  { value: "teachers", label: "Sirf Teachers/Staff ke liye" },
];

function audienceBadge(audience: string | null) {
  switch (audience) {
    case "teachers":
      return (
        <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">
          Teachers
        </Badge>
      );
    case "parents":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Parents
        </Badge>
      );
    default:
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Sabke liye
        </Badge>
      );
  }
}

function noticeDateText(createdAt: string | null): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Notices() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const canCreate = user?.role === "principal" || user?.role === "teacher";

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // Naya notice form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("all");
  const [posting, setPosting] = useState(false);

  const loadNotices = async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const rows = await apiGet<Notice[]>("/api/notices");
      const list = (rows || []).slice().sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.id - a.id;
      });
      setNotices(list);
      setLoadedOnce(true);
    } catch (e) {
      toast({
        title: "Notices nahi aaye",
        description: "List load nahi hui — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNotice = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast({
        title: "Title khaali hai",
        description: "Notice ka title likhna lazmi hai.",
        variant: "destructive",
      });
      return;
    }
    setPosting(true);
    try {
      const cleanBody = body.trim();
      await apiPost("/api/notices", {
        title: cleanTitle,
        ...(cleanBody ? { body: cleanBody } : {}),
        audience,
      });
      toast({
        title: "Notice bhej diya gaya",
        description: "Naya notice list me dikh raha hoga.",
      });
      setTitle("");
      setBody("");
      setAudience("all");
      void loadNotices();
    } catch (e) {
      toast({
        title: "Notice nahi bana",
        description: "Kuch galat hua — dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so there are no school notices to show here.
              Each school&apos;s Principal and Teachers post notices from
              their own accounts.
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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 text-slate-800 min-w-0">
          <Megaphone className="h-7 w-7 text-blue-600 shrink-0" /> Notices
        </h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void loadNotices()}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {canCreate && (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" /> Naya Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 min-w-0">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kal school band rahega"
                className="w-full"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Sandesh (Message)</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notice ki poori jaankari yahan likhein…"
                rows={3}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1 min-w-0">
                <Label>Kis ke liye</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => setAudience(v as NoticeAudience)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Audience chunein" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="min-h-[44px] bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                onClick={() => void createNotice()}
                disabled={posting || !title.trim()}
              >
                <Megaphone className="h-4 w-4 mr-2" />
                {posting ? "Bhej raha hai…" : "Notice Bhejein"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          {loading && !loadedOnce ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              Notices aa rahe hain…
            </p>
          ) : notices.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">
              Abhi koi notice nahi hai.
              {canCreate
                ? " Upar wale form se pehla notice bhejein."
                : " Jab school koi suchna bhejega to wo yahan dikhegi."}
            </p>
          ) : (
            <div className="space-y-3">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border bg-white p-4 space-y-2 min-w-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                    <span className="font-semibold text-gray-800 min-w-0 break-words">
                      {n.title}
                    </span>
                    {audienceBadge(n.audience)}
                  </div>
                  {n.body && (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {n.body}
                    </p>
                  )}
                  <div className="text-xs text-gray-400">
                    {noticeDateText(n.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
