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
// apiFetch — har authenticated request yahin se jayegi.
// ---------------------------------------------------------------------------

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  // Internal: refresh ke baad ki retry ko doosri baar refresh se rokta hai.
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(
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
      return apiFetch<T>(path, { ...opts, _retried: true });
    }
    notifySessionExpired();
    throw new ApiError(401, "Session expired. Please login again.");
  }

  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Chhote helpers — migration batches me pages inhi ko use karengi.
export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path);
export const apiPost = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body });
export const apiPut = <T = unknown>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body });
export const apiDel = <T = unknown>(path: string) =>
  apiFetch<T>(path, { method: "DELETE" });
