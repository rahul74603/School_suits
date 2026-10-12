import { useQuery } from "@tanstack/react-query";
import { useActiveSession } from "@/hooks/use-core";
import { useAuth } from "@/hooks/use-auth";

export function classOrderWeight(name: string): number {
  const clean = name.trim().toLowerCase();
  if (clean === "nursery") return -3;
  if (clean === "lkg" || clean === "kg1") return -2;
  if (clean === "ukg" || clean === "kg2") return -1;
  const num = Number(clean);
  if (!Number.isNaN(num)) return num;
  return 100;
}

export function useSchoolCatalog() {
  const { data: user } = useAuth();
  const activeSession = useActiveSession();
  const sessionId = activeSession.data?.id;

  const dbClasses = useQuery<{ id: number; name: string; sessionId: number }[]>({
    queryKey: ["/api/management/classes", sessionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/management/classes${sessionId ? `?sessionId=${sessionId}` : ""}`,
        { credentials: "include" },
      );
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const dbSections = useQuery<{ id: number; name: string; classId: number; sessionId: number }[]>({
    queryKey: ["/api/management/sections", sessionId],
    queryFn: async () => {
      const res = await fetch(
        `/api/management/sections${sessionId ? `?sessionId=${sessionId}` : ""}`,
        { credentials: "include" },
      );
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const subjects = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!user,
  });

  const classOptions: string[] =
    dbClasses.data && dbClasses.data.length > 0
      ? Array.from(
          new Set(
            [...dbClasses.data]
              .sort((a, b) => classOrderWeight(a.name) - classOrderWeight(b.name))
              .map((c) => String(c.name).trim()),
          ),
        )
      : ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const sectionSet = new Set<string>(["A", "B", "C", "D"]);
  for (const sec of dbSections.data ?? []) {
    const clean = String(sec.name ?? "").trim();
    if (clean && clean.length <= 4) {
      sectionSet.add(clean);
    }
  }
  const sectionOptions = Array.from(sectionSet).sort();

  const getSectionsForClass = (className?: string): string[] => {
    if (!className || className === "all" || !dbClasses.data?.length || !dbSections.data?.length) {
      return sectionOptions;
    }
    const matchingClassIds = new Set(
      dbClasses.data
        .filter((c) => String(c.name).trim() === className.trim())
        .map((c) => c.id),
    );
    const classSecs = (dbSections.data ?? [])
      .filter((s) => matchingClassIds.has(s.classId))
      .map((s) => String(s.name).trim())
      .filter((n) => n && n.length <= 4);
    if (classSecs.length > 0) {
      return Array.from(new Set(classSecs)).sort();
    }
    return sectionOptions;
  };

  const subjectList = subjects.data ?? [];
  const subjectMap = new Map(subjectList.map((s) => [s.id, s]));

  return {
    activeSession: activeSession.data,
    dbClasses: dbClasses.data ?? [],
    dbSections: dbSections.data ?? [],
    classOptions,
    sectionOptions,
    getSectionsForClass,
    subjects: subjectList,
    subjectMap,
  };
}
