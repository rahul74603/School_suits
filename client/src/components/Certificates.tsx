import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { formatDobText, type IdCardSchool } from "./IdCard";

// 📜 Certificates (v1.7) — TC (Transfer Certificate) + Bonafide.
// NICHOD BAAD-ME #13 ka roz-ka roop: session ke ant/daakhile ke samay
// office ko yahi do kagaz roz bante hain.
//  - Saara student data AUTO bharata hai — sirf wahi fields jo asal me
//    hain (students schema: name, fatherName, motherName, class,
//    section, admissionNo, dob, contact). Gender jaisa koi field
//    schema me hai hi NAHI, isliye certificate ki bhasha jaan-bujh kar
//    gender-neutral hai ("S/o-D/o" nahi likha).
//  - School header asal branding se: naam/logo/address/phone/email
//    aur session — school.session se, hardcode bilkul nahi (session
//    na ho to session wali line hi nahi aati).
//  - Print se pehle chhote editable fields: TC → leaving date
//    (default aaj), reason, conduct line; Bonafide → purpose line.
//  - Print par SIRF certificate: ReportCards wala pattern — print
//    window me sirf certificate ka HTML + uski apni CSS jati hai,
//    dialog ke buttons/inputs kabhi print nahi hote.

export type CertificateType = "tc" | "bonafide";

export interface CertificateStudent {
  name: string;
  fatherName: string;
  motherName?: string | null;
  class: string;
  section: string;
  admissionNo: string;
  dob?: string | null;
  contact?: string | null;
}

export type CertificateSchool = IdCardSchool;

function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
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

// Certificate ki apni CSS — screen preview (dialog ke andar <style>)
// aur print window dono yahi istemal karte hain, isliye jo dikhta hai
// wahi chhapta hai.
const CERT_CSS = `
  .cert { border: 3px double #333; padding: 28px 30px; max-width: 760px; margin: 0 auto; background: #fff; font-family: Georgia, 'Times New Roman', serif; color: #111; }
  .cert-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 14px; }
  .cert-school { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.03em; }
  .cert-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.5; }
  .cert-title { font-size: 17px; font-weight: bold; text-align: center; margin: 12px 0 16px; background: #f3f4f6; padding: 7px; letter-spacing: 0.06em; text-transform: uppercase; }
  .cert-body { font-size: 14px; line-height: 1.85; text-align: justify; }
  .cert-body b { color: #111; }
  .cert-fields { width: 100%; border-collapse: collapse; margin: 16px 0 4px; font-size: 13.5px; }
  .cert-fields td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .cert-fields td.k { font-weight: bold; width: 190px; color: #374151; }
  .cert-issue { font-size: 12.5px; color: #555; margin-top: 14px; }
  .cert-signs { display: flex; justify-content: space-between; margin-top: 46px; }
  .cert-sign { text-align: center; width: 180px; font-size: 12.5px; }
  .cert-sign-line { border-top: 1px solid #333; margin-top: 42px; padding-top: 5px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
`;

