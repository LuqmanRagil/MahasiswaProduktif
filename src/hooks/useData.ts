import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { store, type Filter, type ListOptions } from "@/data";
import type { Insertable, Patch, TableMap, TableName, UUID } from "@/types/db";

/** Tabel yang ikut berubah ketika tabel induk dihapus/diubah (cascade / set null). */
const DEPENDENTS: Partial<Record<TableName, TableName[]>> = {
  courses: ["course_schedules", "grade_components", "tasks", "semester_grades", "calendar_events"],
  tasks: ["task_subtasks", "calendar_events"],
  budgets: ["budget_allocations"],
  budget_categories: ["budget_allocations", "transactions"],
};

export function invalidateTable(qc: QueryClient, table: TableName) {
  qc.invalidateQueries({ queryKey: [table] });
  for (const t of DEPENDENTS[table] ?? []) qc.invalidateQueries({ queryKey: [t] });
}

export function useRows<K extends TableName>(table: K, opts?: ListOptions, enabled = true) {
  return useQuery({
    queryKey: [table, opts ?? {}],
    queryFn: () => store.list(table, opts),
    enabled,
  });
}

export function useInsert<K extends TableName>(table: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Insertable<TableMap[K]>[]) => store.insert(table, rows),
    onSuccess: () => invalidateTable(qc, table),
  });
}

/**
 * Update dengan pembaruan optimistis: tampilan langsung berubah
 * (mis. kartu Kanban pindah kolom), lalu dikembalikan jika server menolak.
 */
export function useUpdate<K extends TableName>(table: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: UUID; patch: Patch<TableMap[K]> }) => store.update(table, id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: [table] });
      const snapshot = qc.getQueriesData<TableMap[K][]>({ queryKey: [table] });
      qc.setQueriesData<TableMap[K][]>({ queryKey: [table] }, (old) =>
        old?.map((r) => ((r as { id: string }).id === id ? { ...r, ...patch } : r)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidateTable(qc, table),
  });
}

export function useRemove<K extends TableName>(table: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filters: Filter[] | UUID) =>
      store.remove(table, typeof filters === "string" ? [{ column: "id", op: "eq", value: filters }] : filters),
    onSuccess: () => invalidateTable(qc, table),
  });
}
