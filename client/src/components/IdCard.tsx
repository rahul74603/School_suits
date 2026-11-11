import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { apiGet } from "@/lib/api";

// 🪪 ID Card (v1.7) — dead component ko zinda kiya gaya.
// Asal design ~/workspace ke purane exec copy ke
// client/src/components/StudentIdCard.tsx se liya hai (gradient header,
// gol photo, details ki list, neeche footer band) — ye humari apni repo
// ka purana code hai. Lekin ye naya component maujooda pattern par
// dobara likha hai, aur dead wali teen khamiyan theek hain:
//  1. Dead footer me "Valid for 2024-25" HARDCODE tha — yahan session
//     school ki asal setting (school.session) se aata hai; session na
//     ho to validity line dikhti hi nahi. Hardcode bilkul nahi.
//  2. Dead photo hamesha 🎓 emoji tha — yahan asal photo aati hai
//     (neeche resolveStudentPhotoUrl dekho); photo na ho to bacche ke
//     naam ke initials wala placeholder.
//  3. Dead print CSS me ajeeb rotate hack tha — yahan print
//     ReportCards wala pakka pattern hai (naya window, standalone
//     HTML+CSS, auto print), card seedha portrait chhapta hai.
//
// Photo asal me kahan hai (saboot ke saath): students table me `photo`
// column hai, lekin client use KABHI nahi bharta — asal photo hamesha
// Documents se aati hai (docType "photo", Student Profile wahi dikhata
// hai: GET /api/students/:id/documents + .../:docId/file → base64).
// Isliye pehle documents wala rasta, aur student.photo me data:/http
// URL ho to use seedha (purani/dusri entry ka samman).

export interface IdCardStudent {
  id?: number;
  name: string;
  class: string;
  section: string;
  admissionNo: string;
  fatherName: string;
  contact: string;
  rollNo?: string | null;
  dob?: string | null;
  // students.photo column (aaj client se khaali rehta hai, par ho to
  // data:/http URL ke roop me samman milega).
  photo?: string | null;
}

