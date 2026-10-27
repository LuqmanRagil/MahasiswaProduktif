import { useMemo, useState } from "react";
import { ArrowDownLeft, History, Plus, Search } from "lucide-react";
import { friendlyError } from "@/data";
import { useRows } from "@/hooks/useData";
import { useToday } from "@/hooks/useToday";
import { incomeLabel } from "@/lib/constants";
import { longDate, rupiah } from "@/lib/format";
import { addDays } from "@/lib/time";
import { groupBy } from "@/lib/utils";
import { totals } from "@/services/finance";
import { useCategories } from "@/features/finance/categories";
import { TransactionRow } from "@/features/finance/components";
import { useCurrentPeriod } from "@/features/finance/useFinance";
import { useQuickActions } from "@/features/quick/QuickActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type Range = "period" | "7" | "30" | "all" | "custom";
type Sort = "newest" | "oldest" | "largest";

export function TransactionsPage() {
  const today = useToday();
  const period = useCurrentPeriod();
  const { addExpense, addIncome, editTransaction } = useQuickActions();
  const txs = useRows("transactions", { order: [{ column: "occurred_on", ascending: false }, { column: "created_at", ascending: false }] });
  const categories = useCategories();
  const catById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data]);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "income" | "expense">("");
  const [cat, setCat] = useState("");
  const [range, setRange] = useState<Range>("period");
  const [from, setFrom] = useState(period.start);
  const [to, setTo] = useState(today);
  const [sort, setSort] = useState<Sort>("newest");

  const bounds = useMemo((): [string, string] | null => {
    if (range === "period") return [period.start, period.end];
    if (range === "7") return [addDays(today, -6), today];
    if (range === "30") return [addDays(today, -29), today];
    if (range === "custom") return [from || "0000-01-01", to || "9999-12-31"];
    return null;
  }, [range, period.start, period.end, today, from, to]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (txs.data ?? []).filter((t) => {
      if (type && t.type !== type) return false;
      if (cat && (cat === "none" ? t.type !== "expense" || (t.category_id && catById.has(t.category_id)) : t.category_id !== cat)) return false;
      if (bounds && (t.occurred_on < bounds[0] || t.occurred_on > bounds[1])) return false;
      if (needle) {
        const hay = `${t.note} ${t.type === "income" ? incomeLabel(t.income_source) : (catById.get(t.category_id ?? "")?.name ?? "")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "oldest") return [...list].reverse();
    if (sort === "largest") return [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [txs.data, q, type, cat, bounds, sort, catById]);

  const sums = totals(filtered);
  const grouped = sort === "largest" ? null : groupBy(filtered, (t) => t.occurred_on);

  return (
    <>
      <PageHeader
        title="Riwayat Transaksi"
        description="Semua pemasukan dan pengeluaran. Ketuk transaksi untuk mengubah atau menghapus."
        actions={
          <>
            <Button variant="outline" onClick={addIncome}>
              <ArrowDownLeft /> Pemasukan
            </Button>
            <Button onClick={addExpense}>
              <Plus /> Pengeluaran
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari catatan atau kategori…" className="pl-9" aria-label="Cari transaksi" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as "" | "income" | "expense")} aria-label="Jenis transaksi">
          <option value="">Semua jenis</option>
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
          <option value="">Semua kategori</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">Tanpa kategori</option>
        </Select>
        <Select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Periode">
          <option value="period">Periode anggaran ini</option>
          <option value="7">7 hari terakhir</option>
          <option value="30">30 hari terakhir</option>
          <option value="all">Semua waktu</option>
          <option value="custom">Pilih tanggal…</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Urutkan">
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="largest">Nominal terbesar</option>
        </Select>
        {range === "custom" && (
          <div className="col-span-2 grid grid-cols-2 gap-2 lg:col-span-5 lg:max-w-md">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
          </div>
        )}
      </div>

      {txs.isLoading || categories.isLoading ? (
        <LoadingState />
      ) : txs.error ? (
        <ErrorState message={friendlyError(txs.error)} onRetry={() => txs.refetch()} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History />}
            title={txs.data?.length ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
            description={txs.data?.length ? "Coba ubah filter atau periode." : "Catat pengeluaran pertamamu — cukup 2–3 ketukan."}
            action={
              !txs.data?.length && (
                <Button onClick={addExpense}>
                  <Plus /> Catat pengeluaran
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="text-muted">
              {filtered.length} transaksi
            </span>
            <span className="tabular text-green-700">Masuk {rupiah(sums.income)}</span>
            <span className="tabular text-ink">Keluar {rupiah(sums.expense)}</span>
          </div>
          {grouped ? (
            <div className="flex flex-col gap-3">
              {Object.entries(grouped).map(([date, items]) => {
                const day = totals(items);
                return (
                  <Card key={date} className="overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line bg-slate-50/70 px-4 py-2 sm:px-5">
                      <p className="text-[13px] font-semibold text-slate-700">{longDate(date)}</p>
                      {day.expense > 0 && <p className="tabular text-xs text-muted">−{rupiah(day.expense)}</p>}
                    </div>
                    <ul className="divide-y divide-line">
                      {items.map((t) => (
                        <TransactionRow key={t.id} t={t} showDate={false} category={t.category_id ? catById.get(t.category_id) : undefined} onClick={() => editTransaction(t)} />
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <ul className="divide-y divide-line">
                {filtered.map((t) => (
                  <TransactionRow key={t.id} t={t} category={t.category_id ? catById.get(t.category_id) : undefined} onClick={() => editTransaction(t)} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
