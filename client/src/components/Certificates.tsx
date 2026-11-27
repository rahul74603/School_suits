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
import PrintViewer from "./PrintViewer";

// 📜 Certificates (v1.7) — TC (Transfer Certificate) + Bonafide.
// (v2.0, Arena port #4: Character, Migration aur Birth Verification
// templates bhi yahi jud gaye — wahi pattern, wahi print flow.)
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

export type CertificateType =
  | "tc"
  | "bonafide"
  | "character"
  | "migration"
  | "birth"
  | "fee"
  | "provisional"
  | "sports";

// Har type ka poora title — dialog heading, certificate ki title
// strip aur print window ka <title> teeno yahi se lete hain.
// (v3.0: fee/provisional/sports judne se kul 8 templates — Arena
// wali list poori. Fee certificate ka total caller Fees wale
// numbers se bhar kar deta hai — component khud koi rakam andaze
// se nahi banata.)
export const CERT_TITLES: Record<CertificateType, string> = {
  tc: "Transfer Certificate",
  bonafide: "Bonafide Certificate",
  character: "Character Certificate",
  migration: "Migration Certificate",
  birth: "Birth Verification Certificate",
  fee: "Tuition & School Fee Certificate",
  provisional: "Provisional Passing Certificate",
  sports: "Sports & Co-Curricular Merit Certificate",
};