export function CertificateDialog({
  open,
  onOpenChange,
  initialType,
  student,
  school,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: CertificateType;
  student: CertificateStudent | null;
  school: CertificateSchool | null;
}) {
  const [type, setType] = useState<CertificateType>(initialType);
  // TC ke editable fields
  const [leavingDate, setLeavingDate] = useState<string>(todayIso());
  const [reason, setReason] = useState<string>("");
  const [conduct, setConduct] = useState<string>(
    "Good. The student's conduct and character during the period of study in this school was satisfactory.",
  );
  // Bonafide ka editable field
  const [purpose, setPurpose] = useState<string>("");
  const certRef = useRef<HTMLDivElement>(null);

  // Dialog khulte hi type + defaults taaze — purane student ke bhare
  // hue fields naye certificate me na ghus jayein.
  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setLeavingDate(todayIso());
    setReason("");
    setConduct(
      "Good. The student's conduct and character during the period of study in this school was satisfactory.",
    );
    setPurpose("");
  }, [open, initialType, student]);

  if (!student || !school) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle>Certificate</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 py-2">
            Student ya school ki jaankari nahi mili — certificate nahi
            ban payega.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const issueDateText = formatDobText(todayIso());
  const leavingDateText = formatDobText(leavingDate);

  const handlePrint = () => {
    if (!certRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>${type === "tc" ? "Transfer Certificate" : "Bonafide Certificate"} - ${student.name}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { margin: 0; padding: 10px; }
            ${CERT_CSS}
          </style>
        </head>
        <body>
          ${certRef.current.innerHTML}
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap gap-3 justify-between items-center pr-6">
            <span>
              {type === "tc" ? "Transfer Certificate (TC)" : "Bonafide Certificate"}
            </span>
            <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4 mr-2" /> Print Certificate
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Kaunsa certificate — print nahi hota (sirf dialog ka hissa) */}
        <div className="flex flex-wrap gap-2 no-print">
          <Button
            type="button"
            size="sm"
            variant={type === "tc" ? "default" : "outline"}
            className={type === "tc" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("tc")}
          >
            Transfer Certificate
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "bonafide" ? "default" : "outline"}
            className={type === "bonafide" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("bonafide")}
          >
            Bonafide
          </Button>
        </div>

        {/* Print se pehle ke editable fields — ye bhi print nahi hote */}
        {type === "tc" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 sm:grid-cols-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Leaving Date</Label>
              <Input
                type="date"
                value={leavingDate}
                onChange={(e) => setLeavingDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <Label>Reason for Leaving</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Parent's transfer / Family shifting"
                className="w-full"
              />
            </div>
            <div className="space-y-1 min-w-0 sm:col-span-1">
              <Label>Conduct / Character</Label>
              <Input
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Purpose (certificate kis kaam ke liye hai)</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. opening a bank account / scholarship application"
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Asal certificate — print me sirf yahi jata hai */}
        <style>{CERT_CSS}</style>
        <div ref={certRef} className="bg-white">
          <div className="cert">
            <div className="cert-header">
              {isUrlLike(school.logo) ? (
                <img
                  src={school.logo as string}
                  alt=""
                  style={{ height: 44, width: 44, objectFit: "contain", margin: "0 auto 4px" }}
                />
              ) : (
                <div style={{ fontSize: 26 }}>🎓</div>
              )}
              <div className="cert-school">{school.name}</div>
              <div className="cert-meta">
                {school.address ? <>{school.address}<br /></> : null}
                {school.phone ? <>Phone: {school.phone}</> : null}
                {school.phone && school.email ? <> | </> : null}
                {school.email ? <>Email: {school.email}</> : null}
                {school.session ? (
                  <><br />Academic Session: {school.session}</>
                ) : null}
              </div>
            </div>

            <div className="cert-title">
              {type === "tc" ? "Transfer Certificate" : "Bonafide Certificate"}
            </div>

            {type === "tc" ? (
              <>
                <p className="cert-body">
                  This is to certify that <b>{student.name}</b>, whose
                  father&apos;s name is <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , was a bona fide student of this school and last
                  studied in <b>Class {student.class} - {student.section}</b>
                  {school.session ? (
                    <> during the academic session <b>{school.session}</b></>
                  ) : null}{" "}
                  and has left the school on <b>{leavingDateText}</b>.
                </p>
                <table className="cert-fields">
                  <tbody>
                    <tr>
                      <td className="k">Admission No.</td>
                      <td>{student.admissionNo}</td>
                    </tr>
                    <tr>
                      <td className="k">Date of Birth</td>
                      <td>{student.dob ? formatDobText(student.dob) : "—"}</td>
                    </tr>
                    <tr>
                      <td className="k">Date of Leaving</td>
                      <td>{leavingDateText}</td>
                    </tr>
                    <tr>
                      <td className="k">Reason for Leaving</td>
                      <td>{reason.trim() || "—"}</td>
                    </tr>
                    <tr>
                      <td className="k">Conduct &amp; Character</td>
                      <td>{conduct.trim() || "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <p className="cert-body">
                  This is to certify that <b>{student.name}</b>, whose
                  father&apos;s name is <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , is a bona fide student of this school, presently
                  studying in <b>Class {student.class} - {student.section}</b>
                  {school.session ? (
                    <> during the academic session <b>{school.session}</b></>
                  ) : null}
                  .
                </p>
                <table className="cert-fields">
                  <tbody>
                    <tr>
                      <td className="k">Admission No.</td>
                      <td>{student.admissionNo}</td>
                    </tr>
                    <tr>
                      <td className="k">Date of Birth</td>
                      <td>{student.dob ? formatDobText(student.dob) : "—"}</td>
                    </tr>
                    {student.contact ? (
                      <tr>
                        <td className="k">Contact</td>
                        <td>{student.contact}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <p className="cert-body" style={{ marginTop: 12 }}>
                  This certificate is issued
                  {purpose.trim() ? (
                    <> for the purpose of <b>{purpose.trim()}</b></>
                  ) : (
                    <> for official purposes</>
                  )}{" "}
                  on the request of the student/parent.
                </p>
              </>
            )}

            <p className="cert-issue">Issued on: {issueDateText}</p>

            <div className="cert-signs">
              <div className="cert-sign">
                <div className="cert-sign-line">Class Teacher</div>
              </div>
              <div className="cert-sign">
                <div className="cert-sign-line">Principal (Seal &amp; Signature)</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
