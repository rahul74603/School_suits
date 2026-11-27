// =============================================================================
// School Guardian Suite — API client (Phase 3 foundation)
// -----------------------------------------------------------------------------
// Ye file client (React) aur Phase 2 server (REST + JWT) ke beech ki neev hai.
// Design ke faisle:
//  * Base URL pehle `VITE_API_URL` env se aata hai. Na ho to staging server
//    (Render free) default hai, taaki bina kisi setup ke app abhi ke live
//    server se baat kar sake. Production build me env se asli URL ayega.
//  * Tokens localStorage me rehte hain — Electron aur Capacitor (Android)
//    dono me localStorage kaam karta hai, isliye ek hi tareeka dono par chalega.
//  * 401 (token expire) par ek baar refresh karke request dobara bhejta hai.
//    Refresh bhi fail ho to session saaf karke `sg:logout` event bhejta hai —
//    AuthProvider usi ko sunkar Login screen par le jata hai.
//  * Ye file kuch import nahi karti (self-contained), taaki bridge types ya
//    purane queryClient se koi takraav na ho.
// =============================================================================

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ||
  // Staging default (Render free par live server). Production me VITE_API_URL
  // env se badal jayega — yahan hardcode sirf isliye hai taaki bina env setup
  // ke bhi build seedha live staging server se jude.
  "https://school-guardian-api.onrender.com";

const ACCESS_TOKEN_KEY = "sg_access_token";
const REFRESH_TOKEN_KEY = "sg_refresh_token";
const USER_KEY = "sg_user";

// Server ke serializeUser() ka jawab — password hash kabhi nahi aata.
export interface ApiUser {
  id: number;
  schoolId: number | null;
  username: string;
  role:
    | "super_admin"
    | "principal"
    | "accountant"
    | "teacher"
    | "staff"
    | "parent";
  name: string | null;
  phone: string | null;
  // DB me 0/1 (integer) ya boolean — dono chal sakte hain, hamesha !! se padho.
  mustChangePassword: number | boolean;
  lastLoginAt: string | null;
  isActive: number | boolean;
  createdAt: string;
}

// /api/auth/me se aane wala school (branding ke liye). Super Admin par null.
export interface ApiSchool {
  id: number;
  name: string;
  // Plans/License (v1.7): plan = "Basic" | "Pro"; licenseExpiry
  // "YYYY-MM-DD" ya null (null = koi expiry nahi).
  plan?: string | null;
  licenseExpiry?: string | null;
  [key: string]: unknown;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(res: AuthResponse): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
  } catch {
    // Storage band ho to session sirf is run ke liye rahega — crash nahi karna.
  }
}

export function saveStoredUser(user: ApiUser): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
  // v3.1: session khatm = GET cache bhi saaf (neeche wala section) —
  // agla user pichle user ka data kabhi na dekhe.
  clearApiCache();
}

// ---------------------------------------------------------------------------
// Error type — server ka { message } hamesha isme milega.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  // Server ka machine-readable code (jaise "LICENSE_EXPIRED") — v1.7 se.
  // Har error me nahi hota; jahan server deta hai wahan page usi se
  // khaas bartav chun sakta hai (sirf message ke bharose nahi).
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// License band hone ka code (server routes.ts ka license guard, v1.7).
export const LICENSE_EXPIRED_CODE = "LICENSE_EXPIRED";

async function readError(res: Response): Promise<ApiError> {
  let message = `Request fail (${res.status})`;
  let code: string | undefined;
  try {
    const data = await res.json();
    if (data && typeof data.message === "string") message = data.message;
    if (data && typeof data.code === "string") code = data.code;
  } catch {
    // JSON nahi aaya — status wala message hi kaafi hai.
  }
  const error = new ApiError(res.status, message, code);
  // License khatm: App ko turant lock screen par jana hai — event se
  // AuthProvider ko khabar do (sg:logout wala hi pattern). Session
  // saaf NAHI karte: logout/login ke raste khule rehte hain, sirf
  // data band hai.
  if (res.status === 403 && code === LICENSE_EXPIRED_CODE) {
    try {
      window.dispatchEvent(new CustomEvent("sg:license-expired"));
    } catch {
      // ignore
    }
  }
  return error;
}

