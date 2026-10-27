import type { CourseColor, EventType, GradeScaleRow, IncomeSource, TaskPriority, TaskStatus } from "@/types/db";

/**
 * Skala nilai bawaan (A, A-, B+, ...). Batas angka di sini hanya CONTOH umum —
 * setiap kampus punya aturan sendiri, jadi pengguna bisa mengubahnya di Pengaturan.
 */
export const DEFAULT_GRADE_SCALE: GradeScaleRow[] = [
  { letter: "A", min: 85, point: 4 },
  { letter: "A-", min: 80, point: 3.7 },
  { letter: "B+", min: 75, point: 3.3 },
  { letter: "B", min: 70, point: 3 },
  { letter: "B-", min: 65, point: 2.7 },
  { letter: "C+", min: 60, point: 2.3 },
  { letter: "C", min: 55, point: 2 },
  { letter: "D", min: 40, point: 1 },
  { letter: "E", min: 0, point: 0 },
];

export const DEFAULT_EXPENSE_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Uang kos", icon: "home" },
  { name: "Makan & minum", icon: "utensils" },
  { name: "Transportasi", icon: "bus" },
  { name: "Tugas & print", icon: "printer" },
  { name: "Pulsa & internet", icon: "wifi" },
  { name: "Kebutuhan kuliah", icon: "book" },
  { name: "Tabungan", icon: "piggy" },
  { name: "Nongkrong & hiburan", icon: "coffee" },
  { name: "Dana darurat", icon: "shield" },
  { name: "Lain-lain", icon: "wallet" },
];

export const INCOME_SOURCES: { value: IncomeSource; label: string }[] = [
  { value: "uang_bulanan", label: "Uang bulanan" },
  { value: "beasiswa", label: "Beasiswa" },
  { value: "freelance", label: "Freelance" },
  { value: "bisnis", label: "Hasil bisnis" },
  { value: "hadiah", label: "Hadiah" },
  { value: "lainnya", label: "Lainnya" },
];
export const incomeLabel = (v: IncomeSource | null) => INCOME_SOURCES.find((s) => s.value === v)?.label ?? "Pemasukan";

export const STATUS_LABEL: Record<TaskStatus, string> = { todo: "To-Do", doing: "Dikerjakan", done: "Selesai" };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
export const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "kuliah", label: "Kuliah" },
  { value: "ujian", label: "Ujian" },
  { value: "rapat", label: "Rapat organisasi" },
  { value: "kepanitiaan", label: "Kepanitiaan" },
  { value: "pribadi", label: "Kegiatan pribadi" },
  { value: "belajar", label: "Jadwal belajar" },
];
export const eventTypeLabel = (t: EventType | "deadline") =>
  t === "deadline" ? "Deadline tugas" : (EVENT_TYPES.find((e) => e.value === t)?.label ?? t);

/** Warna mata kuliah — kelas Tailwind statis supaya tidak terhapus saat build. */
export const COURSE_COLORS: Record<CourseColor, { dot: string; soft: string; text: string; label: string }> = {
  blue: { dot: "bg-blue-600", soft: "bg-blue-50", text: "text-blue-700", label: "Biru" },
  teal: { dot: "bg-teal-600", soft: "bg-teal-50", text: "text-teal-700", label: "Hijau toska" },
  violet: { dot: "bg-violet-600", soft: "bg-violet-50", text: "text-violet-700", label: "Ungu" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-700", label: "Kuning" },
  rose: { dot: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-700", label: "Merah muda" },
  slate: { dot: "bg-slate-500", soft: "bg-slate-100", text: "text-slate-700", label: "Abu-abu" },
};

/** Warna jenis agenda kalender */
export const EVENT_STYLE: Record<EventType | "deadline", { bar: string; soft: string; text: string }> = {
  kuliah: { bar: "bg-blue-600", soft: "bg-blue-50", text: "text-blue-800" },
  deadline: { bar: "bg-red-500", soft: "bg-red-50", text: "text-red-800" },
  ujian: { bar: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-900" },
  rapat: { bar: "bg-violet-600", soft: "bg-violet-50", text: "text-violet-800" },
  kepanitiaan: { bar: "bg-teal-600", soft: "bg-teal-50", text: "text-teal-800" },
  pribadi: { bar: "bg-slate-500", soft: "bg-slate-100", text: "text-slate-800" },
  belajar: { bar: "bg-green-600", soft: "bg-green-50", text: "text-green-800" },
};

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Tanpa pengingat" },
  { value: 10, label: "10 menit sebelumnya" },
  { value: 30, label: "30 menit sebelumnya" },
  { value: 60, label: "1 jam sebelumnya" },
  { value: 1440, label: "1 hari sebelumnya" },
];
