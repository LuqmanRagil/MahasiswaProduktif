/**
 * MODE COBA — penyimpanan di browser (localStorage), BUKAN database cloud.
 * Dipakai hanya ketika Supabase belum dikonfigurasi, supaya aplikasi bisa
 * dicoba. Data hanya ada di browser/perangkat ini dan bisa hilang jika
 * data situs dibersihkan. Tidak ada login & tidak ada keamanan multi-pengguna.
 */
import { DEFAULT_GRADE_SCALE } from "@/lib/constants";
import type { Profile, TableMap, TableName } from "@/types/db";
import { DataError, type DataStore, type Filter, type ListOptions } from "./store";

const KEY = "mp:mode-coba:v1";
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

type Row = Record<string, unknown> & { id: string };
interface LocalDb {
  profile: Profile;
  tables: Partial<Record<TableName, Row[]>>;
}

const nowIso = () => new Date().toISOString();

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function freshDb(): LocalDb {
  const t = nowIso();
  return {
    profile: {
      id: LOCAL_USER_ID,
      full_name: "",
      university: "",
      study_program: "",
      semester: 1,
      target_gpa: 3.5,
      monthly_allowance: 0,
      previous_gpa: 0,
      previous_credits: 0,
      budget_start_day: 1,
      grade_scale: DEFAULT_GRADE_SCALE,
      onboarded_at: null,
      created_at: t,
      updated_at: t,
    },
    tables: {},
  };
}

/** Nilai bawaan kolom — meniru DEFAULT di SQL */
const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  courses: { code: "", lecturer: "", credits: 2, semester: 1, target_grade: "", room: "", color: "blue", is_demo: false },
  course_schedules: { room: "", is_demo: false },
  tasks: { description: "", status: "todo", priority: "medium", due_at: null, position: 0, completed_at: null, course_id: null, is_demo: false },
  task_subtasks: { is_done: false, position: 0, is_demo: false },
  grade_components: { score: null, position: 0, is_demo: false },
  semester_grades: { course_id: null, is_final: false, is_demo: false },
  budget_categories: { icon: "wallet", position: 0 },
  budgets: { mode: "nominal", allow_over_allocation: false, is_demo: false },
  budget_allocations: { amount: 0, percent: null, is_demo: false },
  transactions: { category_id: null, income_source: null, note: "", is_demo: false },
  calendar_events: { location: "", description: "", course_id: null, task_id: null, reminder_minutes: null, is_demo: false },
};

/** Aturan relasi saat baris induk dihapus — meniru ON DELETE di SQL */
const RELATIONS: { parent: TableName; child: TableName; column: string; action: "cascade" | "set null" }[] = [
  { parent: "courses", child: "course_schedules", column: "course_id", action: "cascade" },
  { parent: "courses", child: "grade_components", column: "course_id", action: "cascade" },
  { parent: "courses", child: "tasks", column: "course_id", action: "set null" },
  { parent: "courses", child: "semester_grades", column: "course_id", action: "set null" },
  { parent: "courses", child: "calendar_events", column: "course_id", action: "set null" },
  { parent: "tasks", child: "task_subtasks", column: "task_id", action: "cascade" },
  { parent: "tasks", child: "calendar_events", column: "task_id", action: "set null" },
  { parent: "budgets", child: "budget_allocations", column: "budget_id", action: "cascade" },
  { parent: "budget_categories", child: "budget_allocations", column: "category_id", action: "cascade" },
  { parent: "budget_categories", child: "transactions", column: "category_id", action: "set null" },
];

/** Penyimpanan aman: jatuh ke memori jika localStorage diblokir (mis. mode privat). */
class SafeStorage {
  private memory: string | null = null;
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return this.memory;
    }
  }
  set(v: string) {
    this.memory = v;
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* tetap di memori */
    }
  }
}

function matches(row: Row, f: Filter): boolean {
  const v = row[f.column] as never;
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "gte":
      return v !== null && v >= (f.value as never);
    case "lte":
      return v !== null && v <= (f.value as never);
    case "in":
      return (f.value as unknown[]).includes(v);
  }
}