// ---------------------------------------------------------------------------
// Refresh — ek hi samay par ek hi refresh chalega (concurrent 401s ke liye).
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as AuthResponse;
        saveSession(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function notifySessionExpired(): void {
  clearSession();
  try {
    window.dispatchEvent(new CustomEvent("sg:logout"));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// GET cache (v3.1) — stale-while-revalidate, localStorage par
// -----------------------------------------------------------------------------
// Masla (user ki shikayat): "har bar app close krne k bad data fir se load
// hota hai, refresh chalta hai bohut der tak". Wajah: har GET har baar
// network se aata tha — Render free server ki cold-start + slow network
// par har screen 5-30 second tak ghumti rehti thi. Koi cache hi nahi tha.
//
// Hal (transparent — pages me KOI badlav nahi, sab apiFetch ke andar):
//  * GET ka safal jawab localStorage me rakho (key = user+school scope
//    + path; dusre user/school ka data kabhi nahi milta).
//  * TTL 5 minute: uske andar wahi GET dobara aaye to network par
//    JAO HI MAT — cache se turant jawab (app band karke kholo tab bhi,
//    kyunki localStorage bana rehta hai).
//  * TTL ke baad: PEHLE cache wala jawab turant do (screen na ruke),
//    saath me background me taaza data lao, cache update karo. Taaza
//    data purane se alag ho to `sg-data-refreshed` window event
//    bhejo (detail: { path }) — koi page chahe to khud sun kar
//    refresh kar sakta hai.
//    ⚠️ App-level AUTO-REMONT nahi rakha: background refresh par
//    chalti screen ko remount karne se aadha bhara hua form (jaise
//    Admission form) udd sakta hai. Taazgi ka pakka rasta TTL +
//    mutation-invalidation hai — agali baar screen khulte hi taaza
//    data milta hai, aur khud kiya hua badlav turant dikhta hai.
//  * Koi bhi POST/PUT/PATCH/DELETE safal ho to usi resource-family
//    ki (aur usse judi families ki) cache entries uda do — apna
//    badlav kabhi purana na dikhe.
//  * Login/logout par poora cache saaf (clearSession + login neeche).
//  * Sirf safal GET JSON cache hota hai. Nahi hota: /api/auth/*,
//    /api/app-version (update check hamesha taaza), /api/export/*
//    (backup — bohut bada), */file (documents ki base64 — bohut
//    badi), aur 1MB se badi koi bhi entry.
// ---------------------------------------------------------------------------

const CACHE_PREFIX = "sg_cache_v1:";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRY_CHARS = 1024 * 1024; // 1MB

interface CacheEntry {
  t: number;
  d: unknown;
}

function cacheScope(): string {
  const u = getStoredUser();
  return u ? `u${u.id}:s${u.schoolId ?? 0}` : "anon";
}

function cacheKeyFor(path: string): string {
  return `${CACHE_PREFIX}${cacheScope()}|${path}`;
}

function cacheablePath(path: string): boolean {
  if (path.startsWith("/api/auth")) return false;
  if (path.startsWith("/api/app-version")) return false;
  if (path.startsWith("/api/export")) return false;
  if (path.includes("/file")) return false;
  return true;
}

function readCacheEntry(path: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKeyFor(path));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.t !== "number" || !("d" in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCacheEntry(path: string, data: unknown): void {
  if (data === undefined) return;
  try {
    const raw = JSON.stringify({ t: Date.now(), d: data } as CacheEntry);
    if (raw.length > CACHE_MAX_ENTRY_CHARS) return; // bohut badi entry skip
    const key = cacheKeyFor(path);
    try {
      localStorage.setItem(key, raw);
    } catch {
      // Quota bhar gaya ho to sabse purani aadhi entries uda kar
      // ek baar dobara koshish — cache best-effort hai, crash nahi.
      evictOldestCacheEntries();
      localStorage.setItem(key, raw);
    }
  } catch {
    // JSON na bane ya storage band ho — cache chup chaap skip.
  }
}

function allCacheKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys;
}

function evictOldestCacheEntries(): void {
  try {
    const entries = allCacheKeys()
      .map((k) => {
        let t = 0;
        try {
          t = (JSON.parse(localStorage.getItem(k) ?? "") as CacheEntry).t || 0;
        } catch {
          // kharab entry — sabse purani maan kar uda do
        }
        return { k, t };
      })
      .sort((a, b) => a.t - b.t);
    const drop = Math.max(1, Math.ceil(entries.length / 2));
    for (let i = 0; i < drop && i < entries.length; i++) {
      localStorage.removeItem(entries[i].k);
    }
  } catch {
    // ignore
  }
}

/** Poora GET cache saaf — login/logout/session-expire par. */
export function clearApiCache(): void {
  try {
    for (const k of allCacheKeys()) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

// Ek mutation kin families ko purana kar deta hai: apni family +
// ye judi hui families (jaise payment bane to student ki fees-sthiti
// aur parent ka overview bhi badal jata hai).
const RELATED_FAMILIES: Record<string, string[]> = {
  students: ["parent"],
  payments: ["students", "fees", "fee-structures", "parent", "financial"],
  "fee-structures": ["fees", "students", "parent"],
  fees: ["students", "parent"],
  attendance: ["students", "parent"],
  exams: ["parent"],
  marks: ["parent"],
  homework: ["parent"],
  leaves: ["parent"],
  notices: ["parent"],
  timetable: ["parent"],
  staff: ["salary", "financial"],
  salary: ["financial"],
  expenses: ["financial"],
};

function familyOf(path: string): string | null {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean); // ["api", "students", ...]
  return parts.length >= 2 && parts[0] === "api" ? parts[1] : null;
}

function invalidateCacheForMutation(path: string): void {
  const fam = familyOf(path);
  if (!fam) return;
  const targets = new Set<string>([fam, ...(RELATED_FAMILIES[fam] ?? [])]);
  try {
    for (const k of allCacheKeys()) {
      // key: sg_cache_v1:<scope>|<path> — path ka family nikalo.
      const p = k.slice(k.indexOf("|") + 1);
      const pf = familyOf(p);
      if (pf && targets.has(pf)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

// Ek hi path ki background revalidation ek samay par ek hi chalegi.
const revalidatingPaths = new Set<string>();

function revalidateInBackground<T>(path: string, opts: ApiFetchOptions): void {
  if (revalidatingPaths.has(path)) return;
  revalidatingPaths.add(path);
  performRequest<T>(path, opts)
    .then((fresh) => {
      const prev = readCacheEntry(path);
      writeCacheEntry(path, fresh);
      // Data asal me badla ho tabhi khabar do — bekaar ke event par
      // sunne wale pages fizool refresh na karein.
      if (prev && JSON.stringify(prev.d) !== JSON.stringify(fresh)) {
        try {
          window.dispatchEvent(
            new CustomEvent("sg-data-refreshed", { detail: { path } }),
          );
        } catch {
          // ignore
        }
      }
    })
    .catch(() => {
      // Background refresh fail — purana cache hi chalega, koi
      // error nahi dikhana (user ne kuch manga hi nahi tha).
    })
    .finally(() => {
      revalidatingPaths.delete(path);
    });
}

// ---------------------------------------------------------------------------
// performRequest — asal network request (refresh + retry ke saath).
// Upar wala apiFetch iske chaaron taraf cache ki parat lagata hai.
// ---------------------------------------------------------------------------

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  // Internal: refresh ke baad ki retry ko doosri baar refresh se rokta hai.
  _retried?: boolean;
}

async function performRequest<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body } = opts;
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Server se sampark nahi ho paya. Internet check karo.");
  }

  // Access token expire ho gaya — ek baar refresh karke dobara koshish.
  if (res.status === 401 && !opts._retried && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) {
      return performRequest<T>(path, { ...opts, _retried: true });
    }
    notifySessionExpired();
    throw new ApiError(401, "Session expired. Please login again.");
  }

  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// apiFetch — har authenticated request yahin se jayegi (cache wali parat).
// ---------------------------------------------------------------------------

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();

  if (method === "GET" && cacheablePath(path)) {
    const hit = readCacheEntry(path);
    if (hit) {
      if (Date.now() - hit.t < CACHE_TTL_MS) {
        // Taaza cache — network par jana hi nahi.
        return hit.d as T;
      }
      // Purana cache: turant wahi do (screen na ruke), peeche taaza lao.
      revalidateInBackground<T>(path, opts);
      return hit.d as T;
    }
    const fresh = await performRequest<T>(path, opts);
    writeCacheEntry(path, fresh);
    return fresh;
  }

  const result = await performRequest<T>(path, opts);

  if (method !== "GET") {
    // Naya login = nayi shuruaat: purana cache (kisi aur ka bhi ho
    // sakta hai) saaf. Logout clearSession se saaf hota hai.
    if (method === "POST" && path === "/api/auth/login") {
      clearApiCache();
    } else if (!path.startsWith("/api/auth")) {
      // Apna badlav turant dikhe — judi families ka cache uda do.
      invalidateCacheForMutation(path);
    }
  }

  return result;
}

// Chhote helpers — migration batches me pages inhi ko use karengi.
export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path);
export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body });
export const apiPut = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body });
export const apiPatch = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body });
export const apiDel = <T = unknown>(path: string) =>
  apiFetch<T>(path, { method: "DELETE" });