export interface CertificateStudent {
  name: string;
  fatherName: string;
  motherName?: string | null;
  class: string;
  section: string;
  admissionNo: string;
  dob?: string | null;
  contact?: string | null;
  // Fee certificate (80C) ke liye kul jama fee — caller (Students /
  // StudentProfile / Certificates page) payments jod kar deta hai.
  // Na mile to null: certificate par "—" chhapta hai, nakli rakam
  // kabhi nahi.
  feePaidTotal?: number | null;
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
  /* v3.1: phone par certificate preview saaf padhe — padding aur
     label-column chhote. Sirf SCREEN ke liye hai; print window me
     ye niyam lagu hi nahi hote, chhapai bilkul waisi ki waisi. */
  @media screen and (max-width: 640px) {
    .cert { padding: 16px 14px; }
    .cert-school { font-size: 19px; }
    .cert-title { font-size: 14px; }
    .cert-body { font-size: 13.5px; line-height: 1.75; }
    .cert-fields { font-size: 12.5px; }
    .cert-fields td { padding: 5px 4px; }
    .cert-fields td.k { width: 108px; }
    .cert-sign { width: 45%; }
  }
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
  // Character ka editable field (v2.0) — TC wale conduct se alag
  // default, kyunki ye sirf aacharan ka kagaz hai.
  const [characterConduct, setCharacterConduct] = useState<string>(
    "Very Good. The student's conduct, character and behaviour during the period of study in this school were very good.",
  );
  // Migration ka editable field (v2.0) — kis board/institution ki
  // taraf ja raha hai; khaali ho to aam "any other Board" bhasha.
  const [migrationTo, setMigrationTo] = useState<string>("");
  // Birth Verification ka editable field (v2.0) — janm sthan schema
  // me hai hi nahi, isliye sirf yahi haath se bhara jata hai (optional).
  const [birthPlace, setBirthPlace] = useState<string>("");
  // Fee Certificate (v3.0) ka editable field — kis session ki fee.
  const [feeSession, setFeeSession] = useState<string>("");
  // Provisional Passing (v3.0) ka editable field — parinaam ki line.
  const [provisionalResult, setProvisionalResult] = useState<string>(
    "Passed — promoted to the next higher class.",
  );
  // Sports Merit (v3.0) ka editable field — uplabdhi ki line.
  const [sportsAchievement, setSportsAchievement] = useState<string>("");
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
    setCharacterConduct(
      "Very Good. The student's conduct, character and behaviour during the period of study in this school were very good.",
    );
    setMigrationTo("");
    setBirthPlace("");
    setFeeSession(school?.session ?? "");
    setProvisionalResult("Passed — promoted to the next higher class.");
    setSportsAchievement("");
  }, [open, initialType, student, school]);

  if (!student || !school) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white max-w-[calc(100vw-2rem)] sm:max-w-md">
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

  // 🖨 Print (v3.1): pehle ye window.open + document.write se nayi
  // browser window me khulta tha — phone par wo window Chrome me
  // khul jati thi aur band hi nahi hoti thi. Ab certificate app ke
  // andar PrintViewer me khulta hai (Band karo + back button pakka).
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const handlePrint = () => {
    if (!certRef.current) return;
    setPrintHtml(certRef.current.innerHTML);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap gap-3 justify-between items-center pr-6">
            <span>
              {type === "tc" ? "Transfer Certificate (TC)" : CERT_TITLES[type]}
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
          <Button
            type="button"
            size="sm"
            variant={type === "character" ? "default" : "outline"}
            className={type === "character" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("character")}
          >
            Character
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "migration" ? "default" : "outline"}
            className={type === "migration" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("migration")}
          >
            Migration
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "birth" ? "default" : "outline"}
            className={type === "birth" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("birth")}
          >
            Birth Verification
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "fee" ? "default" : "outline"}
            className={type === "fee" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("fee")}
          >
            Fee (80C)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "provisional" ? "default" : "outline"}
            className={type === "provisional" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("provisional")}
          >
            Provisional Passing
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === "sports" ? "default" : "outline"}
            className={type === "sports" ? "bg-blue-600 hover:bg-blue-700" : ""}
            onClick={() => setType("sports")}
          >
            Sports Merit
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
        ) : type === "bonafide" ? (
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
        ) : type === "character" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Conduct / Character</Label>
              <Input
                value={characterConduct}
                onChange={(e) => setCharacterConduct(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        ) : type === "migration" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Migrating To (Board / University / Institution)</Label>
              <Input
                value={migrationTo}
                onChange={(e) => setMigrationTo(e.target.value)}
                placeholder="e.g. CBSE, New Delhi / MP Board, Bhopal"
                className="w-full"
              />
            </div>
          </div>
        ) : type === "fee" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Session (kis saal ki fee ka certificate hai)</Label>
              <Input
                value={feeSession}
                onChange={(e) => setFeeSession(e.target.value)}
                placeholder="e.g. 2026-27"
                className="w-full"
              />
            </div>
          </div>
        ) : type === "provisional" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Result (parinaam ki line)</Label>
              <Input
                value={provisionalResult}
                onChange={(e) => setProvisionalResult(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        ) : type === "sports" ? (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Achievement (uplabdhi — khel/competition, sthan)</Label>
              <Input
                value={sportsAchievement}
                onChange={(e) => setSportsAchievement(e.target.value)}
                placeholder="e.g. 1st Position — Inter-House Cricket Tournament"
                className="w-full"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 min-w-0 gap-3 no-print">
            <div className="space-y-1 min-w-0">
              <Label>Place of Birth (optional — school record me ho to bharein)</Label>
              <Input
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="e.g. Jhansi, Uttar Pradesh"
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

            <div className="cert-title">{CERT_TITLES[type]}</div>

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
            ) : type === "bonafide" ? (
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
            ) : type === "character" ? (
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
                <p className="cert-body" style={{ marginTop: 12 }}>
                  {characterConduct.trim() ||
                    "The student's conduct and character during the period of study in this school were satisfactory."}{" "}
                  To the best of the knowledge of the undersigned, the
                  student bears a good moral character and has not taken
                  part in any activity prejudicial to the interests of
                  the school.
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
                      <td className="k">Class</td>
                      <td>
                        {student.class} - {student.section}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : type === "migration" ? (
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
                  ) : null}
                  .
                </p>
                <p className="cert-body" style={{ marginTop: 12 }}>
                  This school has <b>no objection</b> to the student
                  seeking admission to{" "}
                  <b>
                    {migrationTo.trim() ||
                      "any other Board / University / Institution"}
                  </b>
                  . This certificate is issued on the request of the
                  student/parent for the purpose of migration.
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
                      <td className="k">Class Last Studied</td>
                      <td>
                        {student.class} - {student.section}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : type === "fee" ? (
              <>
                <p className="cert-body">
                  This is to certify that <b>{student.name}</b>, whose
                  father&apos;s name is <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , is a bona fide student of this school, studying in{" "}
                  <b>Class {student.class} - {student.section}</b>
                  {feeSession.trim() || school.session ? (
                    <>
                      {" "}
                      during the academic session{" "}
                      <b>{feeSession.trim() || school.session}</b>
                    </>
                  ) : null}
                  . The tuition and school fees paid by the parent for
                  this student, as per the school records, are as under.
                  This certificate is issued on the request of the
                  parent for the purpose of claiming deduction under{" "}
                  <b>Section 80C of the Income Tax Act, 1961</b>{" "}
                  (tuition fees).
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
                      <td className="k">Class</td>
                      <td>
                        {student.class} - {student.section}
                      </td>
                    </tr>
                    <tr>
                      <td className="k">Session</td>
                      <td>{feeSession.trim() || school.session || "—"}</td>
                    </tr>
                    <tr>
                      <td className="k">Total Fee Paid</td>
                      <td>
                        {student.feePaidTotal != null
                          ? `₹${student.feePaidTotal.toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {student.feePaidTotal == null ? (
                  <p className="cert-body" style={{ marginTop: 12 }}>
                    Note: Fee payment details could not be loaded —
                    please verify the total from the Fees records before
                    issuing this certificate.
                  </p>
                ) : null}
              </>
            ) : type === "provisional" ? (
              <>
                <p className="cert-body">
                  This is to certify that <b>{student.name}</b>, whose
                  father&apos;s name is <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , was a bona fide student of this school and studied
                  in <b>Class {student.class} - {student.section}</b>
                  {school.session ? (
                    <> during the academic session <b>{school.session}</b></>
                  ) : null}{" "}
                  and appeared in the annual examination of the school.
                </p>
                <p className="cert-body" style={{ marginTop: 12 }}>
                  Result:{" "}
                  <b>
                    {provisionalResult.trim() ||
                      "Passed — promoted to the next higher class."}
                  </b>{" "}
                  This provisional certificate is issued on the request
                  of the student/parent, pending the issue of the final
                  marksheet / transfer certificate.
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
                      <td className="k">Class</td>
                      <td>
                        {student.class} - {student.section}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : type === "sports" ? (
              <>
                <p className="cert-body">
                  This is to certify that <b>{student.name}</b>, whose
                  father&apos;s name is <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , is a bona fide student of this school, studying in{" "}
                  <b>Class {student.class} - {student.section}</b>
                  {school.session ? (
                    <> during the academic session <b>{school.session}</b></>
                  ) : null}
                  , and has brought honour to the school through
                  outstanding performance in sports / co-curricular
                  activities.
                </p>
                <table className="cert-fields">
                  <tbody>
                    <tr>
                      <td className="k">Admission No.</td>
                      <td>{student.admissionNo}</td>
                    </tr>
                    <tr>
                      <td className="k">Class</td>
                      <td>
                        {student.class} - {student.section}
                      </td>
                    </tr>
                    <tr>
                      <td className="k">Achievement</td>
                      <td>{sportsAchievement.trim() || "—"}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="cert-body" style={{ marginTop: 12 }}>
                  The school congratulates the student on this
                  achievement and wishes them continued success.
                </p>
              </>
            ) : (
              <>
                <p className="cert-body">
                  This is to certify, as per the Admission &amp; Scholar
                  Register of this school, that the Date of Birth of{" "}
                  <b>{student.name}</b>, whose father&apos;s name is{" "}
                  <b>{student.fatherName}</b>
                  {student.motherName ? (
                    <> and mother&apos;s name is <b>{student.motherName}</b></>
                  ) : null}
                  , admitted to this school under{" "}
                  <b>Admission No. {student.admissionNo}</b> in{" "}
                  <b>Class {student.class} - {student.section}</b>, is
                  recorded as{" "}
                  <b>{student.dob ? formatDobText(student.dob) : "—"}</b>.
                  This entry is genuine and unaltered as per the school
                  records.
                </p>
                <table className="cert-fields">
                  <tbody>
                    <tr>
                      <td className="k">Admission No.</td>
                      <td>{student.admissionNo}</td>
                    </tr>
                    <tr>
                      <td className="k">Date of Birth (as per school record)</td>
                      <td>{student.dob ? formatDobText(student.dob) : "—"}</td>
                    </tr>
                    {birthPlace.trim() ? (
                      <tr>
                        <td className="k">Place of Birth</td>
                        <td>{birthPlace.trim()}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
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
    {printHtml !== null && (
      <PrintViewer
        title={`${CERT_TITLES[type]} - ${student.name}`}
        html={printHtml}
        cssText={`@page { size: A4; margin: 14mm; } body { margin: 0; padding: 10px; } ${CERT_CSS}`}
        onClose={() => setPrintHtml(null)}
      />
    )}
    </>
  );
}
