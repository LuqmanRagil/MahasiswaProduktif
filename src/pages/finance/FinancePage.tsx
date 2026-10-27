import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Plus, Receipt, Scale } from "lucide-react";
import { friendlyError } from "@/data";
import { rupiah, rupiahShort, shortDate, weekdayShort } from "@/lib/format";
import { daysBetween } from "@/lib/time";
import { dailyExpenses } from "@/services/finance";
import { useQuickActions } from "@/features/quick/QuickActions";
import { useFinance } from "@/features/finance/useFinance";
import { BudgetHero, CategoryUsageRow, PeriodSwitcher, TransactionRow } from "@/features/finance/components";
import { SimpleBarChart } from "@/components/charts/BarChartCard";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToday } from "@/hooks/useToday";

export function FinancePage() {
  const today = useToday();
  const [offset, setOffset] = useState(0);
  const f = useFinance(offset);
  const { addExpense, addIncome, editTransaction } = useQuickActions();
  const catById = useMemo(() => new Map(f.categories.map((c) => [c.id, c])), [f.categories]);

  const chartData = useMemo(() => {
    const end = f.isCurrent ? today : f.period.end;
    const days = daysBetween(f.period.start, end < f.period.start ? f.period.start : end);
    return dailyExpenses(f.periodTxs, days).map((d) => ({
      label: days.length > 10 ? String(Number(d.date.slice(8))) : weekdayShort(d.date),
      fullLabel: `${weekdayShort(d.date)}, ${shortDate(d.date)}`,
      value: d.amount,
    }));
  }, [f.periodTxs, f.period.start, f.period.end, f.isCurrent, today]);

  const usage = [...f.usage].filter((u) => u.limit > 0 || u.spent > 0).sort((a, b) => b.pct - a.pct || b.spent - a.spent);

  return (
    <>
      <PageHeader
        title="Dashboard Keuangan"
        description="Pantau uang bulanan supaya cukup sampai kiriman berikutnya."
        actions={
          <>
            <PeriodSwitcher period={f.period} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} canNext={offset < 0} />
            <Button variant="outline" onClick={addIncome}>
              <ArrowDownLeft /> Pemasukan
            </Button>
            <Button onClick={addExpense}>
              <Plus /> Pengeluaran
            </Button>
          </>
        }
      />

      {f.isLoading ? (
        <LoadingState />
      ) : f.error ? (
        <ErrorState message={friendlyError(f.error)} onRetry={f.refetch} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {f.summary ? (
              <BudgetHero summary={f.summary} isCurrent={f.isCurrent} />
            ) : (
              <Card className="flex flex-col justify-center p-6">
                <PiggyBank className="size-8 text-primary" aria-hidden />
                <p className="mt-3 text-[15px] font-semibold">Belum ada anggaran untuk periode ini</p>
                <p className="mt-1 text-sm text-muted">Tentukan total uang bulanan dan batas tiap kategori supaya sisa jatah harianmu bisa dihitung.</p>
                <Link to="/keuangan/anggaran" className="mt-4 inline-flex h-10 w-fit items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
                  Atur anggaran
                </Link>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Pemasukan" value={rupiahShort(f.income)} hint={rupiah(f.income)} icon={<ArrowDownLeft />} tone="success" />
              <StatCard label="Pengeluaran" value={rupiahShort(f.expense)} hint={rupiah(f.expense)} icon={<ArrowUpRight />} />
              <StatCard label="Saldo saat ini" value={rupiahShort(f.balance)} hint="Semua pemasukan − pengeluaran" icon={<Scale />} tone={f.balance < 0 ? "danger" : "default"} />
              <StatCard
                label="Anggaran terpakai"
                value={f.summary ? `${Math.round(f.summary.usedPct)}%` : "–"}
                hint={f.summary ? `dari ${rupiah(f.summary.total)}` : "Anggaran belum diatur"}
                icon={<PiggyBank />}
                tone={f.summary?.status === "lewat" ? "danger" : f.summary?.status === "waspada" ? "warning" : "default"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
            <Card>
              <CardHeader title="Pengeluaran harian" description="Total per hari dalam periode ini" />
              <div className="px-3 pb-4">
                {f.expense > 0 ? (
                  <SimpleBarChart data={chartData} format={rupiah} formatAxis={rupiahShort} ariaLabel="Pengeluaran harian periode ini" />
                ) : (
                  <EmptyState icon={<Receipt />} title="Belum ada pengeluaran" description="Grafik muncul setelah kamu mencatat pengeluaran." />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Pemakaian per kategori"
                description="Diurutkan dari yang paling mendekati batas"
                action={
                  <Link to="/keuangan/anggaran" className="text-[13px] font-medium text-primary hover:underline">
                    Atur batas
                  </Link>
                }
              />
              <div className="px-5 pb-2">
                {usage.length ? (
                  <ul className="divide-y divide-line">
                    {usage.slice(0, 6).map((u) => (
                      <CategoryUsageRow key={u.category?.id ?? "none"} u={u} />
                    ))}
                  </ul>
                ) : (
                  <p className="pb-4 text-sm text-muted">Belum ada batas kategori maupun pengeluaran di periode ini.</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Transaksi terbaru"
              action={
                <Link to="/keuangan/transaksi" className="text-[13px] font-medium text-primary hover:underline">
                  Lihat semua
                </Link>
              }
            />
            {f.periodTxs.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {f.periodTxs.slice(0, 6).map((t) => (
                  <TransactionRow key={t.id} t={t} category={t.category_id ? catById.get(t.category_id) : undefined} onClick={() => editTransaction(t)} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Receipt />}
                title="Belum ada transaksi di periode ini"
                action={
                  <Button onClick={addExpense}>
                    <Plus /> Catat pengeluaran
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
