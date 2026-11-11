import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  apiPost,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
  saveStoredUser,
  type ApiSchool,
  type ApiUser,
  type AuthResponse,
} from "./api";
import { queryClient } from "./queryClient";

// =============================================================================
// AuthProvider — poore app ka login state (Phase 3 foundation)
// -----------------------------------------------------------------------------
// App me pehle se koi global store nahi hai; React Context hi sabse halka aur
// natural tareeka hai. State:
//   user    — login kiya hua user (null = login nahi)
//   school  — /api/auth/me se aaya school (branding ke liye; super_admin par null)
//   loading — boot par purana session check ho raha hai
// Boot par: saved token ho to /api/auth/me se verify; fail ho to session saaf.
// api.ts ka `sg:logout` event (refresh fail) bhi yahin suna jata hai.
// =============================================================================

interface AuthContextValue {
  user: ApiUser | null;
  school: ApiSchool | null;
  loading: boolean;
  // License band hai ya nahi (v1.7) — do raaston se pakka hota hai:
  // (1) /api/auth/me ke school ki licenseExpiry beet chuki ho, ya
  // (2) kisi data-API se 403 LICENSE_EXPIRED aaya ho (api.ts ka
  // `sg:license-expired` event). App ka Gate isi par lock screen
  // dikhata hai. super_admin par hamesha false.
  licenseExpired: boolean;
  login: (username: string, password: string) => Promise<ApiUser>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// License expiry beet gayi? (server isLicenseExpired wala hi niyam:
// "YYYY-MM-DD" string tulna; expiry wale DIN tak chaalu, uske baad band.)
export function isLicenseExpiredValue(
  licenseExpiry: string | null | undefined,
): boolean {
  if (!licenseExpiry) return false;
  const today = new Date().toISOString().slice(0, 10);
  return licenseExpiry < today;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [school, setSchool] = useState<ApiSchool | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseBlocked, setLicenseBlocked] = useState(false);
  const bootedRef = useRef(false);

  const applyMe = useCallback(
    (me: { user: ApiUser; school: ApiSchool | null }) => {
      setUser(me.user);
      setSchool(me.school ?? null);
      saveStoredUser(me.user);
    },
    [],
  );

  const endSession = useCallback(() => {
    clearSession();
    setUser(null);
    setSchool(null);
    setLicenseBlocked(false);
    // Purane user ke cached data naye user ko kabhi na dikhe.
    queryClient.clear();
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await apiFetch<{ user: ApiUser; school: ApiSchool | null }>(
      "/api/auth/me",
    );
    applyMe(me);
  }, [applyMe]);

  // Boot: saved session verify karo.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    (async () => {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      // Turant ke liye saved user dikha sakte the, lekin pehle server se
      // pakka karo — token expire/revoke ho to Login par hi jana sahi hai.
      setUser(getStoredUser());
      try {
        await refreshMe();
      } catch {
        endSession();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe, endSession]);

  // apiFetch ka session-expire signal.
  useEffect(() => {
    const onExpired = () => endSession();
    window.addEventListener("sg:logout", onExpired);
    return () => window.removeEventListener("sg:logout", onExpired);
  }, [endSession]);

  // apiFetch ka license-expired signal (v1.7): koi data-API 403
  // LICENSE_EXPIRED de to poori app lock screen par chali jaye.
  useEffect(() => {
    const onLicense = () => setLicenseBlocked(true);
    window.addEventListener("sg:license-expired", onLicense);
    return () => window.removeEventListener("sg:license-expired", onLicense);
  }, []);

  const licenseExpired =
    user?.role !== "super_admin" &&
    (licenseBlocked || isLicenseExpiredValue(school?.licenseExpiry));

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await apiPost<AuthResponse>("/api/auth/login", {
        username,
        password,
      });
      saveSession(res);
      setUser(res.user);
      // School branding /me se pakka karke le aao (login jawab me school
      // nahi aata). Fail ho to login phir bhi safal — branding baad me ayegi.
      try {
        await refreshMe();
      } catch {
        setSchool(null);
      }
      return res.user;
    },
    [refreshMe],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout", {
        refreshToken: getRefreshToken() ?? undefined,
      });
    } catch {
      // Server tak baat na bhi pahunche to local session band karna hi hai.
    }
    endSession();
  }, [endSession]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      // Server purane saare sessions band karke NAYE tokens deta hai —
      // jawab ko nayi session ki tarah save karna lazmi hai.
      const res = await apiPost<AuthResponse>("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      saveSession(res);
      setUser(res.user);
      saveStoredUser(res.user);
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        school,
        loading,
        licenseExpired,
        login,
        logout,
        changePassword,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
