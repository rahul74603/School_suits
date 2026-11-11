import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiDel, apiGet, apiPost, apiPut, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  BookOpen,
  School,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  BookCheck,
  Undo2,
} from "lucide-react";

// 📚 Library (v1.7, NICHOD #12) — saada kitab catalog + issue/return.
//  - Do hisse: "Kitabein" (catalog + uplabdh ginti) aur "Issued"
//    (kis bacche ke paas kaunsi kitab hai, due date, return).
//  - Prabandh (kitab jodna/badla, issue, return) = principal /
//    accountant / teacher — server par bhi yahi requireRole hai.
//  - Staff sirf dekhta hai. Parent ko sirf apne linked baccho ki
//    issued kitabein dikhti hain (server hi chhanta hai — client par
//    koi alag filter nahi).
//  - Uplabdh ginti server deta hai (availableCopies) — client khud
//    hisaab nahi lagata, issue ki asal jaanch bhi server par hai.
//  - Der se wapas wali (overdue) kitab laal me dikhti hai.
//  - Super Admin ka koi school nahi — Notices wala no-school card.

interface LibraryBook {
  id: number;
  title: string;
  author: string | null;
  copiesTotal: number;
  issuedCopies: number;
  availableCopies: number;
}

interface LibraryIssue {
  id: number;
  bookId: number;
  studentId: number;
  bookTitle: string | null;
  bookAuthor: string | null;
  studentName: string | null;
  studentClass: string | null;
  studentSection: string | null;
  issueDate: string;
  dueDate: string;
  returnedAt: string | null;
}

interface StudentLite {
  id: number;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
}

const MANAGE_ROLES = ["principal", "accountant", "teacher"];

