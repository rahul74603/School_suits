import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertStudent, type Student } from "@shared/schema";
import { z } from "zod";

export function useStudents(params?: { class?: string; section?: string; search?: string }) {
  const queryKey = params ? [api.students.list.path, params] : [api.students.list.path];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = buildUrl(api.students.list.path);
      const searchParams = new URLSearchParams();
      if (params?.class && params.class !== "all") searchParams.append("class", params.class);
      if (params?.section && params.section !== "all") searchParams.append("section", params.section);
      if (params?.search) searchParams.append("search", params.search);
      
      const fullUrl = `${url}?${searchParams.toString()}`;
      const res = await fetch(fullUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return api.students.list.responses[200].parse(await res.json());
    },
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: [api.students.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.students.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch student");
      return api.students.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStudent) => {
      const res = await fetch(api.students.create.path, {
        method: api.students.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create student");
      return api.students.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertStudent>) => {
      const url = buildUrl(api.students.update.path, { id });
      const res = await fetch(url, {
        method: api.students.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update student");
      return api.students.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.students.get.path, variables.id] });
    },
  });
}

export function useDeactivateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.students.deactivate.path, { id }), { method: api.students.deactivate.method, credentials: "include" });
      if (!res.ok) throw new Error(res.status === 403 ? "You are not allowed to deactivate students" : "Failed to deactivate student");
      return api.students.deactivate.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.students.list.path] }),
  });
}

export function usePromoteStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { studentIds: number[]; targetClass: string }) => {
      const res = await fetch(api.students.promote.path, {
        method: api.students.promote.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to promote students");
      return api.students.promote.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.students.list.path] });
    },
  });
}
