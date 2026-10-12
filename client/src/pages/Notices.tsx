import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Pin, Trash2 } from "lucide-react";
import type { Notice } from "@shared/schema";

const categories = ["general", "academic", "exam", "holiday", "event", "emergency"] as const;
const audiences = ["all", "students", "teachers", "staff", "class"] as const;

export default function Notices() {
  const { data: user } = useAuth();
  const qc = useQueryClient();
  const canPost = ["admin", "principal", "teacher"].includes(user?.role ?? "");
  const isManager = ["admin", "principal"].includes(user?.role ?? "");
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [targetAudience, setTargetAudience] = useState<string>("all");
  const [targetClass, setTargetClass] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [publishDate, setPublishDate] = useState(today);
  const [filterCategory, setFilterCategory] = useState("all");
  const [message, setMessage] = useState("");

  const notices = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
    queryFn: async () => (await fetch("/api/notices", { credentials: "include" })).json(),
    enabled: !!user,
  });

  const createNotice = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/notices", {
        title,
        content,
        category,
        targetAudience,
        targetClass: targetAudience === "class" ? targetClass || null : null,
        targetSection: targetAudience === "class" ? targetSection || null : null,
        isPinned,
        publishDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notices"] });
      setTitle("");
      setContent("");
      setIsPinned(false);
      setMessage("Notice published successfully.");
    },
  });

  const togglePin = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      apiRequest("PATCH", `/api/notices/${id}`, { isPinned: pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notices"] }),
  });

  const removeNotice = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notices"] }),
  });

  const visibleNotices = (notices.data ?? []).filter(
    (n) => filterCategory === "all" || n.category === filterCategory,
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Notice Board & Circulars</h1>
            <p className="text-slate-500 mt-1">
              Official school announcements, holiday circulars, exam alerts, and class notices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Filter:</span>
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {canPost && (
          <Card>
            <CardHeader>
              <CardTitle>Publish New Notice / Circular</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  className="md:col-span-2"
                  placeholder="Notice title (e.g., Annual Sports Day / Winter Vacation Circular)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Category: {c.toUpperCase()}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-4 items-center">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                >
                  {audiences.map((a) => (
                    <option key={a} value={a}>
                      Audience: {a.toUpperCase()}
                    </option>
                  ))}
                </select>
                {targetAudience === "class" && (
                  <>
                    <Input
                      placeholder="Target Class (e.g., 10)"
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                    />
                    <Input
                      placeholder="Section (optional, e.g., A)"
                      value={targetSection}
                      onChange={(e) => setTargetSection(e.target.value)}
                    />
                  </>
                )}
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  Pin to top of Notice Board
                </label>
              </div>

              <textarea
                className="w-full min-h-[100px] rounded-md border p-3 text-sm"
                placeholder="Write complete circular or announcement details..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              <Button
                onClick={() => createNotice.mutate()}
                disabled={createNotice.isPending || !title.trim() || !content.trim()}
              >
                {createNotice.isPending ? "Publishing..." : "Publish Circular"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {notices.isLoading ? (
            <Card>
              <CardContent className="p-6 text-slate-500">Loading notices...</CardContent>
            </Card>
          ) : visibleNotices.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                <Bell className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                No active notices or circulars found.
              </CardContent>
            </Card>
          ) : (
            visibleNotices.map((notice) => (
              <Card
                key={notice.id}
                className={notice.isPinned ? "border-indigo-300 bg-indigo-50/30" : ""}
              >
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {notice.isPinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                            <Pin className="h-3 w-3" /> Pinned
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                            notice.category === "emergency"
                              ? "bg-red-100 text-red-800"
                              : notice.category === "holiday"
                                ? "bg-amber-100 text-amber-800"
                                : notice.category === "exam"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {notice.category}
                        </span>
                        <span className="text-xs text-slate-500">
                          Published: {notice.publishDate} · Audience:{" "}
                          <b className="uppercase">{notice.targetAudience}</b>
                          {notice.targetClass
                            ? ` (Class ${notice.targetClass}${notice.targetSection ? `-${notice.targetSection}` : ""})`
                            : ""}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 pt-1">{notice.title}</h3>
                    </div>
                    {isManager && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            togglePin.mutate({ id: notice.id, pinned: !notice.isPinned })
                          }
                        >
                          <Pin className="h-3.5 w-3.5 mr-1" />
                          {notice.isPinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeNotice.mutate(notice.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                    {notice.content}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
