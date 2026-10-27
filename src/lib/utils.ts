import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sum<T>(items: T[], pick: (t: T) => number): number {
  return items.reduce((s, t) => s + pick(t), 0);
}

export function groupBy<T, K extends string | number>(items: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const it of items) (out[key(it)] ??= []).push(it);
  return out;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Pembulatan 2 desimal yang aman dari error floating point (1.005 → 1.01) */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
