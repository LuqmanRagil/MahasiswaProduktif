import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, CircleCheck, OctagonAlert } from "lucide-react";
import { incomeLabel } from "@/lib/constants";
import { mediumDate, rupiah, shortDate } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { BudgetStatus, BudgetSummary, CategoryUsage, Period } from "@/services/finance";
import type { BudgetCategory, Transaction } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function PeriodSwitcher({ period, onPrev, onNext, canNext }: { period: Period; onPrev: () => void; onNext: () => void; canNext: boolean }) {
  return (
    <div className="inline-flex h-10 items-center rounded-[10px] border border-line bg-surface">
      <button type="button" onClick={onPrev} className="flex h-full w-9 items-center justify-center text-muted hover:text-ink" aria-label="Periode sebelumnya">
        <ChevronLeft className="size-4" />
      </button>
      <span className="tabular min-w-36 px-1 text-center text-[13px] font-medium">
        {shortDate(period.start)} – {shortDate(period.end)}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="flex h-full w-9 items-center justify-center text-muted hover:text-ink disabled:opacity-30"
        aria-label="Periode berikutnya"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

const STATUS_COPY: Record<BudgetStatus, { label: string; icon: typeof CircleCheck }> = {
  aman: { label: "Aman", icon: CircleCheck },
  waspada: { label: "Mendekati batas", icon: AlertTriangle },
  lewat: { label: "Melebihi anggaran", icon: OctagonAlert },
};

/**
 * Panel utama: sisa anggaran + jatah aman per hari. Ini angka yang paling
 * sering dicek mahasiswa, jadi tampil paling menonjol.
 */
export function BudgetHero({ summary, isCurrent, className }: { summary: BudgetSummary; isCurrent: boolean; className?: string }) {
  const S = STATUS_COPY[summary.status];
  const over = summary.remaining < 0;
  return (
    <section aria-label="Sisa anggaran" className={cn("rounded-[var(--radius-card)] bg-primary p-5 text-white sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-blue-50">{over ? "Anggaran terlampaui" : "Sisa anggaran periode ini"}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            summary.status === "aman" ? "bg-white/15 text-white" : summary.status === "waspada" ? "bg-amber-300 text-amber-950" : "bg-red-100 text-red-700",
          )}
        >
          <S.icon className="size-3.5" aria-hidden />
          {S.label}
        </span>
      </div>
      <p className="tabular mt-1 text-[34px] leading-tight font-bold tracking-tight sm:text-[40px]">{rupiah(Math.abs(summary.remaining))}</p>
      <p className="tabular text-sm text-blue-50">
        {rupiah(summary.spent)} terpakai dari {rupiah(summary.total)}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round(summary.usedPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Persentase anggaran terpakai">
        <div className={cn("h-full rounded-full", summary.status === "lewat" ? "bg-red-300" : summary.status === "waspada" ? "bg-amber-300" : "bg-white")} style={{ width: `${Math.min(100, summary.usedPct)}%` }} />
      </div>
      {isCurrent && (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
          <div>
            <dt className="text-xs text-blue-50">Jatah aman per hari</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold">{rupiah(summary.dailyAllowance)}</dd>
          </div>
          <div>
            <dt className="text-xs text-blue-50">Untuk sisa minggu ini ({summary.weekDaysLeft} hari)</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold">{rupiah(summary.weekAllowance)}</dd>
          </div>
          <p className="col-span-2 -mt-1 text-xs text-blue-50">
            Sisa {summary.daysLeft} hari sampai akhir periode. Jatah = sisa anggaran ÷ sisa hari.
          </p>
        </dl>
      )}
    </section>
  );
}

const TONE = { aman: "blue", waspada: "yellow", lewat: "red" } as const;

export function CategoryUsageRow({ u }: { u: CategoryUsage }) {
  const name = u.category?.name ?? "Tanpa kategori";
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <CategoryIcon name={u.category?.icon ?? "wallet"} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="tabular shrink-0 text-[13px] text-muted">
              <span className="font-semibold text-ink">{rupiah(u.spent)}</span>
              {u.limit > 0 && <> / {rupiah(u.limit)}</>}
            </p>
          </div>
          {u.limit > 0 ? (
            <>
              <Progress value={u.pct} tone={TONE[u.status]} className="mt-1.5" label={`Pemakaian ${name}`} />
              <p className={cn("tabular mt-1 text-xs", u.status === "lewat" ? "font-medium text-red-600" : u.status === "waspada" ? "font-medium text-amber-700" : "text-muted")}>
                {u.remaining >= 0 ? `Sisa ${rupiah(u.remaining)}` : `Lewat ${rupiah(-u.remaining)}`}
                {u.status === "waspada" && (u.remaining === 0 ? " · sudah habis" : " · hampir habis")}
              </p>
            </>
          ) : (
            u.spent > 0 && <p className="mt-0.5 text-xs text-muted">Belum ada batas anggaran untuk kategori ini</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function TransactionRow({ t, category, onClick, showDate = true }: { t: Transaction; category?: BudgetCategory; onClick: () => void; showDate?: boolean }) {
  const income = t.type === "income";
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70 sm:px-5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", income ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600")}>
          {income ? <ArrowDownLeft className="size-4" aria-hidden /> : category ? <CategoryIcon name={category.icon} className="size-4" /> : <ArrowUpRight className="size-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{t.note || (income ? incomeLabel(t.income_source) : (category?.name ?? "Pengeluaran"))}</p>
          <p className="truncate text-xs text-muted">
            {income ? incomeLabel(t.income_source) : (category?.name ?? "Tanpa kategori")}
            {showDate && ` · ${mediumDate(t.occurred_on)}`}
          </p>
        </div>
        {t.is_demo && <Badge tone="outline">contoh</Badge>}
        <span className={cn("tabular shrink-0 text-sm font-semibold", income ? "text-green-700" : "text-ink")}>
          {income ? "+" : "−"}
          {rupiah(t.amount)}
        </span>
      </button>
    </li>
  );
}
