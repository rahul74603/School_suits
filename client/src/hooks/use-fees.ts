import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertFeeStructure, type InsertFeePayment } from "@shared/schema";

export function useFeeStructures() {
  return useQuery({
    queryKey: [api.fees.structures.list.path],
    queryFn: async () => {
      const res = await fetch(api.fees.structures.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch fee structures");
      return api.fees.structures.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFeeStructure) => {
      const res = await fetch(api.fees.structures.create.path, {
        method: api.fees.structures.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create fee structure");
      return api.fees.structures.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fees.structures.list.path] });
    },
  });
}

export function usePayments(params?: { studentId?: string }) {
  return useQuery({
    queryKey: [api.fees.payments.list.path, params],
    queryFn: async () => {
      const url = buildUrl(api.fees.payments.list.path);
      const searchParams = new URLSearchParams();
      if (params?.studentId) searchParams.append("studentId", params.studentId);
      
      const fullUrl = params?.studentId ? `${url}?${searchParams.toString()}` : url;
      const res = await fetch(fullUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return api.fees.payments.list.responses[200].parse(await res.json());
    },
  });
}

export function useCollectFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFeePayment) => {
      const res = await fetch(api.fees.payments.create.path, {
        method: api.fees.payments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return api.fees.payments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.fees.payments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.fees.payments.defaulters.path] });
    },
  });
}

export function useDefaulters(params?: { class?: string; month: string }) {
  return useQuery({
    queryKey: [api.fees.payments.defaulters.path, params],
    queryFn: async () => {
      if (!params?.month) return [];
      const url = buildUrl(api.fees.payments.defaulters.path);
      const searchParams = new URLSearchParams();
      if (params.class) searchParams.append("class", params.class);
      searchParams.append("month", params.month);
      
      const fullUrl = `${url}?${searchParams.toString()}`;
      const res = await fetch(fullUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch defaulters");
      return api.fees.payments.defaulters.responses[200].parse(await res.json());
    },
    enabled: !!params?.month,
  });
}
