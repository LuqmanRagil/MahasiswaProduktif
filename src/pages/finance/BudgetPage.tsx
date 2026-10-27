import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { friendlyError, store } from "@/data";
import { invalidateTable, useInsert, useRemove, useRows, useUpdate } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { rupiah } from "@/lib/format";
import { CATEGORY_ICONS, CategoryIcon } from "@/lib/icons";
import { cn, round2 } from "@/lib/utils";
import { amountFromPercent, shiftPeriod, type Period } from "@/services/finance";
import type { BudgetCategory, BudgetMode } from "@/types/db";
import { useCreateDefaultCategories } from "@/features/finance/categories";
import { PeriodSwitcher } from "@/features/finance/components";
import { useFinance } from "@/features/finance/useFinance";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";

type Row = { amount: number; percent: number };

export function BudgetPage() {
  const [offset, setOffset] = useState(0);
  const f = useFinance(offset);

  return (
    <>
      <PageHeader
        title="Anggaran Bulanan"
        description="Bagi uang bulanan ke tiap kebutuhan — pakai nominal atau persentase, sesuai gayamu."
        actions={<PeriodSwitcher period={f.period} onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} canNext={offset < 1} />}
      />
      {f.isLoading ? (
        <LoadingState />
      ) : f.error ? (
        <ErrorState message={friendlyError(f.error)} onRetry={f.refetch} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <BudgetEditor key={`${f.period.start}:${f.budget?.id ?? "new"}:${f.budget?.updated_at ?? ""}`} period={f.period} finance={f} />
          <CategoryManager categories={f.categories} />
        </div>
      )}
    </>
  );
}

