import { addDays, addMonths, diffDays, isoWeekday } from "@/lib/time";
import type { BudgetAllocation, BudgetCategory, Transaction } from "@/types/db";

export interface Period {
  start: string;
  end: string;
}

/**
 * Periode anggaran yang memuat `today`. Periode dimulai tiap tanggal
 * `startDay` (1–28) dan berakhir sehari sebelum tanggal yang sama bulan berikutnya.
 */
export function periodFor(today: string, startDay: number): Period {
  const day = Number(today.slice(8, 10));
  const thisMonthStart = `${today.slice(0, 7)}-${String(startDay).padStart(2, "0")}`;
  const start = day >= startDay ? thisMonthStart : addMonths(thisMonthStart, -1);
  return { start, end: addDays(addMonths(start, 1), -1) };
}

export function shiftPeriod(p: Period, months: number): Period {
  const start = addMonths(p.start, months);
  return { start, end: addDays(addMonths(start, 1), -1) };
}

export function inPeriod(date: string, p: Period) {
  return date >= p.start && date <= p.end;
}

export function totals(txs: Pick<Transaction, "type" | "amount">[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export type BudgetStatus = "aman" | "waspada" | "lewat";

/** ≥ 80% dipakai = waspada, > 100% = lewat batas */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return spent > 0 ? "lewat" : "aman";
  const r = spent / limit;
  if (r > 1) return "lewat";
  if (r >= 0.8) return "waspada";
  return "aman";
}

export interface BudgetSummary {
  total: number;
  spent: number;
  remaining: number;
  usedPct: number;
  status: BudgetStatus;
  daysLeft: number;
  /** Jatah aman per hari sampai akhir periode */
  dailyAllowance: number;
  /** Jatah untuk sisa minggu ini (s/d Minggu atau akhir periode) */
  weekAllowance: number;
  weekDaysLeft: number;
}

export function summarizeBudget(total: number, periodExpenses: number, today: string, period: Period): BudgetSummary {
  const remaining = total - periodExpenses;
  const daysLeft = Math.max(1, diffDays(today, period.end) + 1);
  const dailyAllowance = Math.max(0, remaining) / daysLeft;
  const sunday = addDays(today, 7 - isoWeekday(today));
  const weekEnd = sunday < period.end ? sunday : period.end;
  const weekDaysLeft = Math.max(1, diffDays(today, weekEnd) + 1);
  return {
    total,
    spent: periodExpenses,
    remaining,
    usedPct: total > 0 ? (periodExpenses / total) * 100 : 0,
    status: budgetStatus(periodExpenses, total),
    daysLeft,
    dailyAllowance: Math.floor(dailyAllowance),
    weekAllowance: Math.floor(dailyAllowance * weekDaysLeft),
    weekDaysLeft,
  };
}

export interface CategoryUsage {
  category: BudgetCategory | null;
  limit: number;
  spent: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
}

/** Pemakaian anggaran per kategori untuk satu periode. */
export function categoryUsage(
  categories: BudgetCategory[],
  allocations: Pick<BudgetAllocation, "category_id" | "amount">[],
  periodTxs: Pick<Transaction, "type" | "amount" | "category_id">[],
): CategoryUsage[] {
  const spentBy = new Map<string | null, number>();
  for (const t of periodTxs) {
    if (t.type !== "expense") continue;
    const key = t.category_id && categories.some((c) => c.id === t.category_id) ? t.category_id : null;
    spentBy.set(key, (spentBy.get(key) ?? 0) + t.amount);
  }
  const rows: CategoryUsage[] = categories.map((c) => {
    const limit = allocations.find((a) => a.category_id === c.id)?.amount ?? 0;
    const spent = spentBy.get(c.id) ?? 0;
    return { category: c, limit, spent, remaining: limit - spent, pct: limit > 0 ? (spent / limit) * 100 : 0, status: budgetStatus(spent, limit) };
  });
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized > 0) {
    rows.push({ category: null, limit: 0, spent: uncategorized, remaining: -uncategorized, pct: 0, status: "lewat" });
  }
  return rows;
}

/** Mode persen → nominal (dibulatkan ke rupiah) */
export function amountFromPercent(total: number, percent: number): number {
  return Math.round((total * percent) / 100);
}

/** Total pengeluaran per hari untuk daftar tanggal. */
export function dailyExpenses(txs: Pick<Transaction, "type" | "amount" | "occurred_on">[], days: string[]) {
  const map = new Map(days.map((d) => [d, 0]));
  for (const t of txs) if (t.type === "expense" && map.has(t.occurred_on)) map.set(t.occurred_on, map.get(t.occurred_on)! + t.amount);
  return days.map((d) => ({ date: d, amount: map.get(d)! }));
}
