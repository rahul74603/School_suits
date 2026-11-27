// =============================================================================
// 👑 Master App — build flag (v2.2)
// -----------------------------------------------------------------------------
// Master App teesra ALAG app hai (user ka design, 2026-11-27): sirf Super
// Admin ke liye. Isme teeno apps ka control hai — saare schools ki list,
// school approve/block (Active/Inactive), har school ke accounts
// (Principal ka user/password banana + reset), School Code, aur test ke
// liye Demo School (nakli data wala school) banane ka button.
//
// VITE_MASTER_APP=1 se bana web build "Master App" banta hai: App.tsx ka
// Gate us haalat me super_admin ko MasterShell deta hai (sirf Schools
// screen + Demo School button); koi dusra role login kare to "ye app
// sirf Master (Super Admin) ke liye hai" wali screen. Flag na ho to aam
// school app hai — bartav me ZEERO farak (Super Admin school app me bhi
// Schools screen pehle ki tarah dekh sakta hai).
// Android me ye build `master` Gradle flavor ke saath jata hai
// (applicationId com.schoolguardian.master) — workflow dekho.
// lib/parentApp.ts ka jodidaar — wahi pattern, wahi imaandari: gate
// render/route level par hai, bundle me saajha code rehta hai.
// =============================================================================

export const MASTER_APP: boolean =
  (import.meta as any).env?.VITE_MASTER_APP === "1";
