import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  PARENT_APP_DOWNLOAD_URL,
  buildParentAppInviteUrl,
  normalizeMobile,
} from "@/lib/parentApp";
import { MessageCircle } from "lucide-react";

// =============================================================================
// 📲 "Parent ko App Link bhejo (WhatsApp)" button (v2.1)
// -----------------------------------------------------------------------------
// Admission ke baad aur Student Profile par istemal hota hai. Parent ke
// number (student ka `contact`) par wa.me link khulta hai — sandesh pehle
// se likha hota hai: school ka naam, bacche ka naam, Parent App ka
// download link aur login ka sanket (username = mobile number, password
// = bacche ka Admission No. — server admission par parent account yahi
// bana deta hai).
//
// Imaandari ke niyam:
//  - Download link set na ho (lib/parentApp.ts me PARENT_APP_DOWNLOAD_URL
//    khali) to button dabane par saaf kehta hai "link abhi set nahi
//    hai" — koi nakli link kabhi nahi banta.
//  - Contact number theek na ho to wahi bata deta hai.
// =============================================================================

interface Props {
  contact: string | null | undefined;
  childName: string;
  admissionNo: string;
  schoolName?: string | null;
  className?: string;
}

export default function ParentAppInviteButton({
  contact,
  childName,
  admissionNo,
  schoolName,
  className,
}: Props) {
  const { toast } = useToast();

  const handleClick = () => {
    if (!PARENT_APP_DOWNLOAD_URL) {
      toast({
        title: "Parent App ka link abhi set nahi hai",
        description:
          "Pehle Parent App ka download link set karna hoga — uske baad ye button parent ko WhatsApp par link bhejega.",
        variant: "destructive",
      });
      return;
    }
    if (!normalizeMobile(contact)) {
      toast({
        title: "Parent ka mobile number nahi mila",
        description:
          "Is student ke record me sahi contact number nahi hai — pehle number theek karein.",
        variant: "destructive",
      });
      return;
    }
    const url = buildParentAppInviteUrl(contact, {
      schoolName: schoolName || "School Guardian Suite",
      childName,
      admissionNo,
    });
    if (!url) {
      toast({
        title: "Link nahi ban paya",
        description: "Contact number dobara jaanch lein.",
        variant: "destructive",
      });
      return;
    }
    window.open(url, "_blank");
  };

  return (
    <Button
      size="sm"
      className={`min-h-[40px] bg-green-600 hover:bg-green-700 ${className ?? ""}`}
      onClick={handleClick}
    >
      <MessageCircle className="h-4 w-4 mr-2" /> Parent ko App Link bhejo
      (WhatsApp)
    </Button>
  );
}
