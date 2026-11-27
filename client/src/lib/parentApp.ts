// =============================================================================
// 👨‍👩‍👧 Parent App — EK HI JAGAH (v2.1)
// -----------------------------------------------------------------------------
// Parent App ek ALAG app hai (user ka pakka design, 2026-11-27): admission ke
// samay parent ke number par download link jata hai, parent wahi app lagata
// hai aur usme SIRF apne bacche ki jaankari (attendance / fees / notices /
// result / timetable) dekhta hai — school (office) app me ghusne ki use koi
// zarurat nahi. Server aur login wahi hai (parent role, username = mobile
// number, GET /api/parent/overview); farak sirf build ka hai.
//
// Is file me usi se judi teen cheezein ek hi jagah rakhi hain:
//   1. PARENT_APP — build-time flag (neeche)
//   2. PARENT_APP_DOWNLOAD_URL — download link ka EK matr source (neeche)
//   3. WhatsApp invite ka link/message banane wale helpers
// =============================================================================

// -----------------------------------------------------------------------------
// 1) BUILD FLAG — VITE_PARENT_APP=1 se bana web build "Parent App" banta hai:
//    App.tsx ka Gate us haalat me sirf parent login -> Parent Home deta hai
//    (koi sidebar nahi, koi staff/school route nahi; dusra role login kare
//    to "ye app sirf parents ke liye hai" wali screen). Flag na ho to ye
//    aam school app hai — bartav me ZEERO farak.
//    Android me ye build `parent` Gradle flavor ke saath jata hai
//    (applicationId com.schoolguardian.parent) — workflow dekho.
// -----------------------------------------------------------------------------
export const PARENT_APP: boolean =
  (import.meta as any).env?.VITE_PARENT_APP === "1";

// -----------------------------------------------------------------------------
// 2) 📥 PARENT APP DOWNLOAD LINK — EK HI JAGAH
//    ⚠️ ABHI KHALI HAI ("") — Parent App ka .apk jab kisi public jagah
//    (GitHub Release / hosting) par live ho jaye, to uska seedha link
//    SIRF YAHAN bharna hai. App ke saare "Parent ko App Link bhejo"
//    button yahi se link lete hain.
//    Link khali ho to button jhooth nahi bolta — dabane par saaf kehta
//    hai "link abhi set nahi hai" (koi nakli link kabhi nahi jata).
// -----------------------------------------------------------------------------
export const PARENT_APP_DOWNLOAD_URL = "https://github.com/rahul74603/School_suits/releases/download/v2.1/school-guardian-parent-v2.1.apk";

// -----------------------------------------------------------------------------
// 3) Helpers — mobile saaf karna + WhatsApp invite
// -----------------------------------------------------------------------------

// Mobile number ko ek saaf 10-digit roop me lao: sirf digits, aage ka
// 91 (country code) ya 0 hata kar. 10 digit na bane to "" (galat number
// par account/link banana sahi nahi).
export function normalizeMobile(
  contact: string | null | undefined,
): string {
  const digits = String(contact ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return "";
}

// wa.me ke liye number: 10-digit par 91 prefix (Fees page ke WhatsApp
// reminder wala hi niyam). Number theek na ho to "".
export function whatsAppNumber(contact: string | null | undefined): string {
  const mobile = normalizeMobile(contact);
  return mobile ? `91${mobile}` : "";
}

// Parent ko bhejne wala poora WhatsApp link (wa.me + pehle se likha
// sandesh). Link set na ho ya number galat ho to null — bulane wala
// imaandari se "link set nahi hai" / "number nahi mila" batayega.
export function buildParentAppInviteUrl(
  contact: string | null | undefined,
  opts: { schoolName: string; childName: string; admissionNo: string },
): string | null {
  if (!PARENT_APP_DOWNLOAD_URL) return null;
  const number = whatsAppNumber(contact);
  if (!number) return null;
  const schoolName = opts.schoolName || "School Guardian Suite";
  const message = [
    `Namaste! 🙏`,
    `${schoolName} me aapke bacche ${opts.childName} ka admission ho gaya hai.`,
    ``,
    `Hamara Parent App download karein — isme aap apne bacche ki attendance, fees, notices aur result dekh sakte hain:`,
    PARENT_APP_DOWNLOAD_URL,
    ``,
    `Login kaise karein:`,
    `• Username: aapka yehi mobile number`,
    `• Password: bacche ka Admission No. (${opts.admissionNo})`,
    ``,
    `Dhanyavaad,`,
    schoolName,
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
