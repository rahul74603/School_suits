import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { useStudents } from "@/hooks/use-students";
import { useAuth } from "@/hooks/use-auth";
import { useSchoolCatalog } from "@/hooks/use-school-catalog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Award,
  Printer,
  Plus,
  Ban,
  CheckCircle2,
  Edit3,
  Save,
  RotateCcw,
  FileCheck2,
  Sparkles,
  Eye,
} from "lucide-react";

type CertType =
  | "transfer"
  | "character"
  | "bonafide"
  | "dob"
  | "fee"
  | "migration"
  | "passing"
  | "sports";

const CERTIFICATE_TEMPLATES: Record<
  CertType,
  {
    title: string;
    hindiTitle: string;
    shortLabel: string;
    subtitle: string;
    prefix: string;
    defaultReason: string;
    defaultRemarks: string;
    defaultPromotedTo: string;
    defaultDues: string;
  }
> = {
  transfer: {
    title: "TRANSFER / SCHOOL LEAVING CERTIFICATE",
    hindiTitle: "स्थानांतरण प्रमाण-पत्र (T.C. / S.L.C.)",
    shortLabel: "Transfer Certificate (TC)",
    subtitle: "Official Scholar Register Leaving Certificate (MP Board / CBSE Pattern)",
    prefix: "TC",
    defaultReason: "Parent's Request / Higher Studies",
    defaultRemarks: "Original TC issued. All school & library dues cleared.",
    defaultPromotedTo: "Next Higher Class",
    defaultDues: "Paid / No Dues Pending",
  },
  character: {
    title: "CHARACTER & CONDUCT CERTIFICATE",
    hindiTitle: "चरित्र एवं आचरण प्रमाण-पत्र",
    shortLabel: "Character Certificate",
    subtitle: "Official Conduct & Moral Character Verification",
    prefix: "CC",
    defaultReason: "Admission in Higher Institution / Scholarship",
    defaultRemarks: "Bears a very good moral character and disciplined conduct.",
    defaultPromotedTo: "Passed / Promoted",
    defaultDues: "No Dues Pending",
  },
  bonafide: {
    title: "BONAFIDE STUDENT CERTIFICATE",
    hindiTitle: "अध्ययनरत (बोनाफाइड) प्रमाण-पत्र",
    shortLabel: "Bonafide Certificate",
    subtitle: "Proof of Regular Enrollment in Current Academic Session",
    prefix: "BC",
    defaultReason: "Scholarship / Bank Account / Aadhaar / Passport / Railway Concession",
    defaultRemarks: "Regular bonafide student of this institution.",
    defaultPromotedTo: "Studying in Current Class",
    defaultDues: "Regular",
  },
  dob: {
    title: "DATE OF BIRTH VERIFICATION CERTIFICATE",
    hindiTitle: "जन्म-तिथि प्रमाण-पत्र (दाखिल-खारिज रजिस्टर अनुसार)",
    shortLabel: "DOB Certificate",
    subtitle: "Certified Extract from School Admission & Scholar Register",
    prefix: "DOB",
    defaultReason: "Aadhaar / Samagra / Birth Record / Official Verification",
    defaultRemarks: "Verified directly from Original Admission (Scholar) Register.",
    defaultPromotedTo: "As per School Record",
    defaultDues: "No Dues Pending",
  },
  fee: {
    title: "TUITION & SCHOOL FEE CERTIFICATE",
    hindiTitle: "शिक्षण शुल्क प्रमाण-पत्र (Income Tax / Reimbursement)",
    shortLabel: "Tuition Fee Certificate",
    subtitle: "For Income Tax Section 80C / CEA / Office Fee Reimbursement",
    prefix: "FC",
    defaultReason: "Income Tax Act Sec 80C / Children Education Allowance (CEA) Claim",
    defaultRemarks: "Tuition fees received as per official school fee ledger.",
    defaultPromotedTo: "Current Academic Session",
    defaultDues: "Tuition Fee Paid",
  },
  migration: {
    title: "NO-OBJECTION & MIGRATION CERTIFICATE",
    hindiTitle: "अनापत्ति एवं माइग्रेशन प्रमाण-पत्र (N.O.C.)",
    shortLabel: "Migration / NOC",
    subtitle: "No-Objection Certificate for Inter-School / Inter-Board Transfer",
    prefix: "MIG",
    defaultReason: "Transfer to Another School / Board / District",
    defaultRemarks: "School has no objection to the student's admission elsewhere.",
    defaultPromotedTo: "Eligible for Admission",
    defaultDues: "No Dues Pending",
  },
  passing: {
    title: "PROVISIONAL PASSING / COMPLETION CERTIFICATE",
    hindiTitle: "उत्तीर्ण / प्रोविजनल प्रमाण-पत्र",
    shortLabel: "Passing Certificate",
    subtitle: "Provisional Certificate of Passing Annual Examination",
    prefix: "PC",
    defaultReason: "Passed Annual Examination & Promoted to Next Class",
    defaultRemarks: "Successfully passed annual examination from this school.",
    defaultPromotedTo: "Promoted to Next Class",
    defaultDues: "No Dues Pending",
  },
  sports: {
    title: "SPORTS & CO-CURRICULAR MERIT CERTIFICATE",
    hindiTitle: "खेलकूद एवं सह-शैक्षणिक उपलब्धि प्रमाण-पत्र",
    shortLabel: "Sports / Merit Certificate",
    subtitle: "Certificate of Participation & Excellence in School Activities",
    prefix: "SPC",
    defaultReason: "Annual Sports Meet / Science Exhibition / Cultural Competition",
    defaultRemarks: "Awarded for outstanding participation and sportsmanship.",
    defaultPromotedTo: "Active Participant",
    defaultDues: "N/A",
  },
};

