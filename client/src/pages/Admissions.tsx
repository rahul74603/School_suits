import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  UserPlus,
  Bus,
  Save,
  RefreshCw,
  AlertCircle,
  School,
  IndianRupee,
} from "lucide-react";

export default function Admissions() {
  const { toast } = useToast();
  // Super Admin ka khud ka koi school nahi hota — is page ke load
  // endpoints server par uske liye 403 dete hain (/api/transport-routes,
  // /api/students/next-admission-no — requireRole me super_admin hai
  // hi nahi; routes se verify). Pehle ye fail khamoshi se hota tha
  // (sirf console), lekin form bharkar Submit karne par SA ko lal
  // toast milta tha. Isliye SA par form hi nahi dikhate — Settings
  // wala no-school card dikhega.
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [loading, setLoading] = useState(false);
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  // Fee structures (GET /api/fee-structures) — chuni hui class ki
  // admission fee ka default nikalne ke liye.
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  // Admission Fee is form se hi jama hogi: kul rakam (admFeeTotal)
  // class ki fee structure se default aati hai, "Abhi Jama"
  // (admFeePaid) office yahin bharta hai — poora, aadha ya kuch nahi.
  const [admFeeTotal, setAdmFeeTotal] = useState("");
  const [admFeePaid, setAdmFeePaid] = useState("");

  // Form Data
  const [formData, setFormData] = useState({
    admissionNumber: "",
    studentName: "",
    fatherName: "",
    motherName: "",
    dob: "",
    aadhaarNo: "",
    birthCertificateNo: "",

    contactNumber: "",
    address: "",
    class: "",
    section: "A",
    rollNo: "",

    category: "General",

    // ✅ Previous School Details
    previousSchoolName: "",
    previousClass: "",
    tcNumber: "",
    tcIssueDate: "",
    tcSubmitted: false,
    reportCardSubmitted: false,

    transportEnabled: false,
    transportId: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  // Class badle to Kul Admission Fee us class ki fee structure se
  // apne aap bhar jaye. Office use uske baad haath se badal sakta
  // hai — lekin pakki fee hamesha fee structure wali hi rehti hai
  // (Fees page ka hisaab wahi se banta hai).
  useEffect(() => {
    if (!formData.class) return;
    const s = feeStructures.find((f: any) => f.class === formData.class);
    setAdmFeeTotal(s ? String(s.admissionFee ?? 0) : "");
  }, [formData.class, feeStructures]);

  // Chuni hui class ki structure-wali admission fee (structure hi na
  // ho to null) — form ke neeche sahi salah dikhane ke liye.
  const structureForClass = feeStructures.find(
    (f: any) => f.class === formData.class
  );
  const structureAdmFee: number | null = structureForClass
    ? (structureForClass.admissionFee ?? 0)
    : null;
  const admTotalNum = parseInt(admFeeTotal) || 0;
  const admPaidNum = parseInt(admFeePaid) || 0;
  const admBalancePreview = admTotalNum - admPaidNum;

  const loadInitialData = async () => {
    // Super Admin: koi school nahi — koi API call nahi (upar wala note).
    if (isSuperAdmin) return;
    try {
      // REST: GET /api/transport-routes — camelCase aata hai,
      // page route_name padhta hai, adapter wahi bharta hai.
      const routes = await apiGet<any[]>("/api/transport-routes");
      setTransportRoutes(
        (routes || []).map((r) => ({ ...r, route_name: r.routeName }))
      );
      // REST: GET /api/fee-structures — fail ho to form bina default
      // ke bhi chalega (kul rakam haath se likh sakte hain), isliye
      // iska apna try/catch hai.
      try {
        const structures = await apiGet<any[]>("/api/fee-structures");
        setFeeStructures(structures || []);
      } catch (e) {
        console.error(e);
      }
      await refreshAdmissionNumber();
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAdmissionNumber = async () => {
    try {
      // REST: GET /api/students/next-admission-no — jawab
      // { admissionNo } object me aata hai, string yahin nikali.
      const res = await apiGet<{ admissionNo: string }>(
        "/api/students/next-admission-no"
      );
      const nextNum = res?.admissionNo ?? "";
      setFormData((prev) => ({ ...prev, admissionNumber: nextNum }));
      return nextNum;
    } catch (e) {
      console.error("Sync Error", e);
    }
  };

  const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });

  const handleNameChange = (field: string, value: string) =>
    setFormData({ ...formData, [field]: toTitleCase(value) });

  const handleSubmit = async () => {
    // ✅ Required fields
    if (!formData.studentName || !formData.class || !formData.admissionNumber) {
      toast({
        title: "Error",
        description: "Required fields missing",
        variant: "destructive",
      });
      return;
    }

    // ✅ Transport validation (THIS FIXES SAVE FAIL)
    if (formData.transportEnabled && !formData.transportId) {
      toast({
        title: "Transport Error",
        description: "Transport enabled hai, route select karo.",
        variant: "destructive",
      });
      return;
    }

    // ✅ Admission Fee validation: jama rakam kul rakam se zyada nahi
    // ho sakti; aur bina kul rakam ke jama ka baaki-hisaab Fees page
    // par dikhega hi nahi (wahan ka kul bhi fee structure se banta
    // hai) — isliye dono haalatein yahin rok dete hain.
    const admTotalSubmit = parseInt(admFeeTotal) || 0;
    const admPaidSubmit = parseInt(admFeePaid) || 0;
    if (admPaidSubmit < 0 || admPaidSubmit > admTotalSubmit) {
      toast({
        title: "Admission Fee Error",
        description:
          admTotalSubmit <= 0
            ? "Pehle Kul Admission Fee likho — bina kul rakam ke jama ka hisaab nahi banege."
            : "Abhi Jama ki rakam Kul Admission Fee se zyada hai — rakam sahi karo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Duplicate check
      // REST: GET /api/students/check-admission-no?no= — jawab
      // { exists } deta hai, page ko boolean chahiye tha.
      const dup = await apiGet<{ exists: boolean }>(
        `/api/students/check-admission-no?no=${encodeURIComponent(formData.admissionNumber)}`
      );
      const isDuplicate = !!dup?.exists;

      if (isDuplicate) {
        toast({
          title: "Duplicate ID!",
          description: `ID '${formData.admissionNumber}' already exists. Please change or Refresh.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // ✅ Create student
      // REST: POST /api/students — form ke naam server ke camelCase
      // columns par map kiye hain; switches 0/1 me jate hain aur
      // transportId sirf enabled ho to (warna null).
      const createdStudent = await apiPost<any>("/api/students", {
        admissionNo: formData.admissionNumber,
        name: formData.studentName,
        fatherName: formData.fatherName,
        motherName: formData.motherName || undefined,
        dob: formData.dob || undefined,
        aadhaar: formData.aadhaarNo || undefined,
        birthCertificateNo: formData.birthCertificateNo || undefined,
        contact: formData.contactNumber,
        address: formData.address || undefined,
        class: formData.class,
        section: formData.section,
        rollNo: formData.rollNo || undefined,
        category: formData.category || undefined,
        previousSchoolName: formData.previousSchoolName || undefined,
        previousClass: formData.previousClass || undefined,
        tcNumber: formData.tcNumber || undefined,
        tcIssueDate: formData.tcIssueDate || undefined,
        tcSubmitted: formData.tcSubmitted ? 1 : 0,
        reportCardSubmitted: formData.reportCardSubmitted ? 1 : 0,
        transportId:
          formData.transportEnabled && formData.transportId
            ? parseInt(formData.transportId)
            : null,
      });

      // Admission Fee ki entry (sirf jab jama rakam > 0): Fees page
      // wali hi payment shape — pehle next receipt number, fir ek
      // payment jiske breakdown me ek "Admission Fee" item aur
      // isAdmission flag. Fees page ka kul/jama/baaki hisaab isi se
      // banta hai; baaki rakam wahan Pending Dues me dikhegi.
      let feeNote = "";
      let feeFailed = false;
      if (admPaidSubmit > 0 && createdStudent?.id) {
        try {
          const receiptRes = await apiGet<{ receiptNo: string }>(
            "/api/payments/next-receipt-no"
          );
          await apiPost("/api/payments", {
            studentId: createdStudent.id,
            amount: admPaidSubmit,
            month: "Misc",
            year: new Date().getFullYear(),
            receiptNo: receiptRes.receiptNo,
            isAdmission: true,
            remarks: `Admission Fee (₹${admPaidSubmit})`,
            breakdown: {
              extras: [
                {
                  name: "Admission Fee",
                  amount: admPaidSubmit,
                  type: "Admission Fee",
                },
              ],
            },
          });
          feeNote =
            admTotalSubmit > admPaidSubmit
              ? ` Admission Fee ₹${admPaidSubmit} jama ho gayi — baaki ₹${admTotalSubmit - admPaidSubmit} Fees page par Pending Dues me dikhega.`
              : ` Admission Fee ₹${admPaidSubmit} jama ho gayi — poori fee mil gayi.`;
        } catch (feeError) {
          console.error("Admission Fee Payment Error:", feeError);
          feeFailed = true;
        }
      }

      // Fee entry fail ho jaye to jhooti safalta bilkul nahi —
      // admission ban chuka hai, ye saaf batao aur Fees page ka
      // rasta do (form reset isliye bhi hota hai taaki dobara
      // Submit se duplicate admission na bane).
      if (feeFailed) {
        toast({
          title: "Admission ho gaya, fee entry nahi lagi",
          description:
            "Student ka admission ban gaya hai, lekin Admission Fee ki entry nahi lag payi. Fees page par student chunein aur Admission Fee wahan se jama kar dein.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Admission Created Successfully!${feeNote}`,
        });
      }

      // Reset form
      setFormData({
        admissionNumber: "",
        studentName: "",
        fatherName: "",
        motherName: "",
        dob: "",
        aadhaarNo: "",
        birthCertificateNo: "",

        contactNumber: "",
        address: "",
        class: "",
        section: "A",
        rollNo: "",

        category: "General",

        previousSchoolName: "",
        previousClass: "",
        tcNumber: "",
        tcIssueDate: "",
        tcSubmitted: false,
        reportCardSubmitted: false,

        transportEnabled: false,
        transportId: "",
      });
      setAdmFeeTotal("");
      setAdmFeePaid("");

      await refreshAdmissionNumber();
    } catch (error) {
      console.error("Save Error:", error);

      toast({
        title: "Error",
        description: "Failed to save.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
          <UserPlus className="h-8 w-8 text-blue-600" /> New Admission
        </h1>

        {!isSuperAdmin && (
          <Button variant="outline" size="sm" onClick={refreshAdmissionNumber} className="shrink-0 self-start sm:self-auto">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh ID
          </Button>
        )}
      </div>

      {isSuperAdmin ? (
        <Card className="border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <School className="h-5 w-5" /> No School Linked to This Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              You are signed in as Super Admin. This account is not linked
              to any school, so new admissions cannot be added from here.
              First create a school from the Schools screen — after that,
              that school&apos;s Principal can sign in with their own
              account and add admissions.
            </p>
            <Link href="/schools">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <School className="h-4 w-4 mr-2" /> Go to Schools
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
      <>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT SIDE */}
        <Card>
          <CardHeader className="bg-blue-50 py-3">
            <CardTitle className="text-base text-blue-800">
              Student Info
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="font-bold text-blue-700 flex items-center gap-2">
                  Admission No. (Auto){" "}
                  <AlertCircle className="h-3 w-3 text-gray-400" />
                </Label>

                <Input
                  value={formData.admissionNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      admissionNumber: e.target.value.toUpperCase(),
                    })
                  }
                  className="bg-yellow-50 font-bold border-yellow-400 text-lg uppercase"
                  placeholder="Loading..."
                />
                <p className="text-[10px] text-gray-500">
                  Synced with Settings. Fully Editable.
                </p>
              </div>

              <div className="space-y-1">
                <Label>DOB</Label>
                <Input
                  type="date"
                  value={formData.dob}
                  onChange={(e) =>
                    setFormData({ ...formData, dob: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label>Birth Certificate No.</Label>
                <Input
                  placeholder="BC No."
                  value={formData.birthCertificateNo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      birthCertificateNo: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Student Name</Label>
              <Input
                placeholder="Name"
                value={formData.studentName}
                onChange={(e) => handleNameChange("studentName", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Father Name</Label>
                <Input
                  value={formData.fatherName}
                  onChange={(e) =>
                    handleNameChange("fatherName", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Mother Name</Label>
                <Input
                  value={formData.motherName}
                  onChange={(e) =>
                    handleNameChange("motherName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Mobile</Label>
                <Input
                  type="number"
                  value={formData.contactNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, contactNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Student Aadhaar No.</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="12 Digit Aadhaar"
                  maxLength={12}
                  value={formData.aadhaarNo}
                  onChange={(e) => {
                    const onlyDigits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 12);
                    setFormData({ ...formData, aadhaarNo: onlyDigits });
                  }}
                />
                <p className="text-[10px] text-gray-500">
                  Only 12 digits allowed
                </p>
              </div>

              <div className="space-y-1">
                <Label>Roll No.</Label>
                <Input
                  value={formData.rollNo}
                  onChange={(e) =>
                    setFormData({ ...formData, rollNo: e.target.value })
                  }
                  placeholder="Roll No."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT SIDE */}
        <div className="space-y-6">
          {/* ✅ Previous School Details */}
          <Card>
            <CardHeader className="bg-green-50 py-3">
              <CardTitle className="text-base text-green-800 flex items-center gap-2">
                <School className="h-4 w-4" /> Previous School Details
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Previous School Name</Label>
                <Input
                  placeholder="Old School Name"
                  value={formData.previousSchoolName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      previousSchoolName: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Previous Class</Label>
                  <Input
                    placeholder="e.g. 5"
                    value={formData.previousClass}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        previousClass: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>TC Number</Label>
                  <Input
                    placeholder="TC No."
                    value={formData.tcNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tcNumber: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>TC Issue Date</Label>
                  <Input
                    type="date"
                    value={formData.tcIssueDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tcIssueDate: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>TC Submitted</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={formData.tcSubmitted}
                      onCheckedChange={(c) =>
                        setFormData({ ...formData, tcSubmitted: c })
                      }
                    />
                    <span className="text-sm text-gray-700">
                      {formData.tcSubmitted ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Report Card Submitted</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.reportCardSubmitted}
                    onCheckedChange={(c) =>
                      setFormData({ ...formData, reportCardSubmitted: c })
                    }
                  />
                  <span className="text-sm text-gray-700">
                    {formData.reportCardSubmitted ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500">
                (Optional) Ye section tab use hoga jab student transfer hokar aaye.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-purple-50 py-3">
              <CardTitle className="text-base text-purple-800">
                Academic & Transport
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Class</Label>
                  <Select
                    onValueChange={(v) =>
                      setFormData({ ...formData, class: v })
                    }
                    value={formData.class}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-white h-[200px]">
                      {[
                        "Nursery",
                        "LKG",
                        "UKG",
                        "1",
                        "2",
                        "3",
                        "4",
                        "5",
                        "6",
                        "7",
                        "8",
                        "9",
                        "10",
                        "11",
                        "12",
                      ].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Section</Label>
                  <Input
                    value={formData.section}
                    onChange={(e) =>
                      setFormData({ ...formData, section: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select
                    onValueChange={(v) =>
                      setFormData({ ...formData, category: v })
                    }
                    value={formData.category}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="OBC">OBC</SelectItem>
                      <SelectItem value="SC">SC</SelectItem>
                      <SelectItem value="ST">ST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-orange-50 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base text-orange-800 flex items-center gap-2">
                <Bus className="h-4 w-4" /> Transport
              </CardTitle>

              <div className="flex items-center space-x-2">
                <Label htmlFor="t-mode" className="text-sm cursor-pointer">
                  {formData.transportEnabled ? "Enabled" : "Disabled"}
                </Label>

                {/* ✅ FIXED SWITCH */}
                <Switch
                  id="t-mode"
                  checked={formData.transportEnabled}
                  onCheckedChange={(c) =>
                    setFormData({
                      ...formData,
                      transportEnabled: c,
                      transportId: c ? formData.transportId : "",
                    })
                  }
                />
              </div>
            </CardHeader>

            {formData.transportEnabled && (
              <CardContent className="pt-4">
                <Label>Route</Label>
                <Select
                  onValueChange={(v) =>
                    setFormData({ ...formData, transportId: v })
                  }
                  value={formData.transportId}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Route" />
                  </SelectTrigger>
                  <SelectContent className="bg-white shadow-xl">
                    {transportRoutes.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.route_name} (₹{t.amount})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            )}
          </Card>

          {/* Admission Fee — admission ke samay hi jama. Kul rakam
              class ki fee structure se aati hai; parents jo dein
              (poora / aadha / kuch nahi) wo "Abhi Jama" me bhara
              jata hai, baaki Fees page par Pending Dues me dikhta hai. */}
          <Card>
            <CardHeader className="bg-teal-50 py-3">
              <CardTitle className="text-base text-teal-800 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" /> Admission Fee
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <Label>Kul Admission Fee (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={admFeeTotal}
                  onChange={(e) => setAdmFeeTotal(e.target.value)}
                />
                <p className="text-[10px] text-gray-500">
                  {!formData.class
                    ? "Class chunne par ye rakam Settings → Fee Structure se apne aap aa jayegi — chahein to badal sakte hain."
                    : structureAdmFee == null
                      ? "Is class ki fee structure mili nahi — kul rakam haath se likhein. Pakki fee Settings → Fee Structure me hi save hoti hai."
                      : structureAdmFee === 0
                        ? "Fee Structure me is class ki admission fee 0 lagi hai. Pakki rakam pehle Settings → Fee Structure me lagayein — yahan likhi rakam wahan save nahi hoti."
                        : "Ye rakam Settings → Fee Structure se aayi hai. Yahan badalne se sirf is form ka hisaab badlega — pakki fee wahan hi save hoti hai."}
                </p>
              </div>

              <div className="space-y-1">
                <Label>Abhi Jama (₹) — parents ne diye</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={admFeePaid}
                  onChange={(e) => setAdmFeePaid(e.target.value)}
                />
                <p className="text-[10px] text-gray-500">
                  {admPaidNum > 0 && admTotalNum <= 0
                    ? "Pehle Kul Admission Fee likho — bina kul rakam ke jama save nahi hogi."
                    : admPaidNum > 0 && admBalancePreview > 0
                      ? `Baaki ₹${admBalancePreview} rahega — Fees page par Pending Dues me dikhega.`
                      : admPaidNum > 0 && admBalancePreview === 0
                        ? "Poori admission fee mil jayegi."
                        : admBalancePreview < 0
                          ? "Jama rakam kul fee se zyada hai — rakam sahi karo."
                          : admTotalNum > 0
                            ? "Kuch nahi diya to khaali chhodein — poori rakam Fees page par baaki dikhegi."
                            : "Parents ne admission ke samay jo rakam di, wo yahan likhein. Kuch nahi diya to khaali chhodein."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          className="w-full sm:w-[200px] bg-blue-600 hover:bg-blue-700 text-lg"
          onClick={handleSubmit}
          disabled={loading}
        >
          <Save className="mr-2 h-5 w-5" /> Submit
        </Button>
      </div>

      </>
      )}
    </div>
  );
}