function todayText(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysText(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function isOverdue(issue: LibraryIssue): boolean {
  return issue.returnedAt == null && issue.dueDate < todayText();
}

export default function Library() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isParent = user?.role === "parent";
  const canManage = !!user && MANAGE_ROLES.includes(user.role);

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [issues, setIssues] = useState<LibraryIssue[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [issueFilter, setIssueFilter] = useState<"active" | "all">("active");

  // Kitab add/edit form (edit ho to editingId set hota hai).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookCopies, setBookCopies] = useState("1");
  const [savingBook, setSavingBook] = useState(false);

  // Issue form
  const [issueBookId, setIssueBookId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueDueDate, setIssueDueDate] = useState(() =>
    plusDaysText(todayText(), 14),
  );
  const [issuing, setIssuing] = useState(false);
  const [returningId, setReturningId] = useState<number | null>(null);

  const loadAll = async () => {
    if (isSuperAdmin) return;
    setLoading(true);
    try {
      const issueQuery =
        issueFilter === "active"
          ? "/api/library/issues?status=active"
          : "/api/library/issues";
      if (isParent) {
        // Parent: catalog nahi, sirf apne baccho ki issued kitabein.
        const rows = await apiGet<LibraryIssue[]>(issueQuery);
        setIssues(rows || []);
      } else {
        const [bookRows, issueRows] = await Promise.all([
          apiGet<LibraryBook[]>("/api/library/books"),
          apiGet<LibraryIssue[]>(issueQuery),
        ]);
        setBooks(bookRows || []);
        setIssues(issueRows || []);
        if (canManage) {
          try {
            const studentRows = await apiGet<StudentLite[]>("/api/students");
            setStudents(studentRows || []);
          } catch {
            // Student list na aaye to issue form khaali rahega — baaki
            // page chalti rahegi (imaandar: koi nakli list nahi).
          }
        }
      }
    } catch (e) {
      toast({
        title: "Library load nahi hui",
        description:
          e instanceof ApiError ? e.message : "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueFilter]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students.slice(0, 50);
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.admissionNo || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [students, studentSearch]);

  const resetBookForm = () => {
    setEditingId(null);
    setBookTitle("");
    setBookAuthor("");
    setBookCopies("1");
  };

  const saveBook = async () => {
    const title = bookTitle.trim();
    if (!title) {
      toast({
        title: "Kitab ka naam khaali hai",
        description: "Title likhna lazmi hai.",
        variant: "destructive",
      });
      return;
    }
    const copies = parseInt(bookCopies, 10);
    if (!Number.isFinite(copies) || copies < 0) {
      toast({
        title: "Copies galat hai",
        description: "Kul copies 0 ya zyada ka number ho.",
        variant: "destructive",
      });
      return;
    }
    setSavingBook(true);
    try {
      const body = {
        title,
        author: bookAuthor.trim() ? bookAuthor.trim() : null,
        copiesTotal: copies,
      };
      if (editingId != null) {
        await apiPut(`/api/library/books/${editingId}`, body);
        toast({ title: "Kitab badal gayi" });
      } else {
        await apiPost("/api/library/books", body);
        toast({ title: "Kitab jud gayi" });
      }
      resetBookForm();
      void loadAll();
    } catch (e) {
      toast({
        title: "Kitab save nahi hui",
        description:
          e instanceof ApiError ? e.message : "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setSavingBook(false);
    }
  };

  const startEditBook = (book: LibraryBook) => {
    setEditingId(book.id);
    setBookTitle(book.title);
    setBookAuthor(book.author || "");
    setBookCopies(String(book.copiesTotal));
  };

  const deleteBook = async (book: LibraryBook) => {
    if (
      !window.confirm(
        `"${book.title}" delete karein? Jiska issue record hai wo kitab delete nahi hogi.`,
      )
    ) {
      return;
    }
    try {
      await apiDel(`/api/library/books/${book.id}`);
      toast({ title: "Kitab delete ho gayi" });
      if (editingId === book.id) resetBookForm();
      void loadAll();
    } catch (e) {
      toast({
        title: "Kitab delete nahi hui",
        description:
          e instanceof ApiError ? e.message : "Dobara koshish karein.",
        variant: "destructive",
      });
    }
  };

  const issueBook = async () => {
    if (!issueBookId || !issueStudentId) {
      toast({
        title: "Kitab aur student chunein",
        description: "Issue karne ke liye dono lazmi hain.",
        variant: "destructive",
      });
      return;
    }
    setIssuing(true);
    try {
      await apiPost("/api/library/issues", {
        bookId: parseInt(issueBookId, 10),
        studentId: parseInt(issueStudentId, 10),
        dueDate: issueDueDate || undefined,
      });
      toast({ title: "Kitab issue ho gayi" });
      setIssueBookId("");
      setIssueStudentId("");
      setStudentSearch("");
      void loadAll();
    } catch (e) {
      toast({
        title: "Kitab issue nahi hui",
        description:
          e instanceof ApiError ? e.message : "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setIssuing(false);
    }
  };

  const returnBook = async (issue: LibraryIssue) => {
    setReturningId(issue.id);
    try {
      await apiPost(`/api/library/issues/${issue.id}/return`);
      toast({ title: "Kitab wapas aa gayi" });
      void loadAll();
    } catch (e) {
      toast({
        title: "Return nahi hua",
        description:
          e instanceof ApiError ? e.message : "Dobara koshish karein.",
        variant: "destructive",
      });
    } finally {
      setReturningId(null);
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
              to any school, so there is no library to show here. Each
              school manages its own library from its own accounts.
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
          <BookOpen className="h-7 w-7 text-blue-600 shrink-0" /> Library
        </h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void loadAll()}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* ---------------- Kitabein (catalog) — parent ko nahi ---------------- */}
      {!isParent && (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" /> Kitabein ({books.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManage && (
              <div className="grid grid-cols-1 gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end">
                <div className="space-y-1 min-w-0">
                  <Label>Kitab ka Naam *</Label>
                  <Input
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="e.g. Ganit Class 5"
                    className="w-full bg-white"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label>Lekhak (Author)</Label>
                  <Input
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Lekhak ka naam (optional)"
                    className="w-full bg-white"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <Label>Kul Copies</Label>
                  <Input
                    type="number"
                    min={0}
                    value={bookCopies}
                    onChange={(e) => setBookCopies(e.target.value)}
                    className="w-full bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="min-h-[44px] bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                    onClick={() => void saveBook()}
                    disabled={savingBook}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {editingId != null
                      ? "Badlav Save Karein"
                      : savingBook
                        ? "Jud rahi hai…"
                        : "Kitab Jodein"}
                  </Button>
                  {editingId != null && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={resetBookForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}

            {loading && books.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                Kitabein aa rahi hain…
              </p>
            ) : books.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">
                Abhi library me koi kitab nahi hai.
                {canManage ? " Upar wale form se pehli kitab jodein." : ""}
              </p>
            ) : (
              <div className="space-y-2">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 break-words">
                        {book.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {book.author ? `${book.author} • ` : ""}
                        Kul {book.copiesTotal} • Bahar {book.issuedCopies}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        className={
                          book.availableCopies > 0
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-red-100 text-red-800 hover:bg-red-100"
                        }
                      >
                        Uplabdh: {book.availableCopies}
                      </Badge>
                      {canManage && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => startEditBook(book)}
                            aria-label="Kitab badlein"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => void deleteBook(book)}
                            aria-label="Kitab delete karein"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------- Issue form (sirf prabandh roles) ---------------- */}
      {canManage && (
        <Card className="border-t-4 border-t-green-600">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookCheck className="h-5 w-5" /> Kitab Issue Karein
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 min-w-0">
                <Label>Kitab</Label>
                <Select value={issueBookId} onValueChange={setIssueBookId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kitab chunein" />
                  </SelectTrigger>
                  <SelectContent>
                    {books.map((book) => (
                      <SelectItem
                        key={book.id}
                        value={String(book.id)}
                        disabled={book.availableCopies <= 0}
                      >
                        {book.title} (uplabdh: {book.availableCopies})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 min-w-0">
                <Label>Wapas ki Tareekh (Due Date)</Label>
                <Input
                  type="date"
                  value={issueDueDate}
                  onChange={(e) => setIssueDueDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Student (naam ya admission no. se dhundhein)</Label>
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Student ka naam likhein…"
                className="w-full"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Select value={issueStudentId} onValueChange={setIssueStudentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Student chunein" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — Class {s.class}
                      {s.section ? `-${s.section}` : ""} ({s.admissionNo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="min-h-[44px] w-full bg-green-600 hover:bg-green-700 sm:w-auto"
              onClick={() => void issueBook()}
              disabled={issuing || !issueBookId || !issueStudentId}
            >
              <BookCheck className="h-4 w-4 mr-2" />
              {issuing ? "Issue ho rahi hai…" : "Issue Karein"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---------------- Issued list ---------------- */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookCheck className="h-5 w-5" />
              {isParent ? "Mere Baccho Ki Kitabein" : "Issued Kitabein"} (
              {issues.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={issueFilter === "active" ? "default" : "outline"}
                onClick={() => setIssueFilter("active")}
              >
                Bahar Hai
              </Button>
              <Button
                type="button"
                size="sm"
                variant={issueFilter === "all" ? "default" : "outline"}
                onClick={() => setIssueFilter("all")}
              >
                Saari (History)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && issues.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              List aa rahi hai…
            </p>
          ) : issues.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              {issueFilter === "active"
                ? "Abhi koi kitab bahar nahi hai."
                : "Abhi tak koi kitab issue nahi hui."}
            </p>
          ) : (
            <div className="space-y-2">
              {issues.map((issue) => {
                const overdue = isOverdue(issue);
                const returned = issue.returnedAt != null;
                return (
                  <div
                    key={issue.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 min-w-0 ${
                      overdue
                        ? "border-red-300 bg-red-50"
                        : "bg-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 break-words">
                        {issue.bookTitle || "Kitab"}
                        {issue.bookAuthor ? (
                          <span className="font-normal text-gray-500">
                            {" "}
                            — {issue.bookAuthor}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 break-words">
                        {issue.studentName || "Student"}
                        {issue.studentClass
                          ? ` • Class ${issue.studentClass}${issue.studentSection ? `-${issue.studentSection}` : ""}`
                          : ""}{" "}
                        • Issue: {issue.issueDate} • Due: {issue.dueDate}
                        {returned
                          ? ` • Wapas: ${new Date(issue.returnedAt as string).toLocaleDateString("en-IN")}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {returned ? (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                          Wapas Aa Gayi
                        </Badge>
                      ) : overdue ? (
                        <Badge className="bg-red-600 text-white hover:bg-red-600">
                          Der Ho Gayi (Overdue)
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Bahar Hai
                        </Badge>
                      )}
                      {canManage && !returned && (
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-[36px] bg-blue-600 hover:bg-blue-700"
                          onClick={() => void returnBook(issue)}
                          disabled={returningId === issue.id}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          {returningId === issue.id
                            ? "Ho raha hai…"
                            : "Wapas (Return)"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
