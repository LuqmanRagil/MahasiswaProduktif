import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { store } from "@/data";
import { invalidateTable, useRows } from "@/hooks/useData";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";

export function useCategories() {
  return useRows("budget_categories", { order: [{ column: "position" }, { column: "name" }] });
}

/** Buat 10 kategori bawaan (lewati yang namanya sudah ada). */
export function useCreateDefaultCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const existing = await store.list("budget_categories");
      const names = new Set(existing.map((c) => c.name.toLowerCase()));
      const rows = DEFAULT_EXPENSE_CATEGORIES.filter((c) => !names.has(c.name.toLowerCase())).map((c, i) => ({
        name: c.name,
        icon: c.icon,
        position: existing.length + i,
      }));
      return store.insert("budget_categories", rows);
    },
    onSuccess: () => invalidateTable(qc, "budget_categories"),
  });
}

const LAST_KEY = "mp:kategori-terakhir";
export function getLastCategory(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
export function setLastCategory(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* abaikan */
  }
}