function buildDefaultBodyText(
  type: CertType,
  student: any,
  schoolName: string,
  certData: {
    issueDate: string;
    reason: string;
    conduct: string;
    remarks: string;
    promotedToClass: string;
    duesStatus: string;
  },
): string {
  const sName = student?.name || "________________________";
  const fName = student?.fatherName || "________________________";
  const mName = student?.motherName || "________________________";
  const cls = student ? `${student.class}-${student.section}` : "________";
  const admNo = student?.admissionNo || "________";
  const dob = student?.dob || "As per Scholar Register";

  switch (type) {
    case "transfer":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName} (Scholar / Admission No. ${admNo}), was a regular bonafide student of ${schoolName} in Class ${cls}. As per our school Admission & Scholar Register (दाखिल-खारिज रजिस्टर), his/her Date of Birth is ${dob}. He/she has cleared all school and library dues (${certData.duesStatus || "No Dues Pending"}) and is ${certData.promotedToClass || "eligible for promotion"}. During his/her stay in the school, his/her moral character and conduct remained "${certData.conduct || "Very Good"}". We wish him/her every success in future studies.`;
    case "character":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName} (Admission No. ${admNo}), has been a regular student of ${schoolName} in Class ${cls}. To the best of my knowledge, he/she bears a "${certData.conduct || "Very Good"}" moral character, is well-disciplined, obedient towards teachers, and has never taken part in any activity subversive of school discipline. We wish him/her a bright and successful future.`;
    case "bonafide":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName}, bearing Scholar / Admission No. ${admNo}, is a regular bonafide student of ${schoolName}, currently studying in Class ${cls} during the current academic session. According to the School Admission Register, his/her Date of Birth is ${dob}. This certificate is issued on request for the purpose of: ${certData.reason || "Official / Scholarship Use"}.`;
    case "dob":
      return `This is to certify from the Original School Scholar & Admission Register (दाखिल-खारिज पंजी) of ${schoolName} that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName}, enrolled under Scholar / Admission No. ${admNo} in Class ${cls}, has his/her Date of Birth recorded as ${dob}. This entry is genuine and un-altered as per institutional records.`;
    case "fee":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName} (Admission No. ${admNo}), is a regular student of Class ${cls} in ${schoolName}. The school tuition and academic fee status for the current academic session is: "${certData.duesStatus || "Paid as per Fee Ledger"}". Purpose: ${certData.reason || "Income Tax Sec 80C / Office Fee Reimbursement"}.`;
    case "migration":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName} (Admission No. ${admNo}), has been studying in Class ${cls} at ${schoolName}. The institution has NO OBJECTION (अनापत्ति) to his/her migration and admission to any other recognized school or board. All school dues are cleared (${certData.duesStatus || "No Dues Pending"}) and his/her conduct has been "${certData.conduct || "Very Good"}".`;
    case "passing":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} and Smt. ${mName} (Admission No. ${admNo}), appeared in the Annual Examination from ${schoolName} in Class ${cls} and has been declared PASSED / "${certData.promotedToClass || "Promoted to Next Class"}". His/her conduct and academic progress remained "${certData.conduct || "Very Good"}".`;
    case "sports":
      return `This is to certify that ${sName}, son/daughter of Shri ${fName} (Admission No. ${admNo}, Class ${cls}) of ${schoolName}, actively participated and demonstrated commendable excellence in "${certData.reason || "Annual Sports & Co-Curricular Activities"}". His/her sportsmanship, team spirit, and discipline remained "${certData.conduct || "Outstanding"}".`;
  }
}

