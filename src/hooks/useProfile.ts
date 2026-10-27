import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { store } from "@/data";
import type { Profile } from "@/types/db";

export function useProfile(enabled = true) {
  return useQuery({ queryKey: ["profile"], queryFn: () => store.getProfile(), enabled, staleTime: 60_000 });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>) => store.updateProfile(patch),
    onSuccess: (p) => qc.setQueryData(["profile"], p),
  });
}
