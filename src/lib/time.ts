/**
 * Utilitas waktu berbasis WIB (Asia/Jakarta, UTC+7, tanpa daylight saving).
 * Semua perhitungan tanggal memakai string "YYYY-MM-DD" agar tidak
 * terpengaruh zona waktu perangkat pengguna.
 */
export const TZ = "Asia/Jakarta";
const OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal kalender (WIB) dari sebuah instant. */
export function toDateStr(d: Date | string | number = new Date()): string {
  const t = new Date(d).getTime() + OFFSET_MS;
  const u = new Date(t);
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;
}

/** Jam "HH:MM" (WIB) dari sebuah instant. */
export function toTimeStr(d: Date | string | number): string {
  const u = new Date(new Date(d).getTime() + OFFSET_MS);
  return `${pad(u.getUTCHours())}:${pad(u.getUTCMinutes())}`;
}

export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

/** Gabungkan tanggal + jam WIB menjadi ISO UTC. */
export function fromWib(date: string, time = "00:00"): string {
  const [hh, mm] = time.split(":");
  return new Date(`${date}T${pad(Number(hh))}:${pad(Number(mm))}:00+07:00`).toISOString();
}

/** Nilai untuk <input type="datetime-local"> dalam WIB. */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return `${toDateStr(iso)}T${toTimeStr(iso)}`;
}

export function fromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  const [date, time] = v.split("T");
  return fromWib(date, time ?? "00:00");
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: string, n: number): string {
  const d = parseDate(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Selisih hari kalender (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** 1 = Senin … 7 = Minggu */
export function isoWeekday(date: string): number {
  const d = parseDate(date).getUTCDay();
  return d === 0 ? 7 : d;
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Menit sejak 00:00 dari "HH:MM[:SS]" */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
