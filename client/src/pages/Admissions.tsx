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
import {
  UserPlus,
  Bus,
  Save,
  RefreshCw,
  AlertCircle,
  School,
} from "lucide-react";

export default function Admissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);

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

  const loadInitialData = async () => {
    try {
      const routes = await (window as any).electronAPI.invoke("get-transport");
      setTransportRoutes(routes || []);
      await refreshAdmissionNumber();
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAdmissionNumber = async () => {
    try {
      const nextNum = await (window as any).electronAPI.invoke(
        "get-next-admission-no"
      );
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

    setLoading(true);
    try {
      // Duplicate check
      const isDuplicate = await (window as any).electronAPI.invoke(
        "check-admission-duplicate",
        formData.admissionNumber
      );

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
      await (window as any).electronAPI.invoke("create-student", formData);

      toast({ title: "Success", description: "Admission Created Successfully!" });

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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <UserPlus className="h-8 w-8 text-blue-600" /> New Admission
        </h1>

        <Button variant="outline" size="sm" onClick={refreshAdmissionNumber}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh ID
        </Button>
      </div>

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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
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
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          className="w-[200px] bg-blue-600 hover:bg-blue-700 text-lg"
          onClick={handleSubmit}
          disabled={loading}
        >
          <Save className="mr-2 h-5 w-5" /> Submit
        </Button>
      </div>
    </div>
  );
}
