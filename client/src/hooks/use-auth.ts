import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "staff" | "teacher" | "accountant";
  name: string;
  schoolId: number;
}

const authQueryKey = ["/api/auth/me"];

export function useAuth() {
  return useQuery<AuthUser | null>({
    queryKey: authQueryKey,
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Unable to verify session");
      const body = await response.json() as { user: AuthUser };
      return body.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 401) {
        throw new Error("Unable to log out");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(authQueryKey, null);
    },
  });
}
