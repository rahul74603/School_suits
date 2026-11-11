import type { CapacitorConfig } from '@capacitor/cli';

// School Guardian Suite — Capacitor config (DRAFT, Phase 4 taiyaari)
// appId / appName Electron (electron-builder) wale hi rakhe hain taaki
// PC aur Android par ek hi pehchan rahe.
// webDir: vite.config.ts ke build.outDir se verify kiya hua hai
// (root: client, outDir: dist/public). Agar vite config kabhi badle to
// ye bhi saath badalna hoga, warna APK khali khulega.
const config: CapacitorConfig = {
  appId: 'com.schoolguardian.suite',
  appName: 'School Guardian Suite',
  webDir: 'dist/public',
};

export default config;
