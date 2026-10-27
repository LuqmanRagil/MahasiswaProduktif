/**
 * Data contoh supaya aplikasi mudah dicoba. Semua baris ditandai is_demo = true
 * dan bisa dihapus sekaligus dari Pengaturan / banner di Dashboard.
 */
import { useQueryClient } from "@tanstack/react-query";
import { store } from "@/data";
import { useRows } from "@/hooks/useData";
import { addDays, fromWib, isoWeekday, todayStr } from "@/lib/time";
import { periodFor } from "@/services/finance";
import type { TableName } from "@/types/db";

/** Urutan hapus: anak dulu, lalu induk. */
const DEMO_TABLES: TableName[] = [
  "task_subtasks",
  "calendar_events",
  "transactions",
  "budget_allocations",
  "grade_components",
  "semester_grades",
  "course_schedules",
  "tasks",
  "courses",
  "budgets",
];

export async function clearDemoData() {
  for (const t of DEMO_TABLES) await store.remove(t, [{ column: "is_demo", op: "eq", value: true }]);
}

/** Tanggal hari kerja berikutnya (atau hari ini) untuk hari ISO tertentu. */
function nextWeekday(from: string, wd: number) {
  const diff = (wd - isoWeekday(from) + 7) % 7;
  return addDays(from, diff);
}

