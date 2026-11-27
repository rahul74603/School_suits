// =============================================================================
// openExternal (v3.1) — bahari link app ke ANDAR kholo, Chrome me nahi
// -----------------------------------------------------------------------------
// Masla (user ki shikayat): "kuch kuch chizo par click kia to sidha Chrome
// khul raha hai". Wajah: window.open(url, "_blank") Capacitor ke Android
// WebView me aksar poori Chrome app khol deta hai — user app se bahar
// fenk diya jata hai aur wapas aana mushkil lagta hai.
//
// Hal: native (Android) par @capacitor/browser ka Browser.open — ye
// ek in-app Custom Tab kholta hai jo app ke andar hi rehta hai aur
// back dabate hi user seedha app me wapas aa jata hai. Plugin na mile
// ya web/Electron build ho to purana window.open hi fallback hai
// (wahan Chrome khulna hi sahi bartav hai).
//
// Dependency: "@capacitor/browser" package.json me joda gaya hai
// (v3.1). Plugin ka import dynamic hai — package/native plugin kisi
// wajah se na mile to bhi app crash nahi hogi, fallback chalega.
//
// Return: true = link kisi khaane me khul gaya (Browser ya nayi
// window); false = window.open bhi block ho gaya (caller chahe to
// download jaisa doosra rasta le sakta hai — Staff/StudentProfile ke
// document fallback yahi karte hain).
// =============================================================================

import { Capacitor } from "@capacitor/core";

type BrowserModule = typeof import("@capacitor/browser");

let browserModulePromise: Promise<BrowserModule | null> | null = null;

function loadBrowserModule(): Promise<BrowserModule | null> {
  if (!browserModulePromise) {
    browserModulePromise = import("@capacitor/browser").catch(() => null);
  }
  return browserModulePromise;
}

export async function openExternal(url: string): Promise<boolean> {
  if (!url) return false;

  // http(s) link + native app → in-app Custom Tab (Browser plugin).
  // blob:/data: URLs Browser plugin nahi khol sakta — unke liye
  // seedha window.open wala purana rasta hi chalega.
  const isHttp = /^https?:\/\//i.test(url);
  if (isHttp && Capacitor.isNativePlatform()) {
    const mod = await loadBrowserModule();
    if (mod?.Browser) {
      try {
        await mod.Browser.open({ url });
        return true;
      } catch {
        // Plugin fail — neeche window.open fallback.
      }
    }
  }

  try {
    const win = window.open(url, "_blank");
    return win != null;
  } catch {
    return false;
  }
}