export function createLocalStore(): DataStore {
  const storage = new SafeStorage();
  let db: LocalDb;
  try {
    const raw = storage.get();
    db = raw ? (JSON.parse(raw) as LocalDb) : freshDb();
  } catch {
    db = freshDb();
  }
  const persist = () => storage.set(JSON.stringify(db));
  const rows = (t: TableName): Row[] => (db.tables[t] ??= []);
  // Sedikit jeda agar status loading tetap teruji seperti di cloud.
  const tick = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 40));

  function deleteCascade(table: TableName, ids: Set<string>) {
    db.tables[table] = rows(table).filter((r) => !ids.has(r.id));
    for (const rel of RELATIONS.filter((r) => r.parent === table)) {
      if (rel.action === "set null") {
        for (const r of rows(rel.child)) if (ids.has(r[rel.column] as string)) r[rel.column] = null;
      } else {
        const childIds = new Set(rows(rel.child).filter((r) => ids.has(r[rel.column] as string)).map((r) => r.id));
        if (childIds.size) deleteCascade(rel.child, childIds);
      }
    }
  }

  function validate(table: TableName, row: Row) {
    if (table === "tasks" && (row.status === "done") !== (row.completed_at !== null)) {
      throw new DataError("Status tugas tidak konsisten.");
    }
    if (table === "transactions" && !((row.amount as number) > 0)) throw new DataError("Nominal harus lebih dari 0.");
    if (table === "calendar_events" && (row.end_at as string) <= (row.start_at as string)) {
      throw new DataError("Waktu selesai harus setelah waktu mulai.");
    }
    if (table === "budget_categories" && rows(table).some((r) => r.id !== row.id && r.name === row.name)) {
      throw new DataError("Data dengan nama yang sama sudah ada.");
    }
  }

  return {
    kind: "local",

    async list<K extends TableName>(table: K, opts: ListOptions = {}) {
      let out = rows(table).filter((r) => (opts.filters ?? []).every((f) => matches(r, f)));
      for (const o of [...(opts.order ?? [])].reverse()) {
        out = [...out].sort((a, b) => {
          const av = a[o.column] as never;
          const bv = b[o.column] as never;
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (av < bv ? -1 : 1) * (o.ascending === false ? -1 : 1);
        });
      }
      return tick(out as unknown as TableMap[K][]);
    },

    async insert(table, newRows) {
      const t = nowIso();
      const created = newRows.map((r) => {
        const row = { ...DEFAULTS[table], ...r, id: r.id ?? uuid(), user_id: LOCAL_USER_ID, created_at: t, updated_at: t } as Row;
        validate(table, row);
        return row;
      });
      rows(table).push(...created);
      persist();
      return tick(created as never[]);
    },

    async update(table, id, patch) {
      const row = rows(table).find((r) => r.id === id);
      if (!row) throw new DataError("Data tidak ditemukan. Muat ulang halaman lalu coba lagi.");
      const next = { ...row, ...patch, updated_at: nowIso() } as Row;
      validate(table, next);
      Object.assign(row, next);
      persist();
      return tick(row as never);
    },

    async remove(table, filters) {
      if (filters.length === 0) throw new DataError("Penghapusan tanpa filter tidak diizinkan.");
      const ids = new Set(rows(table).filter((r) => filters.every((f) => matches(r, f))).map((r) => r.id));
      deleteCascade(table, ids);
      persist();
      await tick(null);
    },

    async getProfile() {
      return tick(db.profile);
    },

    async updateProfile(patch) {
      db.profile = { ...db.profile, ...patch, updated_at: nowIso() };
      persist();
      return tick(db.profile);
    },

    async saveBudget(input) {
      const sum = input.allocations.reduce((s, a) => s + a.amount, 0);
      if (!input.allow_over && sum > input.total_amount) throw new DataError("Total alokasi melebihi total anggaran");
      const t = nowIso();
      let budget = rows("budgets").find((b) => b.period_start === input.period_start);
      if (!budget) {
        budget = { id: uuid(), user_id: LOCAL_USER_ID, created_at: t } as Row;
        rows("budgets").push(budget);
      }
      Object.assign(budget, {
        period_start: input.period_start,
        period_end: input.period_end,
        total_amount: input.total_amount,
        mode: input.mode,
        allow_over_allocation: input.allow_over,
        is_demo: false,
        updated_at: t,
      });
      const budgetId = budget.id;
      db.tables.budget_allocations = rows("budget_allocations").filter((a) => a.budget_id !== budgetId);
      for (const a of input.allocations) {
        if (a.amount <= 0 && !(a.percent && a.percent > 0)) continue;
        rows("budget_allocations").push({
          id: uuid(),
          user_id: LOCAL_USER_ID,
          created_at: t,
          budget_id: budgetId,
          category_id: a.category_id,
          amount: a.amount,
          percent: a.percent,
          is_demo: false,
        });
      }
      persist();
      return tick(budgetId);
    },
  };
}

/** Hapus semua data Mode Coba (dipakai tombol "Mulai ulang Mode Coba"). */
export function resetLocalStore() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* abaikan */
  }
}
