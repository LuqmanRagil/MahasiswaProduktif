import { TZ } from "./time";

const rupiahFmt = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rp1.500.000 (tanpa spasi, gaya umum Indonesia) */
export function rupiah(n: number): string {
  return rupiahFmt.format(Math.round(n)).replace(/\s/g, "");
}

/** Rp1,5 jt — untuk label sumbu grafik */
export function rupiahShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}Rp${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${sign}Rp${(abs / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `${sign}Rp${abs}`;
}

export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

/** "1.500.000" → 1500000 */
export function parseRupiahInput(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function gpa(n: number): string {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateFromStr(s: string): Date {
  // Tanggal kalender → tengah hari WIB agar aman di semua zona waktu.
  return new Date(`${s}T12:00:00+07:00`);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

/** Selasa, 27 Oktober 2026 */
export function longDate(s: string): string {
  return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateFromStr(s));
}
/** 27 Okt 2026 */
export function mediumDate(s: string): string {
  return fmt({ day: "numeric", month: "short", year: "numeric" }).format(dateFromStr(s));
}
/** 27 Okt */
export function shortDate(s: string): string {
  return fmt({ day: "numeric", month: "short" }).format(dateFromStr(s));
}
/** Sel */
export function weekdayShort(s: string): string {
  return fmt({ weekday: "short" }).format(dateFromStr(s));
}
/** Oktober 2026 */
export function monthYear(s: string): string {
  return fmt({ month: "long", year: "numeric" }).format(dateFromStr(s));
}
/** 14.30 */
export function clock(iso: string): string {
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}
/** "HH:MM:SS" → "14.30" */
export function clockFromTime(t: string): string {
  return t.slice(0, 5).replace(":", ".");
}

export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
