import type { GradeScaleRow } from "@/types/db";
import { round2 } from "@/lib/utils";

export interface ComponentInput {
  weight: number; // persen, total semua komponen = 100
  score: number | null; // 0–100, null = belum ada nilai
}

export interface FinalScoreResult {
  totalWeight: number;
  /** Bobot yang nilainya sudah diisi */
  filledWeight: number;
  /** Sumbangan nilai dari komponen yang sudah diisi (0–100) */
  contribution: number;
  /** Nilai akhir (hanya valid jika complete) */
  score: number | null;
  complete: boolean;
  weightValid: boolean;
}

/** Nilai Akhir = Σ (nilai × bobot%) — bobot wajib berjumlah 100%. */
export function finalScore(components: ComponentInput[]): FinalScoreResult {
  const totalWeight = round2(components.reduce((s, c) => s + c.weight, 0));
  const filled = components.filter((c) => c.score !== null);
  const filledWeight = round2(filled.reduce((s, c) => s + c.weight, 0));
  const contribution = round2(filled.reduce((s, c) => s + (c.score! * c.weight) / 100, 0));
  const weightValid = Math.abs(totalWeight - 100) < 0.001;
  const complete = weightValid && filled.length === components.length && components.length > 0;
  return { totalWeight, filledWeight, contribution, score: complete ? contribution : null, complete, weightValid };
}

/** Urutkan skala dari batas tertinggi. */
export function sortScale(scale: GradeScaleRow[]): GradeScaleRow[] {
  return [...scale].sort((a, b) => b.min - a.min);
}

/** Huruf mutu untuk nilai angka berdasarkan skala kampus. */
export function letterFor(score: number, scale: GradeScaleRow[]): GradeScaleRow | null {
  for (const row of sortScale(scale)) if (score >= row.min) return row;
  return null;
}

export function pointForLetter(letter: string, scale: GradeScaleRow[]): number | null {
  return scale.find((s) => s.letter === letter)?.point ?? null;
}

export function minScoreForLetter(letter: string, scale: GradeScaleRow[]): number | null {
  return scale.find((s) => s.letter === letter)?.min ?? null;
}

/**
 * Nilai rata-rata yang dibutuhkan pada komponen yang BELUM diisi agar
 * nilai akhir mencapai `targetMin`. null jika semua sudah diisi / bobot tidak valid.
 */
export function requiredScoreForTarget(components: ComponentInput[], targetMin: number): number | null {
  const r = finalScore(components);
  if (!r.weightValid) return null;
  const remaining = r.totalWeight - r.filledWeight;
  if (remaining <= 0) return null;
  // dibulatkan 6 desimal hanya untuk membuang noise floating point
  return Math.round((((targetMin - r.contribution) * 100) / remaining) * 1e6) / 1e6;
}

export interface CreditRow {
  credits: number;
  point: number;
}

/** IPS = Σ(SKS × bobot mutu) / Σ SKS */
export function ips(rows: CreditRow[]): number | null {
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  if (credits <= 0) return null;
  return rows.reduce((s, r) => s + r.credits * r.point, 0) / credits;
}

/** IPK baru = [(IPK lama × SKS lama) + Σ(SKS × mutu semester ini)] / (SKS lama + SKS semester ini) */
export function cumulativeGpa(prevGpa: number, prevCredits: number, rows: CreditRow[]): number | null {
  const curCredits = rows.reduce((s, r) => s + r.credits, 0);
  const total = prevCredits + curCredits;
  if (total <= 0) return null;
  const quality = prevGpa * prevCredits + rows.reduce((s, r) => s + r.credits * r.point, 0);
  return quality / total;
}

/**
 * Rata-rata bobot mutu yang dibutuhkan pada `currentCredits` SKS semester ini
 * agar IPK mencapai target. Bisa > 4 (tidak mungkin) atau < 0 (sudah aman).
 */
export function requiredPointForTarget(target: number, prevGpa: number, prevCredits: number, currentCredits: number): number | null {
  if (currentCredits <= 0) return null;
  return (target * (prevCredits + currentCredits) - prevGpa * prevCredits) / currentCredits;
}

/** Tampilkan IPK 2 desimal (dibulatkan biasa). Kampus bisa memakai aturan berbeda. */
export function displayGpa(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "–";
  return round2(n).toFixed(2).replace(".", ",");
}

/** Validasi skala nilai buatan pengguna. Mengembalikan pesan error atau null. */
export function validateScale(scale: GradeScaleRow[]): string | null {
  if (scale.length === 0) return "Skala nilai minimal berisi 1 huruf.";
  const letters = new Set<string>();
  for (const r of scale) {
    if (!r.letter.trim()) return "Huruf nilai tidak boleh kosong.";
    if (letters.has(r.letter)) return `Huruf "${r.letter}" dipakai lebih dari sekali.`;
    letters.add(r.letter);
    if (!(r.min >= 0 && r.min <= 100)) return `Batas nilai "${r.letter}" harus 0–100.`;
    if (!(r.point >= 0 && r.point <= 4)) return `Bobot mutu "${r.letter}" harus 0–4.`;
  }
  const sorted = sortScale(scale);
  if (sorted[sorted.length - 1].min !== 0) return "Huruf terendah harus mulai dari nilai 0.";
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min === sorted[i - 1].min) return "Setiap huruf harus punya batas nilai yang berbeda.";
    if (sorted[i].point > sorted[i - 1].point) return "Bobot mutu harus turun mengikuti batas nilai.";
  }
  return null;
}
