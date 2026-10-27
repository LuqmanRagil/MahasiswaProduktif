import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Profile, TableMap, TableName } from "@/types/db";
import { DataError, type DataStore, type Filter, type ListOptions } from "./store";

/** Kolom numeric dari Postgres dipaksa jadi number di sisi klien. */
const NUMERIC_COLUMNS: Partial<Record<TableName | "profiles", string[]>> = {
  profiles: ["target_gpa", "monthly_allowance", "previous_gpa"],
  grade_components: ["weight", "score"],
  semester_grades: ["grade_point"],
  budgets: ["total_amount"],
  budget_allocations: ["amount", "percent"],
  transactions: ["amount"],
};

function normalize<T>(table: string, row: T): T {
  const cols = NUMERIC_COLUMNS[table as TableName];
  if (!cols || !row) return row;
  const r = row as Record<string, unknown>;
  for (const c of cols) if (r[c] !== null && r[c] !== undefined) r[c] = Number(r[c]);
  return row;
}

function toDataError(e: PostgrestError | null): DataError {
  if (!e) return new DataError("Terjadi kesalahan.");
  switch (e.code) {
    case "23505":
      return new DataError("Data dengan nama yang sama sudah ada.", e.code);
    case "23503":
      return new DataError("Data terkait tidak ditemukan. Muat ulang halaman lalu coba lagi.", e.code);
    case "23514":
      // Pesan dari fungsi kita sendiri sudah berbahasa Indonesia.
      return new DataError(
        e.message.startsWith("new row") ? "Isian tidak valid. Periksa kembali data yang dimasukkan." : e.message,
        e.code,
      );
    case "42501":
      return new DataError("Akses ditolak. Silakan masuk ulang.", e.code);
    default:
      console.error("[supabase]", e);
      return new DataError("Gagal menyimpan atau memuat data. Coba lagi.", e.code);
  }
}

function applyFilters(query: any, filters: Filter[] = []) {
  let q = query;
  for (const f of filters) {
    if (f.op === "in") q = q.in(f.column, f.value as unknown[]);
    else q = q[f.op](f.column, f.value);
  }
  return q;
}

export function createSupabaseStore(client: SupabaseClient): DataStore {
  async function userId(): Promise<string> {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new DataError("Sesi berakhir. Silakan masuk lagi.", "42501");
    return id;
  }

  return {
    kind: "supabase",

    async list<K extends TableName>(table: K, opts: ListOptions = {}) {
      let q = applyFilters(client.from(table).select("*"), opts.filters);
      for (const o of opts.order ?? []) q = q.order(o.column, { ascending: o.ascending ?? true });
      const { data, error } = await q;
      if (error) throw toDataError(error);
      return (data as TableMap[K][]).map((r) => normalize(table, r));
    },

    async insert(table, rows) {
      if (rows.length === 0) return [];
      const { data, error } = await client.from(table).insert(rows as never).select("*");
      if (error) throw toDataError(error);
      return (data as never[]).map((r) => normalize(table, r));
    },

    async update(table, id, patch) {
      const { data, error } = await client.from(table).update(patch as never).eq("id", id).select("*").single();
      if (error) throw toDataError(error);
      return normalize(table, data as never);
    },

    async remove(table, filters) {
      if (filters.length === 0) throw new DataError("Penghapusan tanpa filter tidak diizinkan.");
      const { error } = await applyFilters(client.from(table).delete(), filters);
      if (error) throw toDataError(error);
    },

    async getProfile() {
      const id = await userId();
      const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw toDataError(error);
      return data ? normalize("profiles", data as Profile) : null;
    },

    async updateProfile(patch) {
      const id = await userId();
      const { data, error } = await client.from("profiles").update(patch).eq("id", id).select("*").single();
      if (error) throw toDataError(error);
      return normalize("profiles", data as Profile);
    },

    async saveBudget(input) {
      const { data, error } = await client.rpc("save_budget", {
        p_period_start: input.period_start,
        p_period_end: input.period_end,
        p_total_amount: input.total_amount,
        p_mode: input.mode,
        p_allow_over: input.allow_over,
        p_allocations: input.allocations,
      });
      if (error) throw toDataError(error);
      return data as string;
    },
  };
}