export async function seedDemoData(opts: { semester: number; allowance: number; budgetStartDay: number }) {
  const today = todayStr();
  const sem = opts.semester;
  const demo = { is_demo: true };

  const [kalkulus, basdat, pkn, statistik] = await store.insert("courses", [
    { name: "Kalkulus II", code: "MAT102", lecturer: "Dr. Rina Kusuma", credits: 3, semester: sem, target_grade: "A-", room: "R. 3.12", color: "blue", ...demo },
    { name: "Basis Data", code: "INF210", lecturer: "Agus Pranoto, M.Kom.", credits: 3, semester: sem, target_grade: "A", room: "Lab Komputer 2", color: "teal", ...demo },
    { name: "Pendidikan Kewarganegaraan", code: "UMU104", lecturer: "Dra. Sri Lestari", credits: 2, semester: sem, target_grade: "B+", room: "Aula B", color: "amber", ...demo },
    { name: "Statistika Dasar", code: "MAT201", lecturer: "Bambang Wijaya, M.Si.", credits: 3, semester: sem, target_grade: "A-", room: "R. 2.05", color: "violet", ...demo },
  ]);

  // Satu jadwal kuliah ditaruh di hari ini supaya "Agenda Hari Ini" langsung terisi.
  const todayWd = isoWeekday(today);
  const otherDay = (n: number) => ((todayWd - 1 + n) % 7) + 1;
  await store.insert("course_schedules", [
    { course_id: kalkulus.id, day_of_week: todayWd, start_time: "08:00", end_time: "09:40", room: "R. 3.12", ...demo },
    { course_id: basdat.id, day_of_week: todayWd, start_time: "13:00", end_time: "15:30", room: "Lab Komputer 2", ...demo },
    { course_id: pkn.id, day_of_week: otherDay(1), start_time: "10:00", end_time: "11:40", room: "Aula B", ...demo },
    { course_id: statistik.id, day_of_week: otherDay(2), start_time: "08:00", end_time: "10:30", room: "R. 2.05", ...demo },
    { course_id: kalkulus.id, day_of_week: otherDay(3), start_time: "10:00", end_time: "11:40", room: "R. 3.12", ...demo },
  ]);

  const now = new Date().toISOString();
  const tasks = await store.insert("tasks", [
    { title: "Laporan praktikum ERD perpustakaan", course_id: basdat.id, priority: "high", status: "doing", due_at: fromWib(addDays(today, 1), "23:59"), position: 1000, description: "Kumpulkan dalam format PDF lewat LMS.", ...demo },
    { title: "Latihan soal integral parsial", course_id: kalkulus.id, priority: "medium", status: "todo", due_at: fromWib(addDays(today, 3), "08:00"), position: 1000, ...demo },
    { title: "Esai wawasan kebangsaan (1.000 kata)", course_id: pkn.id, priority: "low", status: "todo", due_at: fromWib(addDays(today, 8), "23:59"), position: 2000, ...demo },
    { title: "Kuis online distribusi normal", course_id: statistik.id, priority: "high", status: "todo", due_at: fromWib(addDays(today, -1), "21:00"), position: 3000, ...demo },
    { title: "Rangkum bab 4 regresi linear", course_id: statistik.id, priority: "medium", status: "done", due_at: fromWib(addDays(today, -2), "23:59"), position: 1000, completed_at: now, ...demo },
    { title: "Normalisasi tabel sampai 3NF", course_id: basdat.id, priority: "medium", status: "done", due_at: fromWib(addDays(today, -4), "23:59"), position: 2000, completed_at: fromWib(addDays(today, -5), "20:00"), ...demo },
  ]);
  await store.insert("task_subtasks", [
    { task_id: tasks[0].id, title: "Gambar ERD", is_done: true, position: 0, ...demo },
    { task_id: tasks[0].id, title: "Tulis penjelasan relasi", is_done: false, position: 1, ...demo },
    { task_id: tasks[0].id, title: "Export ke PDF", is_done: false, position: 2, ...demo },
    { task_id: tasks[2].id, title: "Cari 3 referensi jurnal", is_done: false, position: 0, ...demo },
  ]);

  await store.insert("grade_components", [
    { course_id: kalkulus.id, name: "Tugas", weight: 20, score: 85, position: 0, ...demo },
    { course_id: kalkulus.id, name: "Kuis", weight: 10, score: 78, position: 1, ...demo },
    { course_id: kalkulus.id, name: "UTS", weight: 30, score: 74, position: 2, ...demo },
    { course_id: kalkulus.id, name: "UAS", weight: 40, score: null, position: 3, ...demo },
    { course_id: basdat.id, name: "Tugas", weight: 25, score: 90, position: 0, ...demo },
    { course_id: basdat.id, name: "Praktikum", weight: 25, score: 88, position: 1, ...demo },
    { course_id: basdat.id, name: "UTS", weight: 20, score: 82, position: 2, ...demo },
    { course_id: basdat.id, name: "UAS", weight: 30, score: null, position: 3, ...demo },
  ]);

  // Agenda non-kuliah
  await store.insert("calendar_events", [
    { type: "rapat", title: "Rapat divisi acara", start_at: fromWib(today, "16:00"), end_at: fromWib(today, "17:30"), location: "Sekretariat BEM", ...demo },
    { type: "belajar", title: "Belajar kelompok Statistika", start_at: fromWib(addDays(today, 2), "19:00"), end_at: fromWib(addDays(today, 2), "21:00"), location: "Perpustakaan pusat", course_id: statistik.id, ...demo },
    { type: "ujian", title: "Kuis Kalkulus", start_at: fromWib(nextWeekday(addDays(today, 1), otherDay(3)), "10:00"), end_at: fromWib(nextWeekday(addDays(today, 1), otherDay(3)), "11:00"), course_id: kalkulus.id, location: "R. 3.12", ...demo },
    { type: "kepanitiaan", title: "Technical meeting Dies Natalis", start_at: fromWib(addDays(today, 5), "15:30"), end_at: fromWib(addDays(today, 5), "17:00"), location: "Gedung Rektorat", ...demo },
  ]);

  // Keuangan: pemasukan + pengeluaran beberapa hari terakhir di periode berjalan
  const period = periodFor(today, opts.budgetStartDay);
  const allowance = opts.allowance > 0 ? opts.allowance : 1_500_000;
  const categories = await store.list("budget_categories");
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const clampDate = (d: string) => (d < period.start ? period.start : d);
  await store.insert("transactions", [
    { type: "income", amount: allowance, income_source: "uang_bulanan", occurred_on: period.start, note: "Kiriman bulanan", ...demo },
    { type: "expense", amount: Math.round(allowance * 0.35), category_id: cat("Uang kos"), occurred_on: period.start, note: "Bayar kos", ...demo },
    { type: "expense", amount: 15_000, category_id: cat("Makan & minum"), occurred_on: clampDate(addDays(today, -6)), note: "Nasi pecel", ...demo },
    { type: "expense", amount: 22_000, category_id: cat("Makan & minum"), occurred_on: clampDate(addDays(today, -5)), note: "Ayam geprek + es teh", ...demo },
    { type: "expense", amount: 50_000, category_id: cat("Pulsa & internet"), occurred_on: clampDate(addDays(today, -5)), note: "Paket data", ...demo },
    { type: "expense", amount: 12_000, category_id: cat("Transportasi"), occurred_on: clampDate(addDays(today, -4)), note: "Ojek ke kampus", ...demo },
    { type: "expense", amount: 18_500, category_id: cat("Tugas & print"), occurred_on: clampDate(addDays(today, -3)), note: "Print laporan", ...demo },
    { type: "expense", amount: 35_000, category_id: cat("Nongkrong & hiburan"), occurred_on: clampDate(addDays(today, -2)), note: "Kopi sama teman", ...demo },
    { type: "expense", amount: 17_000, category_id: cat("Makan & minum"), occurred_on: clampDate(addDays(today, -1)), note: "Soto ayam", ...demo },
    { type: "expense", amount: 10_000, category_id: cat("Makan & minum"), occurred_on: today, note: "Sarapan", ...demo },
  ]);

  // Alokasi contoh pada anggaran periode ini (hanya jika anggarannya ada).
  const budget = (await store.list("budgets", { filters: [{ column: "period_start", op: "eq", value: period.start }] }))[0];
  if (budget && budget.total_amount > 0) {
    const t = budget.total_amount;
    const plan: [string, number][] = [
      ["Uang kos", 0.35],
      ["Makan & minum", 0.3],
      ["Transportasi", 0.06],
      ["Tugas & print", 0.04],
      ["Pulsa & internet", 0.05],
      ["Tabungan", 0.1],
      ["Nongkrong & hiburan", 0.05],
      ["Dana darurat", 0.05],
    ];
    await store.insert(
      "budget_allocations",
      plan
        .filter(([n]) => cat(n))
        .map(([n, p]) => ({ budget_id: budget.id, category_id: cat(n)!, amount: Math.round(t * p), percent: null, ...demo })),
    );
  }

  // Riwayat nilai semester lalu (hanya jika bukan semester 1).
  if (sem > 1) {
    await store.insert("semester_grades", [
      { course_name: "Kalkulus I", credits: 3, semester: sem - 1, grade_letter: "A-", grade_point: 3.7, is_final: true, ...demo },
      { course_name: "Algoritma & Pemrograman", credits: 4, semester: sem - 1, grade_letter: "A", grade_point: 4, is_final: true, ...demo },
      { course_name: "Bahasa Inggris Akademik", credits: 2, semester: sem - 1, grade_letter: "B+", grade_point: 3.3, is_final: true, ...demo },
    ]);
  }
  // Prediksi nilai semester berjalan untuk 2 matkul (sisanya diisi pengguna).
  await store.insert("semester_grades", [
    { course_id: pkn.id, course_name: pkn.name, credits: pkn.credits, semester: sem, grade_letter: "B+", grade_point: 3.3, is_final: false, ...demo },
    { course_id: statistik.id, course_name: statistik.name, credits: statistik.credits, semester: sem, grade_letter: "A-", grade_point: 3.7, is_final: false, ...demo },
  ]);
}

/** true jika masih ada data contoh. */
export function useHasDemo() {
  const f = { filters: [{ column: "is_demo", op: "eq" as const, value: true }] };
  const a = useRows("courses", f);
  const b = useRows("transactions", f);
  const c = useRows("tasks", f);
  return Boolean(a.data?.length || b.data?.length || c.data?.length);
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