export interface IdCardSchool {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  session?: string | null;
  primaryColor?: string | null;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "2026-11-11" → "11 Nov 2026". Galat/khaali par asal string wapas.
export function formatDobText(dob?: string | null): string {
  if (!dob) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!match) return dob;
  const month = MONTHS_SHORT[parseInt(match[2], 10) - 1];
  if (!month) return dob;
  return `${parseInt(match[3], 10)} ${month} ${match[1]}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function isUrlLike(value?: string | null): boolean {
  return (
    !!value &&
    (value.startsWith("data:") ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("blob:"))
  );
}

// Student ki asal photo ka URL (data URL) — na mile to null (caller
// initials dikhayega). Kabhi throw nahi karta: photo na milna ID card
// rokne ki wajah nahi hai.
export async function resolveStudentPhotoUrl(
  student: IdCardStudent,
): Promise<string | null> {
  if (isUrlLike(student.photo)) return student.photo as string;
  if (!student.id) return null;
  try {
    const docs = await apiGet<any[]>(
      `/api/students/${student.id}/documents`,
    );
    const photoDoc = (docs || []).find(
      (d: any) => d.docType === "photo" && d.hasFile,
    );
    if (!photoDoc) return null;
    const file = await apiGet<any>(
      `/api/students/${student.id}/documents/${photoDoc.id}/file`,
    );
    if (!file?.base64Data) return null;
    return `data:${file.mimeType || "image/jpeg"};base64,${file.base64Data}`;
  } catch {
    return null;
  }
}

function headerColor(school: IdCardSchool): string {
  const c = school.primaryColor;
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#1d4ed8";
}

export function IdCard({
  student,
  school,
  photoUrl,
}: {
  student: IdCardStudent;
  school: IdCardSchool;
  photoUrl?: string | null;
}) {
  const color = headerColor(school);
  return (
    <div className="w-[340px] max-w-full mx-auto bg-white border border-gray-300 rounded-xl overflow-hidden shadow-lg relative">
      {/* Header — school branding (naam/logo/address asal API data se) */}
      <div
        className="px-4 pt-4 pb-14 text-center text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, #1e3a8a)`,
        }}
      >
        {isUrlLike(school.logo) ? (
          <img
            src={school.logo as string}
            alt=""
            className="h-10 w-10 mx-auto mb-1 rounded-full bg-white object-contain"
          />
        ) : (
          <div className="text-2xl leading-none mb-1">🎓</div>
        )}
        <h2 className="text-base font-bold uppercase tracking-wide leading-tight">
          {school.name}
        </h2>
        {school.address ? (
          <p className="text-[11px] opacity-90 mt-0.5">{school.address}</p>
        ) : null}
        <p className="text-[10px] uppercase tracking-[0.2em] mt-1 opacity-80">
          Student ID Card
        </p>
      </div>

      {/* Photo — asal photo, na ho to initials */}
      <div className="flex flex-col items-center px-5 pb-4 -mt-10">
        <div className="w-24 h-24 bg-white rounded-full p-1 shadow-xl">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={student.name}
              className="w-full h-full rounded-full object-cover border-2 border-white"
            />
          ) : (
            <div className="w-full h-full bg-blue-50 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-3xl font-bold text-blue-700">
                {initialsOf(student.name)}
              </span>
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-slate-800 mt-3 text-center leading-tight">
          {student.name}
        </h3>
        <span className="inline-block px-3 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-full text-xs mt-1">
          Class {student.class} - {student.section}
        </span>

        <div className="w-full space-y-2 text-sm mt-4">
          {student.rollNo ? (
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Roll No</span>
              <span className="font-semibold text-slate-800 text-right">
                {student.rollNo}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Admission No</span>
            <span className="font-semibold text-slate-800 text-right">
              {student.admissionNo}
            </span>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
            <span className="text-slate-500">Father&apos;s Name</span>
            <span className="font-semibold text-slate-800 text-right">
              {student.fatherName}
            </span>
          </div>
          {student.dob ? (
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">DOB</span>
              <span className="font-semibold text-slate-800 text-right">
                {formatDobText(student.dob)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Contact</span>
            <span className="font-semibold text-slate-800 text-right">
              {student.contact}
            </span>
          </div>
        </div>
      </div>

      {/* Footer — session SCHOOL KI SETTING se; na ho to sirf school naam */}
      <div className="bg-slate-900 px-4 py-2.5 text-center">
        <p className="text-white/85 text-[11px] font-mono tracking-widest uppercase">
          {school.session ? `Valid for Session ${school.session}` : school.name}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print — ReportCards.handlePrint wala hi pattern: naya window,
// standalone HTML, window.onload par print + close. Photo data URL
// hoti hai isliye print window me bhi chalti hai (blob URL wahan
// zinda nahi rehta — isiliye resolveStudentPhotoUrl data URL deta hai).
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printIdCard({
  student,
  school,
  photoUrl,
}: {
  student: IdCardStudent;
  school: IdCardSchool;
  photoUrl?: string | null;
}) {
  const win = window.open("", "_blank");
  if (!win) return;
  const color = headerColor(school);
  const photoHtml = photoUrl
    ? `<img src="${photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9999px;" />`
    : `<div style="width:100%;height:100%;background:#eff6ff;border-radius:9999px;display:flex;align-items:center;justify-content:center;"><span style="font-size:34px;font-weight:700;color:#1d4ed8;">${escapeHtml(initialsOf(student.name))}</span></div>`;
  const logoHtml = isUrlLike(school.logo)
    ? `<img src="${school.logo as string}" alt="" style="height:38px;width:38px;border-radius:9999px;background:#fff;object-fit:contain;" />`
    : `<div style="font-size:24px;">🎓</div>`;
  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #f1f5f9;padding-bottom:6px;"><span style="color:#64748b;">${escapeHtml(label)}</span><span style="font-weight:600;color:#1e293b;text-align:right;">${escapeHtml(value)}</span></div>`;

  win.document.write(`
    <html>
      <head>
        <title>ID Card - ${escapeHtml(student.name)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div style="width:340px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif;">
          <div style="background:linear-gradient(135deg, ${color}, #1e3a8a);color:#fff;text-align:center;padding:16px 16px 52px;">
            ${logoHtml}
            <div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;line-height:1.25;">${escapeHtml(school.name)}</div>
            ${school.address ? `<div style="font-size:11px;opacity:0.9;margin-top:2px;">${escapeHtml(school.address)}</div>` : ""}
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;opacity:0.85;">Student ID Card</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;padding:0 20px 16px;margin-top:-40px;">
            <div style="width:96px;height:96px;background:#fff;border-radius:9999px;padding:4px;box-shadow:0 6px 16px rgba(0,0,0,0.18);box-sizing:border-box;">${photoHtml}</div>
            <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:10px;text-align:center;line-height:1.2;">${escapeHtml(student.name)}</div>
            <div style="background:#eff6ff;color:#1d4ed8;font-weight:600;border-radius:9999px;font-size:12px;padding:2px 12px;margin-top:4px;">Class ${escapeHtml(student.class)} - ${escapeHtml(student.section)}</div>
            <div style="width:100%;margin-top:14px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
              ${student.rollNo ? row("Roll No", student.rollNo) : ""}
              ${row("Admission No", student.admissionNo)}
              ${row("Father's Name", student.fatherName)}
              ${student.dob ? row("DOB", formatDobText(student.dob)) : ""}
              ${row("Contact", student.contact)}
            </div>
          </div>
          <div style="background:#0f172a;color:rgba(255,255,255,0.85);text-align:center;padding:9px 12px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-family:monospace;">
            ${escapeHtml(school.session ? `Valid for Session ${school.session}` : school.name)}
          </div>
        </div>
        <script>window.onload = () => { window.print(); window.close(); };</script>
      </body>
    </html>
  `);
  win.document.close();
}

// ---------------------------------------------------------------------------
// Dialog wrapper — Students list aur Student Profile dono yahi istemal
// karte hain: khulte hi photo apne aap load hoti hai, Print button
// upar wala printIdCard chalata hai.
// ---------------------------------------------------------------------------

export function IdCardDialog({
  open,
  onOpenChange,
  student,
  school,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: IdCardStudent | null;
  school: IdCardSchool | null;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setPhotoUrl(null);
    setPhotoLoading(true);
    void resolveStudentPhotoUrl(student)
      .then((url) => {
        if (!cancelled) setPhotoUrl(url);
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, student]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap gap-3 justify-between items-center pr-6">
            <span>Student ID Card</span>
            {student && school ? (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => printIdCard({ student, school, photoUrl })}
              >
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        {student && school ? (
          <div className="py-2">
            <IdCard student={student} school={school} photoUrl={photoUrl} />
            {photoLoading ? (
              <p className="text-xs text-gray-400 text-center mt-3">
                Photo aa rahi hai…
              </p>
            ) : !photoUrl ? (
              <p className="text-xs text-gray-400 text-center mt-3">
                Is student ki photo uploaded nahi hai — card par naam ke
                initials dikh rahe hain.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4">
            School ki jaankari nahi mili — ID card nahi ban payega.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