function BudgetEditor({ period, finance: f }: { period: Period; finance: ReturnType<typeof useFinance> }) {
  const qc = useQueryClient();
  const profile = useProfile();
  const prevPeriod = shiftPeriod(period, -1);
  const prevBudget = useRows("budgets", { filters: [{ column: "period_start", op: "eq", value: prevPeriod.start }] });
  const prev = prevBudget.data?.[0];
  const prevAllocs = useRows("budget_allocations", { filters: [{ column: "budget_id", op: "eq", value: prev?.id ?? "" }] }, !!prev);

  const [total, setTotal] = useState<number>(f.budget?.total_amount ?? profile.data?.monthly_allowance ?? 0);
  const [mode, setMode] = useState<BudgetMode>(f.budget?.mode ?? "nominal");
  const [allowOver, setAllowOver] = useState(f.budget?.allow_over_allocation ?? false);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(f.allocations.map((a) => [a.category_id, { amount: a.amount, percent: a.percent ?? (f.budget?.total_amount ? round2((a.amount / f.budget.total_amount) * 100) : 0) }])),
  );
  const [saving, setSaving] = useState(false);

  // Mode persen: nominal selalu dihitung dari total.
  const effective = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of f.categories) {
      const r = rows[c.id];
      out[c.id] = !r ? 0 : mode === "percent" ? amountFromPercent(total, r.percent) : r.amount;
    }
    return out;
  }, [rows, mode, total, f.categories]);

  const allocated = Object.values(effective).reduce((s, n) => s + n, 0);
  const pctSum = round2(f.categories.reduce((s, c) => s + (rows[c.id]?.percent ?? 0), 0));
  const unallocated = total - allocated;
  const overflow = allocated > total;
  const invalid = (overflow && !allowOver) || (mode === "percent" && pctSum > 100 && !allowOver);

  const spentBy = useMemo(() => new Map(f.usage.map((u) => [u.category?.id ?? "", u.spent])), [f.usage]);

  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { amount: 0, percent: 0 }), ...patch } }));

  const switchMode = (m: BudgetMode) => {
    // Konversi supaya angka yang sudah diisi tidak hilang.
    setRows((r) => {
      const next: Record<string, Row> = {};
      for (const [id, v] of Object.entries(r)) {
        next[id] =
          m === "percent"
            ? { amount: v.amount, percent: total > 0 ? round2((v.amount / total) * 100) : 0 }
            : { amount: amountFromPercent(total, v.percent), percent: v.percent };
      }
      return next;
    });
    setMode(m);
  };

  const copyPrevious = () => {
    if (!prev) return;
    setTotal(prev.total_amount);
    setMode(prev.mode);
    setAllowOver(prev.allow_over_allocation);
    setRows(Object.fromEntries((prevAllocs.data ?? []).map((a) => [a.category_id, { amount: a.amount, percent: a.percent ?? 0 }])));
    toast.info("Anggaran periode lalu disalin. Periksa lalu simpan.");
  };

  const save = async () => {
    if (total <= 0) return toast.error("Isi total anggaran terlebih dahulu");
    if (invalid) return toast.error("Total alokasi melebihi total anggaran");
    setSaving(true);
    try {
      await store.saveBudget({
        period_start: period.start,
        period_end: period.end,
        total_amount: total,
        mode,
        allow_over: allowOver,
        allocations: f.categories.map((c) => ({ category_id: c.id, amount: effective[c.id], percent: mode === "percent" ? (rows[c.id]?.percent ?? 0) : null })),
      });
      invalidateTable(qc, "budgets");
      invalidateTable(qc, "budget_allocations");
      toast.success("Anggaran disimpan");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Alokasi dana"
        description={f.budget ? "Ubah angka lalu simpan." : "Belum ada anggaran untuk periode ini."}
        action={
          !f.budget && prev ? (
            <Button size="sm" variant="secondary" onClick={copyPrevious} disabled={prevAllocs.isLoading}>
              <Copy /> Salin periode lalu
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-5 px-5 pb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Total uang bulanan periode ini" htmlFor="b-total">
            <MoneyInput id="b-total" large value={total} onChange={setTotal} />
          </Field>
          <Segmented
            label="Cara membagi"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "nominal", label: "Nominal (Rp)" },
              { value: "percent", label: "Persentase (%)" },
            ]}
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted">
              Teralokasi <strong className="tabular text-ink">{rupiah(allocated)}</strong>
              {mode === "percent" && <span className="tabular"> ({pctSum}%)</span>}
            </span>
            <span className={cn("tabular font-medium", overflow ? "text-red-600" : "text-ink")}>
              {overflow ? `Lebih ${rupiah(-unallocated)}` : `Belum dialokasikan ${rupiah(unallocated)}`}
            </span>
          </div>
          <Progress value={total > 0 ? (allocated / total) * 100 : 0} tone={overflow ? "red" : "blue"} className="mt-2" label="Persentase teralokasi" />
          <label className="mt-3 flex items-center justify-between gap-3 text-[13px] text-slate-700">
            <span>Izinkan alokasi melebihi total (mis. pakai tabungan)</span>
            <Switch checked={allowOver} onCheckedChange={setAllowOver} label="Izinkan alokasi melebihi total" />
          </label>
        </div>

        {f.categories.length === 0 ? (
          <NoCategories />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {f.categories.map((c) => {
              const spent = spentBy.get(c.id) ?? 0;
              const limit = effective[c.id];
              return (
                <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <CategoryIcon name={c.icon} className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="tabular text-xs text-muted">
                        Terpakai {rupiah(spent)}
                        {limit > 0 && (spent > limit ? <span className="text-red-600"> · lewat {rupiah(spent - limit)}</span> : ` · sisa ${rupiah(limit - spent)}`)}
                      </p>
                    </div>
                  </div>
                  {mode === "nominal" ? (
                    <MoneyInput className="sm:w-44" value={rows[c.id]?.amount ?? 0} onChange={(v) => setRow(c.id, { amount: v })} aria-label={`Anggaran ${c.name}`} />
                  ) : (
                    <div className="flex items-center gap-2 sm:w-56">
                      <div className="relative w-24 shrink-0">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="0.5"
                          value={rows[c.id]?.percent || ""}
                          placeholder="0"
                          onChange={(e) => setRow(c.id, { percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                          className="pr-7"
                          aria-label={`Persentase ${c.name}`}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">%</span>
                      </div>
                      <span className="tabular flex-1 text-right text-sm text-muted">{rupiah(limit)}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">Tidak ada pembagian wajib — sesuaikan dengan kebutuhanmu sendiri.</p>
          <Button onClick={save} loading={saving} disabled={f.categories.length === 0}>
            Simpan anggaran
          </Button>
        </div>
        {invalid && (
          <p role="alert" className="-mt-2 text-right text-[13px] text-red-600">
            Total alokasi melebihi total anggaran. Kurangi alokasi atau aktifkan izin melebihi total.
          </p>
        )}
      </div>
    </Card>
  );
}

function NoCategories() {
  const create = useCreateDefaultCategories();
  return (
    <div className="rounded-xl border border-dashed border-line p-6 text-center">
      <p className="text-sm text-muted">Belum ada kategori pengeluaran.</p>
      <Button size="sm" variant="secondary" className="mt-3" loading={create.isPending} onClick={() => create.mutate(undefined, { onError: (e) => toast.error(friendlyError(e)) })}>
        Buat 10 kategori bawaan
      </Button>
    </div>
  );
}

function CategoryManager({ categories }: { categories: BudgetCategory[] }) {
  const [editing, setEditing] = useState<BudgetCategory | "new" | null>(null);
  const [deleting, setDeleting] = useState<BudgetCategory | null>(null);
  const remove = useRemove("budget_categories");
  return (
    <Card className="h-fit">
      <CardHeader
        title="Kategori pengeluaran"
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus /> Kategori
          </Button>
        }
      />
      <ul className="max-h-[480px] overflow-y-auto px-3 pb-3">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <CategoryIcon name={c.icon} className="size-4 text-slate-500" />
            <span className="flex-1 truncate text-sm">{c.name}</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Ubah ${c.name}`}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" className="hover:text-red-600" onClick={() => setDeleting(c)} aria-label={`Hapus ${c.name}`}>
              <Trash2 />
            </Button>
          </li>
        ))}
        {categories.length === 0 && <li className="px-2 py-3 text-sm text-muted">Belum ada kategori.</li>}
      </ul>
      {editing && <CategoryForm editing={editing === "new" ? null : editing} count={categories.length} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Hapus kategori "${deleting?.name}"?`}
        description="Batas anggarannya ikut terhapus. Transaksi lama tetap ada dan akan tercatat sebagai “Tanpa kategori”."
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast.success("Kategori dihapus");
            setDeleting(null);
          } catch (e) {
            toast.error(friendlyError(e));
          }
        }}
      />
    </Card>
  );
}

function CategoryForm({ editing, count, onClose }: { editing: BudgetCategory | null; count: number; onClose: () => void }) {
  const insert = useInsert("budget_categories");
  const update = useUpdate("budget_categories");
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "wallet");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [name]);

  const save = async () => {
    const n = name.trim();
    if (!n) return setError("Nama kategori wajib diisi");
    if (n.length > 40) return setError("Nama maksimal 40 karakter");
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: { name: n, icon } });
      else await insert.mutateAsync([{ name: n, icon, position: count }]);
      toast.success(editing ? "Kategori diperbarui" : "Kategori ditambahkan");
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Ubah kategori" : "Tambah kategori"}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} loading={insert.isPending || update.isPending}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama kategori" htmlFor="cat-name" error={error ?? undefined}>
          <Input
            id="cat-name"
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="mis. Laundry"
            aria-invalid={!!error}
          />
        </Field>
        <Field label="Ikon">
          <div role="radiogroup" aria-label="Ikon" className="grid grid-cols-7 gap-1.5">
            {Object.keys(CATEGORY_ICONS).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={icon === k}
                aria-label={k}
                onClick={() => setIcon(k)}
                className={cn("flex aspect-square items-center justify-center rounded-lg border", icon === k ? "border-primary bg-primary-soft text-primary" : "border-line text-slate-500 hover:bg-slate-50")}
              >
                <CategoryIcon name={k} className="size-4" />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
