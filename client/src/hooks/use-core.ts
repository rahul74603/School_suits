import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useActiveSession() {
  return useQuery({
    queryKey: [api.sessions.active.path],
    queryFn: async () => {
      const response = await fetch(api.sessions.active.path, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load the active academic session");
      return api.sessions.active.responses[200].parse(await response.json());
    },
  });
}

export function useSchool(schoolId?: number) {
  return useQuery({
    queryKey: [api.schools.get.path, schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const response = await fetch(buildUrl(api.schools.get.path, { id: schoolId! }), { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load school details");
      return api.schools.get.responses[200].parse(await response.json());
    },
  });
}

export function getApiError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
