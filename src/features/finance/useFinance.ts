import { useMemo } from "react";
import { useRows } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { useToday } from "@/hooks/useToday";
import { categoryUsage, inPeriod, periodFor, shiftPeriod, summarizeBudget, totals, type Period } from "@/services/finance";
import { useCategories } from "./categories";

/** Periode anggaran berjalan (berdasarkan tanggal mulai di profil). */
export function useCurrentPeriod(): Period {
  const today = useToday();
  const profile = useProfile();
  return periodFor(today, profile.data?.budget_start_day ?? 1);
}

/**
 * Semua angka keuangan untuk satu periode. `offset` = geser periode (−1 = bulan lalu).
 */
export function useFinance(offset = 0) {
  const today = useToday();
  const current = useCurrentPeriod();
  const period = offset ? shiftPeriod(current, offset) : current;
  const isCurrent = offset === 0;

  const txs = useRows("transactions", { order: [{ column: "occurred_on", ascending: false }, { column: "created_at", ascending: false }] });
  const categories = useCategories();
  const budgets = useRows("budgets", { filters: [{ column: "period_start", op: "eq", value: period.start }] });
  const budget = budgets.data?.[0] ?? null;
  const allocations = useRows("budget_allocations", { filters: [{ column: "budget_id", op: "eq", value: budget?.id ?? "" }] }, !!budget);

  const data = useMemo(() => {
    const all = txs.data ?? [];
    const periodTxs = all.filter((t) => inPeriod(t.occurred_on, period));
    const p = totals(periodTxs);
    const allTime = totals(all);
    // Untuk periode yang sudah lewat, "hari ini" = hari terakhir periode.
    const ref = isCurrent ? today : today > period.end ? period.end : period.start;
    const summary = budget ? summarizeBudget(budget.total_amount, p.expense, ref, period) : null;
    const usage = categoryUsage(categories.data ?? [], budget ? (allocations.data ?? []) : [], periodTxs);
    return { periodTxs, income: p.income, expense: p.expense, balance: allTime.balance, summary, usage };
  }, [txs.data, categories.data, allocations.data, budget, period.start, period.end, today, isCurrent]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    period,
    isCurrent,
    budget,
    allocations: allocations.data ?? [],
    categories: categories.data ?? [],
    allTxs: txs.data ?? [],
    isLoading: txs.isLoading || categories.isLoading || budgets.isLoading || (!!budget && allocations.isLoading),
    error: txs.error || categories.error || budgets.error || allocations.error,
    refetch: () => {
      txs.refetch();
      budgets.refetch();
    },
    ...data,
  };
}