export default function Certificates() {
  const { data: user } = useAuth();
  const { toast } = useToast();
  const catalog = useSchoolCatalog();
  const previewRef = useRef<HTMLDivElement>(null);

  const canManage =
    user?.role === "admin" ||
    user?.role === "principal" ||
    user?.role === "accountant" ||
    user?.role === "staff";

  const { data: students } = useStudents();
  const { data: school } = useQuery<any>({ queryKey: ["/api/school"] });
  const { data: certificates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/certificates"],
  });

  // Form state for issuing a new certificate
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [certificateType, setCertificateType] = useState<CertType>("transfer");
  const [certificateNo, setCertificateNo] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [conduct, setConduct] = useState("Very Good");
  const [reason, setReason] = useState(CERTIFICATE_TEMPLATES.transfer.defaultReason);
  const [remarks, setRemarks] = useState(CERTIFICATE_TEMPLATES.transfer.defaultRemarks);
  const [promotedToClass, setPromotedToClass] = useState(CERTIFICATE_TEMPLATES.transfer.defaultPromotedTo);
  const [duesStatus, setDuesStatus] = useState(CERTIFICATE_TEMPLATES.transfer.defaultDues);
  const [customBody, setCustomBody] = useState("");

  // Selected certificate in Preview / Edit area (`null` = Live Draft Preview of the Left Form)
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [isEditingCert, setIsEditingCert] = useState(false);

  // Editable state when editing an already-issued certificate
  const [editCertNo, setEditCertNo] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editConduct, setEditConduct] = useState("Very Good");
  const [editReason, setEditReason] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editPromotedTo, setEditPromotedTo] = useState("");
  const [editDuesStatus, setEditDuesStatus] = useState("");
  const [editCustomBody, setEditCustomBody] = useState("");

  const filteredStudents = useMemo(
    () =>
      (students ?? []).filter(
        (s) =>
          (!selectedClass || s.class === selectedClass) &&
          (!selectedSection || s.section === selectedSection),
      ),
    [students, selectedClass, selectedSection],
  );

  // When switching certificate template type, load its ready-made defaults
  const handleSelectTemplate = (type: CertType) => {
    const tpl = CERTIFICATE_TEMPLATES[type];
    setCertificateType(type);
    setReason(tpl.defaultReason);
    setRemarks(tpl.defaultRemarks);
    setPromotedToClass(tpl.defaultPromotedTo);
    setDuesStatus(tpl.defaultDues);
    setCustomBody("");
    // Switch preview to live draft mode so user immediately sees the ready-made template
    setSelectedCert(null);
    setIsEditingCert(false);
  };

  // Load selected certificate into edit state when selectedCert changes
  useEffect(() => {
    if (selectedCert) {
      const tpl =
        CERTIFICATE_TEMPLATES[(selectedCert.certificateType as CertType) || "transfer"] ??
        CERTIFICATE_TEMPLATES.transfer;
      const stu = students?.find((s) => s.id === selectedCert.studentId);
      setEditCertNo(selectedCert.certificateNo || "");
      setEditIssueDate(selectedCert.issueDate || new Date().toISOString().slice(0, 10));
      setEditConduct(selectedCert.conduct || "Very Good");
      setEditReason(selectedCert.reason ?? tpl.defaultReason);
      setEditRemarks(selectedCert.remarks ?? tpl.defaultRemarks);
      setEditPromotedTo(selectedCert.promotedToClass ?? tpl.defaultPromotedTo);
      setEditDuesStatus(selectedCert.duesStatus ?? tpl.defaultDues);
      setEditCustomBody(
        selectedCert.customBody ||
          buildDefaultBodyText(
            (selectedCert.certificateType as CertType) || "transfer",
            stu,
            school?.name || "School Integrated Management System",
            {
              issueDate: selectedCert.issueDate || new Date().toISOString().slice(0, 10),
              reason: selectedCert.reason ?? tpl.defaultReason,
              conduct: selectedCert.conduct || "Very Good",
              remarks: selectedCert.remarks ?? tpl.defaultRemarks,
              promotedToClass: selectedCert.promotedToClass ?? tpl.defaultPromotedTo,
              duesStatus: selectedCert.duesStatus ?? tpl.defaultDues,
            },
          ),
      );
    }
  }, [selectedCert, students, school?.name]);

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("Please select a student first");
      const res = await apiRequest("POST", "/api/certificates", {
        studentId: Number(studentId),
        certificateType,
        certificateNo: certificateNo.trim() || undefined,
        issueDate,
        conduct,
        reason: reason || null,
        remarks: remarks || null,
        promotedToClass: promotedToClass || null,
        duesStatus: duesStatus || null,
        customBody: customBody.trim() || null,
      });
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setSelectedCert(created);
      setIsEditingCert(false);
      setCertificateNo("");
      toast({
        title: "Certificate Generated & Saved",
        description: `${created.certificateNo} is ready to print or edit.`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCertMutation = useMutation({
    mutationFn: async (payload: { id: number; updates: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/certificates/${payload.id}`, payload.updates);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      setSelectedCert(updated);
      setIsEditingCert(false);
      toast({
        title: "Certificate Updated",
        description: `Changes saved to ${updated.certificateNo}.`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to save changes", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/certificates/${id}/revoke`);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      if (selectedCert?.id === updated.id) setSelectedCert(updated);
      toast({ title: "Certificate Revoked" });
    },
  });

  // Active data for the Certificate Preview Card (either `selectedCert` or live draft from left form)
  const activeType: CertType = (selectedCert?.certificateType as CertType) || certificateType;
  const activeMeta = CERTIFICATE_TEMPLATES[activeType] ?? CERTIFICATE_TEMPLATES.transfer;
  const activeStudent = useMemo(() => {
    const targetId = selectedCert ? selectedCert.studentId : Number(studentId);
    return students?.find((s) => s.id === targetId);
  }, [selectedCert, studentId, students]);

  const displayCertNo = selectedCert
    ? isEditingCert
      ? editCertNo
      : selectedCert.certificateNo
    : certificateNo || `${activeMeta.prefix}-${new Date().getFullYear()}-PREVIEW`;
  const displayIssueDate = selectedCert
    ? isEditingCert
      ? editIssueDate
      : selectedCert.issueDate
    : issueDate;
  const displayConduct = selectedCert
    ? isEditingCert
      ? editConduct
      : selectedCert.conduct || "Very Good"
    : conduct;
  const displayReason = selectedCert
    ? isEditingCert
      ? editReason
      : selectedCert.reason || activeMeta.defaultReason
    : reason || activeMeta.defaultReason;
  const displayRemarks = selectedCert
    ? isEditingCert
      ? editRemarks
      : selectedCert.remarks || activeMeta.defaultRemarks
    : remarks || activeMeta.defaultRemarks;
  const displayPromotedTo = selectedCert
    ? isEditingCert
      ? editPromotedTo
      : selectedCert.promotedToClass || activeMeta.defaultPromotedTo
    : promotedToClass || activeMeta.defaultPromotedTo;
  const displayDuesStatus = selectedCert
    ? isEditingCert
      ? editDuesStatus
      : selectedCert.duesStatus || activeMeta.defaultDues
    : duesStatus || activeMeta.defaultDues;

  const displayBodyParagraph = useMemo(() => {
    if (selectedCert) {
      if (isEditingCert && editCustomBody.trim()) return editCustomBody;
      if (selectedCert.customBody) return selectedCert.customBody;
    } else if (customBody.trim()) {
      return customBody;
    }
    return buildDefaultBodyText(
      activeType,
      activeStudent,
      school?.name || "School Integrated Management System",
      {
        issueDate: displayIssueDate,
        reason: displayReason,
        conduct: displayConduct,
        remarks: displayRemarks,
        promotedToClass: displayPromotedTo,
        duesStatus: displayDuesStatus,
      },
    );
  }, [
    selectedCert,
    isEditingCert,
    editCustomBody,
    customBody,
    activeType,
    activeStudent,
    school?.name,
    displayIssueDate,
    displayReason,
    displayConduct,
    displayRemarks,
    displayPromotedTo,
    displayDuesStatus,
  ]);

  // Dedicated clean A4 Print Window helper (works 100% reliably on Windows Chrome/Edge/Firefox)
  const handlePrintCertificate = (certOverride?: any) => {
    const certToPrint = certOverride || selectedCert;
    const type: CertType = (certToPrint?.certificateType as CertType) || certificateType;
    const meta = CERTIFICATE_TEMPLATES[type] ?? CERTIFICATE_TEMPLATES.transfer;
    const stu = students?.find(
      (s) => s.id === (certToPrint ? certToPrint.studentId : Number(studentId)),
    );

    const cNo = certToPrint
      ? certToPrint.certificateNo
      : displayCertNo;
    const cDate = certToPrint
      ? certToPrint.issueDate
      : displayIssueDate;
    const cConduct = certToPrint
      ? certToPrint.conduct || "Very Good"
      : displayConduct;
    const cReason = certToPrint
      ? certToPrint.reason || meta.defaultReason
      : displayReason;
    const cRemarks = certToPrint
      ? certToPrint.remarks || meta.defaultRemarks
      : displayRemarks;
    const cPromoted = certToPrint
      ? certToPrint.promotedToClass || meta.defaultPromotedTo
      : displayPromotedTo;
    const cDues = certToPrint
      ? certToPrint.duesStatus || meta.defaultDues
      : displayDuesStatus;
    const cBody =
      certToPrint?.customBody ||
      (!certOverride && selectedCert && isEditingCert && editCustomBody.trim()
        ? editCustomBody
        : !certOverride && !selectedCert && customBody.trim()
        ? customBody
        : buildDefaultBodyText(
            type,
            stu,
            school?.name || "School Integrated Management System",
            {
              issueDate: cDate,
              reason: cReason,
              conduct: cConduct,
              remarks: cRemarks,
              promotedToClass: cPromoted,
              duesStatus: cDues,
            },
          ));

    const printWin = window.open("", "_blank", "width=900,height=1100");
    if (!printWin) {
      window.print();
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${meta.shortLabel} - ${cNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Georgia", "Times New Roman", serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cert-frame {
      border: 4px double #1e293b;
      padding: 24px 28px;
      min-height: 265mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 14px;
      margin-bottom: 14px;
    }
    .school-name {
      font-size: 24px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 0;
    }
    .school-sub {
      font-size: 12px;
      color: #334155;
      margin-top: 4px;
    }
    .badge-box {
      display: inline-block;
      margin-top: 12px;
      padding: 6px 22px;
      background: #0f172a;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1.5px;
      border-radius: 4px;
    }
    .hindi-sub {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-top: 5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 14px;
      padding: 6px 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
    }
    .paragraph {
      font-size: 14px;
      line-height: 1.75;
      text-align: justify;
      margin: 12px 0 16px 0;
    }
    table.details {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5px;
    }
    table.details td {
      border: 1px solid #94a3b8;
      padding: 6px 10px;
    }
    table.details td.label {
      width: 44%;
      font-weight: 700;
      background: #f8fafc;
      color: #1e293b;
    }
    table.details td.val {
      font-weight: 600;
      color: #0f172a;
    }
    .footer-sigs {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 48px;
      margin-top: 24px;
      font-size: 12.5px;
      font-weight: 700;
    }
    .sig-col {
      text-align: center;
      width: 28%;
      border-top: 1.5px solid #334155;
      padding-top: 6px;
    }
  </style>
</head>
<body>
  <div class="cert-frame">
    <div>
      <div class="header">
        <h1 class="school-name">${school?.name || "School Integrated Management System"}</h1>
        <div class="school-sub">${school?.address || "Affiliated Secondary & Senior Secondary School"}</div>
        <div class="school-sub">Phone: ${school?.contactPhone || "-"} &nbsp;|&nbsp; Email: ${school?.email || "-"}</div>
        <div class="badge-box">${meta.title}</div>
        <div class="hindi-sub">${meta.hindiTitle}</div>
      </div>

      <div class="meta-row">
        <div><strong>Certificate No (प्रमाण-पत्र क्र.):</strong> ${cNo}</div>
        <div><strong>Scholar / Admission No:</strong> ${stu?.admissionNo || "-"}</div>
        <div><strong>Date of Issue (दिनांक):</strong> ${cDate}</div>
      </div>

      <div class="paragraph">${cBody}</div>

      <table class="details">
        <tr>
          <td class="label">1. Name of Pupil (विद्यार्थी का नाम)</td>
          <td class="val">${stu?.name || "-"}</td>
        </tr>
        <tr>
          <td class="label">2. Father's Name (पिता का नाम)</td>
          <td class="val">Shri ${stu?.fatherName || "-"}</td>
        </tr>
        <tr>
          <td class="label">3. Mother's Name (माता का नाम)</td>
          <td class="val">Smt. ${stu?.motherName || "-"}</td>
        </tr>
        <tr>
          <td class="label">4. Class & Section (कक्षा एवं वर्ग)</td>
          <td class="val">${stu ? `Class ${stu.class} - Section ${stu.section}` : "-"} ${stu?.stream ? `(${stu.stream})` : ""}</td>
        </tr>
        <tr>
          <td class="label">5. Date of Birth as per Scholar Register (जन्म तिथि)</td>
          <td class="val">${stu?.dob || "As per Scholar Register"}</td>
        </tr>
        <tr>
          <td class="label">6. Nationality & Category (राष्ट्रीयता / वर्ग)</td>
          <td class="val">${stu?.nationality || "Indian"} ${stu?.category ? `/ ${stu.category}` : ""}</td>
        </tr>
        <tr>
          <td class="label">7. Samagra ID / PEN / APAAR ID</td>
          <td class="val">Samagra: ${stu?.samagraId || "-"} &nbsp;|&nbsp; PEN: ${stu?.penNumber || "-"} &nbsp;|&nbsp; APAAR: ${stu?.apaarId || "-"}</td>
        </tr>
        <tr>
          <td class="label">8. Promotion / Academic Status (पदोन्नति स्थिति)</td>
          <td class="val">${cPromoted}</td>
        </tr>
        <tr>
          <td class="label">9. School Fee & Library Dues Status (शुल्क स्थिति)</td>
          <td class="val">${cDues}</td>
        </tr>
        <tr>
          <td class="label">10. General Conduct & Character (आचरण एवं चरित्र)</td>
          <td class="val">${cConduct}</td>
        </tr>
        <tr>
          <td class="label">11. Purpose / Reason (कारण / उद्देश्य)</td>
          <td class="val">${cReason}</td>
        </tr>
        <tr>
          <td class="label">12. Official Remarks (विशेष टीप)</td>
          <td class="val">${cRemarks}</td>
        </tr>
      </table>
    </div>

    <div class="footer-sigs">
      <div class="sig-col">Prepared / Checked By<br/><span style="font-weight:normal;font-size:11px;">(प्रभारी लिपिक / कक्षा शिक्षक)</span></div>
      <div class="sig-col">School Seal / Stamp<br/><span style="font-weight:normal;font-size:11px;">(विद्यालय की मुद्रा)</span></div>
      <div class="sig-col">Principal / Headmaster<br/><span style="font-weight:normal;font-size:11px;">(प्राचार्य हस्ताक्षर)</span></div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center gap-4 no-print">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                <Award className="w-8 h-8 text-primary" />
                Ready-Made School Certificates (सभी स्कूल प्रमाण-पत्र)
              </h1>
              <p className="text-muted-foreground mt-1">
                8 Ready-Made Official School Certificate Templates (TC, Character, Bonafide, DOB, Fee, Migration, Passing & Sports) — Fully Editable & Printable
              </p>
            </div>
          </div>

          {/* 8 Ready-Made Template Switcher Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 no-print">
            {(Object.keys(CERTIFICATE_TEMPLATES) as CertType[]).map((tKey) => {
              const tpl = CERTIFICATE_TEMPLATES[tKey];
              const isSelected = activeType === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => handleSelectTemplate(tKey)}
                  className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/25"
                      : "bg-card hover:bg-muted/60 border-border text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/10 font-bold">
                      {tpl.prefix}
                    </span>
                    <FileCheck2 className="w-3.5 h-3.5 opacity-80" />
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-bold leading-tight">{tpl.shortLabel}</div>
                    <div
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {tpl.hindiTitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Issue / Customize Certificate Form */}
            {canManage && (
              <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 h-fit no-print">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Prepare & Issue Certificate
                  </h2>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                    {CERTIFICATE_TEMPLATES[certificateType].shortLabel}
                  </span>
                </div>

                {/* Filter Class & Section */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      1. Filter Class (कक्षा चुनें)
                    </label>
                    <select
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSection("");
                        setStudentId("");
                      }}
                    >
                      <option value="">All Classes ({catalog.classOptions.length})</option>
                      {catalog.classOptions.map((c: string) => (
                        <option key={c} value={c}>
                          Class {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      2. Filter Section (सेक्शन)
                    </label>
                    <select
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={selectedSection}
                      onChange={(e) => {
                        setSelectedSection(e.target.value);
                        setStudentId("");
                      }}
                    >
                      <option value="">All Sections</option>
                      {catalog.getSectionsForClass(selectedClass).map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Select Student */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    3. Select Student (विद्यार्थी चुनें — नाम / पिता का नाम / प्रवेश क्र.) *
                  </label>
                  <select
                    data-testid="select-certificate-student"
                    className="w-full mt-1 px-3 py-2.5 border border-border rounded-lg bg-background text-sm font-medium"
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value);
                      setSelectedCert(null);
                    }}
                  >
                    <option value="">
                      -- Choose Student ({filteredStudents.length} available) --
                    </option>
                    {filteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} | Father: {s.fatherName} | Class {s.class}-{s.section} | Adm:{" "}
                        {s.admissionNo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Certificate Type */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    4. Certificate Type (प्रमाण-पत्र का प्रकार) *
                  </label>
                  <select
                    data-testid="select-certificate-type"
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm font-medium"
                    value={certificateType}
                    onChange={(e) => handleSelectTemplate(e.target.value as CertType)}
                  >
                    {(Object.keys(CERTIFICATE_TEMPLATES) as CertType[]).map((tKey) => (
                      <option key={tKey} value={tKey}>
                        {CERTIFICATE_TEMPLATES[tKey].shortLabel} —{" "}
                        {CERTIFICATE_TEMPLATES[tKey].hindiTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      5. Issue Date (जारी दिनांक)
                    </label>
                    <input
                      type="date"
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      6. Conduct / Character (आचरण)
                    </label>
                    <select
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={conduct}
                      onChange={(e) => setConduct(e.target.value)}
                    >
                      <option value="Exemplary">Exemplary (उत्कृष्ट)</option>
                      <option value="Very Good">Very Good (अति उत्तम)</option>
                      <option value="Good">Good (उत्तम)</option>
                      <option value="Satisfactory">Satisfactory (संतोषजनक)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      7. Promotion / Class Status (पदोन्नति स्थिति)
                    </label>
                    <input
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={promotedToClass}
                      onChange={(e) => setPromotedToClass(e.target.value)}
                      placeholder="e.g., Promoted to Class 11"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      8. Fee / Library Dues Status (शुल्क स्थिति)
                    </label>
                    <input
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      value={duesStatus}
                      onChange={(e) => setDuesStatus(e.target.value)}
                      placeholder="e.g., Paid / No Dues Pending"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    9. Custom Certificate No. (प्रमाण-पत्र क्रमांक — खाली छोड़ने पर ऑटो-जनरेट होगा)
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                    placeholder={`Auto: ${CERTIFICATE_TEMPLATES[certificateType].prefix}-${new Date().getFullYear()}-XXXXX`}
                    value={certificateNo}
                    onChange={(e) => setCertificateNo(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    10. Reason / Purpose (प्रमाण-पत्र का उद्देश्य / कारण)
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">
                    11. Remarks (विशेष टीप)
                  </label>
                  <input
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">
                      12. Editable Certificate Paragraph (सर्टिफिकेट की मुख्य भाषा — आप इसे एडिट कर सकते हैं)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomBody(
                          buildDefaultBodyText(
                            certificateType,
                            activeStudent,
                            school?.name || "School Integrated Management System",
                            {
                              issueDate,
                              reason,
                              conduct,
                              remarks,
                              promotedToClass,
                              duesStatus,
                            },
                          ),
                        )
                      }
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" /> Load Ready-Made Text to Edit
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-xs leading-relaxed"
                    placeholder="Leave blank to use automatic ready-made certificate paragraph, or click 'Load Ready-Made Text to Edit' to customize every word..."
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    data-testid="button-issue-certificate"
                    onClick={() => issueMutation.mutate()}
                    disabled={!studentId || issueMutation.isPending}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {issueMutation.isPending
                      ? "Generating..."
                      : "Generate & Save Certificate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate()}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                    title="Print current preview directly"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
              </div>
            )}

            {/* Right Column: Live Printable & Editable Certificate Preview */}
            <div className={canManage ? "lg:col-span-7" : "lg:col-span-12"} ref={previewRef}>
              <div className="bg-white text-slate-900 border-2 border-slate-300 rounded-2xl p-6 md:p-8 shadow-md">
                {/* Action Bar on top of Certificate Preview */}
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b border-slate-200 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {selectedCert
                        ? `Saved Certificate #${selectedCert.certificateNo}`
                        : "Live Ready-Made Preview (Draft)"}
                    </span>
                    {selectedCert?.status === "revoked" && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                        REVOKED
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedCert && canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingCert(!isEditingCert)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
                            isEditingCert
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditingCert ? "Cancel Edit" : "Edit Certificate (एडिट करें)"}
                        </button>

                        {selectedCert.status === "revoked" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateCertMutation.mutate({
                                id: selectedCert.id,
                                updates: { status: "issued" },
                              })
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore Certificate
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      data-testid="button-print-certificate"
                      onClick={() => handlePrintCertificate()}
                      className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 shadow-sm"
                    >
                      <Printer className="w-4 h-4" /> Print / Save PDF
                    </button>
                  </div>
                </div>

                {/* Inline Editor Panel when editing an already-issued certificate */}
                {selectedCert && isEditingCert && canManage && (
                  <div className="mb-6 p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3 no-print">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4" /> Edit Issued Certificate Content ({selectedCert.certificateNo})
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          updateCertMutation.mutate({
                            id: selectedCert.id,
                            updates: {
                              certificateNo: editCertNo.trim() || selectedCert.certificateNo,
                              issueDate: editIssueDate,
                              conduct: editConduct,
                              reason: editReason || null,
                              remarks: editRemarks || null,
                              promotedToClass: editPromotedTo || null,
                              duesStatus: editDuesStatus || null,
                              customBody: editCustomBody.trim() || null,
                            },
                          })
                        }
                        disabled={updateCertMutation.isPending}
                        className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {updateCertMutation.isPending ? "Saving..." : "Save Changes to Certificate"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700">Certificate No.</label>
                        <input
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editCertNo}
                          onChange={(e) => setEditCertNo(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Issue Date</label>
                        <input
                          type="date"
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editIssueDate}
                          onChange={(e) => setEditIssueDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Conduct / Character</label>
                        <input
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editConduct}
                          onChange={(e) => setEditConduct(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Promotion Status</label>
                        <input
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editPromotedTo}
                          onChange={(e) => setEditPromotedTo(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Fee / Dues Status</label>
                        <input
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editDuesStatus}
                          onChange={(e) => setEditDuesStatus(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700">Purpose / Reason</label>
                        <input
                          className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="font-semibold text-slate-700">Remarks (विशेष टीप)</label>
                      <input
                        className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                      />
                    </div>

                    <div className="text-xs">
                      <label className="font-semibold text-slate-700">
                        Main Certificate Paragraph (सर्टिफिकेट का मुख्य पैराग्राफ — सीधा यहाँ बदलें)
                      </label>
                      <textarea
                        rows={3}
                        className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-300 rounded bg-white leading-relaxed"
                        value={editCustomBody}
                        onChange={(e) => setEditCustomBody(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Official Framed Certificate Sheet */}
                <div className="border-4 border-double border-slate-800 p-6 md:p-8 rounded-lg space-y-5">
                  <div className="text-center border-b-2 border-slate-800 pb-4">
                    <h2 className="text-2xl font-extrabold uppercase tracking-wide text-slate-900">
                      {school?.name || "School Integrated Management System"}
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      {school?.address || "Affiliated Secondary & Senior Secondary School"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Phone: {school?.contactPhone || "-"} | Email: {school?.email || "-"}
                    </p>
                    <div className="mt-3 inline-block px-5 py-1.5 bg-slate-900 text-white font-bold text-xs tracking-widest rounded">
                      {activeMeta.title}
                    </div>
                    <p className="text-xs font-bold text-slate-700 mt-1">{activeMeta.hindiTitle}</p>
                  </div>

                  <div className="flex flex-wrap justify-between gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded">
                    <span>
                      <strong>Certificate No:</strong> {displayCertNo}
                    </span>
                    <span>
                      <strong>Scholar / Adm No:</strong> {activeStudent?.admissionNo || "_______"}
                    </span>
                    <span>
                      <strong>Date of Issue:</strong> {displayIssueDate}
                    </span>
                  </div>

                  {/* Main Body Paragraph */}
                  <div className="text-sm leading-relaxed text-justify text-slate-800">
                    {displayBodyParagraph}
                  </div>

                  {/* Structured 12-Point Official Scholar Register Table */}
                  <div className="border border-slate-300 rounded overflow-hidden text-xs">
                    <table className="w-full border-collapse">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700 w-5/12">
                            1. Student Name (विद्यार्थी का नाम)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {activeStudent?.name || "_______________________"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            2. Father's Name (पिता का नाम)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            Shri {activeStudent?.fatherName || "_______________________"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            3. Mother's Name (माता का नाम)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            Smt. {activeStudent?.motherName || "_______________________"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            4. Class & Section (कक्षा एवं वर्ग)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {activeStudent
                              ? `Class ${activeStudent.class} - Section ${activeStudent.section}`
                              : "________"}{" "}
                            {activeStudent?.stream ? `(${activeStudent.stream})` : ""}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            5. Date of Birth (जन्म तिथि — दाखिल-खारिज अनुसार)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {activeStudent?.dob || "As per Scholar Register"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            6. Nationality & Category (राष्ट्रीयता / वर्ग)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {activeStudent?.nationality || "Indian"}{" "}
                            {activeStudent?.category ? `/ ${activeStudent.category}` : ""}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            7. Samagra / PEN / APAAR ID
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            Samagra: {activeStudent?.samagraId || "-"} | PEN:{" "}
                            {activeStudent?.penNumber || "-"} | APAAR:{" "}
                            {activeStudent?.apaarId || "-"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            8. Promotion / Academic Status (पदोन्नति स्थिति)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {displayPromotedTo}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            9. School Fee & Library Dues (शुल्क स्थिति)
                          </td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">
                            {displayDuesStatus}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            10. General Conduct & Character (आचरण एवं चरित्र)
                          </td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">
                            {displayConduct}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            11. Purpose / Reason (उद्देश्य / कारण)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {displayReason}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 bg-slate-50 font-bold text-slate-700">
                            12. Official Remarks (विशेष टीप)
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {displayRemarks}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Signature Footer */}
                  <div className="pt-12 flex justify-between items-end text-xs font-bold text-slate-700">
                    <div className="text-center border-t border-slate-500 pt-1.5 w-36">
                      Prepared / Checked By
                      <div className="text-[10px] font-normal text-slate-500">
                        (प्रभारी लिपिक / शिक्षक)
                      </div>
                    </div>
                    <div className="text-center border-t border-slate-500 pt-1.5 w-36">
                      School Seal
                      <div className="text-[10px] font-normal text-slate-500">
                        (विद्यालय की मुद्रा)
                      </div>
                    </div>
                    <div className="text-center border-t border-slate-500 pt-1.5 w-40">
                      Principal Signature
                      <div className="text-[10px] font-normal text-slate-500">
                        (प्राचार्य हस्ताक्षर)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Issued Certificates Register Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm no-print">
            <div className="p-4 border-b border-border flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-bold">
                Issued Certificates Register (जारी किए गए प्रमाण-पत्र रजिस्टर)
              </h3>
              <span className="text-xs text-muted-foreground">
                Click <strong>Preview / Edit</strong> to modify any certificate, or{" "}
                <strong>Print 🖨️</strong> to print A4 PDF directly.
              </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="p-4">Certificate No</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Student & Father Name</th>
                  <th className="p-4">Issue Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading certificates...
                    </td>
                  </tr>
                ) : !certificates?.length ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No certificates issued yet. Select any ready-made template above to issue or print immediately.
                    </td>
                  </tr>
                ) : (
                  certificates.map((c: any) => {
                    const stu = students?.find((s) => s.id === c.studentId);
                    const tpl =
                      CERTIFICATE_TEMPLATES[(c.certificateType as CertType) || "transfer"];
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-muted/20 ${
                          selectedCert?.id === c.id ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-4 font-mono font-semibold text-primary">
                          {c.certificateNo}
                        </td>
                        <td className="p-4 font-medium">
                          {tpl ? tpl.shortLabel : c.certificateType}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold">
                            {stu ? `${stu.name} (${stu.class}-${stu.section})` : `#${c.studentId}`}
                          </div>
                          {stu && (
                            <div className="text-xs text-muted-foreground">
                              Father: Shri {stu.fatherName} | Adm: {stu.admissionNo}
                            </div>
                          )}
                        </td>
                        <td className="p-4">{c.issueDate}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              c.status === "issued"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {c.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCert(c);
                                setIsEditingCert(false);
                                previewRef.current?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Preview
                            </button>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCert(c);
                                  setIsEditingCert(true);
                                  previewRef.current?.scrollIntoView({ behavior: "smooth" });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePrintCertificate(c)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print
                            </button>
                            {canManage && c.status === "issued" && (
                              <button
                                type="button"
                                onClick={() => revokeMutation.mutate(c.id)}
                                className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <Ban className="w-3.5 h-3.5" /> Revoke
                              </button>
                            )}
                            {canManage && c.status === "revoked" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateCertMutation.mutate({
                                    id: c.id,
                                    updates: { status: "issued" },
                                  })
                                }
                                className="px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50 text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
