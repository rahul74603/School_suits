import { PARENT_APP } from "@/lib/parentApp";
import { MASTER_APP } from "@/lib/masterApp";

// Is build ki apni pehchan — TEENO apps ke liye ek hi jagah (v3.0).
// Jab naya release bane to version yahi badlega aur build.gradle ka
// versionCode bhi yahi number hoga (dono ka milan zaroori hai —
// server wala code isse bada ho tabhi update ka sandesh aata hai).
export const APP_VERSION_CODE = 17;
export const APP_VERSION_NAME = "3.3";

// Ye build kis app ki hai — server par /api/app-version?app= ke
// liye. Flags build-time par tay hote hain (v2.2 ka 3-app split).
export const APP_FLAVOR: "school" | "parent" | "master" = MASTER_APP
  ? "master"
  : PARENT_APP
    ? "parent"
    : "school";
