import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertFeeStructure } from "@shared/schema";

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertFeeStructure>) => {
      const response = await fetch(buildUrl(api.fees.structures.update.path, { id }), { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!response.ok) throw new Error(response.status === 403 ? "You are not allowed to edit fee structures" : "Failed to update fee structure");
      return api.fees.structures.update.responses[200].parse(await response.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.fees.structures.list.path] }),
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildUrl(api.fees.structures.delete.path, { id }), { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(response.status === 409 ? "This fee structure is already used by fee records" : "Failed to delete fee structure");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.fees.structures.list.path] }),
  });
}
