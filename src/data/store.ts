import type { Insertable, Patch, Profile, TableMap, TableName, UUID } from "@/types/db";

export type FilterOp = "eq" | "neq" | "gte" | "lte" | "in";
export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface ListOptions {
  filters?: Filter[];
  order?: { column: string; ascending?: boolean }[];
}

export interface SaveBudgetInput {
  period_start: string;
  period_end: string;
  total_amount: number;
  mode: "percent" | "nominal";
  allow_over: boolean;
  allocations: { category_id: UUID; amount: number; percent: number | null }[];
}

/**
 * Lapisan penyimpanan. Halaman & fitur hanya bicara dengan interface ini,
 * sehingga Supabase (cloud) dan Mode Coba (browser) bisa ditukar tanpa
 * mengubah kode fitur.
 */
export interface DataStore {
  readonly kind: "supabase" | "local";
  list<K extends TableName>(table: K, opts?: ListOptions): Promise<TableMap[K][]>;
  insert<K extends TableName>(table: K, rows: Insertable<TableMap[K]>[]): Promise<TableMap[K][]>;
  update<K extends TableName>(table: K, id: UUID, patch: Patch<TableMap[K]>): Promise<TableMap[K]>;
  remove<K extends TableName>(table: K, filters: Filter[]): Promise<void>;
  getProfile(): Promise<Profile | null>;
  updateProfile(patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>): Promise<Profile>;
  saveBudget(input: SaveBudgetInput): Promise<UUID>;
}

export class DataError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "DataError";
  }
}

/** Ubah error teknis jadi pesan yang bisa dipahami pengguna (tanpa membocorkan detail). */
export function friendlyError(err: unknown): string {
  if (err instanceof DataError) return err.message;
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return "Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}
