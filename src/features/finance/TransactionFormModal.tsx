import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { friendlyError } from "@/data";
import { useInsert, useRemove, useUpdate } from "@/hooks/useData";
import { useToday } from "@/hooks/useToday";
import { INCOME_SOURCES } from "@/lib/constants";
import { rupiah } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { transactionSchema, type TransactionForm } from "@/schemas";
import type { IncomeSource, Transaction } from "@/types/db";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/states";
import { getLastCategory, setLastCategory, useCategories, useCreateDefaultCategories } from "./categories";

const QUICK_AMOUNTS = [5_000, 10_000, 20_000, 50_000];

export function TransactionFormModal({
  type: initialType,
  editing,
  onClose,
}: {
  type: "income" | "expense";
  editing: Transaction | null;
  onClose: () => void;
}) {
  const today = useToday();
  const categories = useCategories();
  const createDefaults = useCreateDefaultCategories();
  const insert = useInsert("transactions");
  const update = useUpdate("transactions");
  const remove = useRemove("transactions");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: editing
      ? {
          type: editing.type,
          amount: editing.amount,
          category_id: editing.category_id ?? "",
          income_source: editing.income_source ?? "",
          occurred_on: editing.occurred_on,
          note: editing.note,
        }
      : { type: initialType, amount: 0, category_id: "", income_source: initialType === "income" ? "uang_bulanan" : "", occurred_on: today, note: "" },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const type = watch("type");
  const categoryId = watch("category_id");

  // Kategori terakhir dipakai jadi pilihan awal (atau kategori pertama).
  useEffect(() => {
    if (editing || type !== "expense" || categoryId || !categories.data?.length) return;
    const last = getLastCategory();
    const pick =
      categories.data.find((c) => c.id === last) ??
      categories.data.find((c) => /makan/i.test(c.name)) ?? // pengeluaran paling sering mahasiswa
      categories.data[0];
    setValue("category_id", pick.id);
  }, [categories.data, editing, type, categoryId, setValue]);

  const busy = insert.isPending || update.isPending;

  const onSubmit = handleSubmit(async (v) => {
    const row = {
      type: v.type,
      amount: v.amount,
      category_id: v.type === "expense" ? v.category_id || null : null,
      income_source: v.type === "income" ? (v.income_source as IncomeSource) : null,
      occurred_on: v.occurred_on,
      note: v.note,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { ...row, is_demo: false } });
        toast.success("Transaksi diperbarui");
      } else {
        await insert.mutateAsync([row]);
        if (row.category_id) setLastCategory(row.category_id);
        toast.success(v.type === "expense" ? `Pengeluaran ${rupiah(v.amount)} dicatat` : `Pemasukan ${rupiah(v.amount)} dicatat`);
      }
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  });

  const title = editing ? "Ubah transaksi" : type === "expense" ? "Catat pengeluaran" : "Catat pemasukan";

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      footer={
        <>
          {editing && (
            <Button variant="danger-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Hapus
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="tx-form" loading={busy}>
            {editing ? "Simpan perubahan" : "Simpan"}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {!editing && (
          <Segmented
            label="Jenis transaksi"
            value={type}
            onChange={(t) => {
              setValue("type", t);
              setValue("income_source", t === "income" ? "uang_bulanan" : "");
            }}
            options={[
              { value: "expense", label: "Pengeluaran" },
              { value: "income", label: "Pemasukan" },
            ]}
            className="self-start"
          />
        )}

        <Field label="Nominal" htmlFor="tx-amount" error={formState.errors.amount?.message}>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="tx-amount"
                large
                autoFocus={!editing}
                value={field.value}
                onChange={field.onChange}
                aria-invalid={!!formState.errors.amount}
              />
            )}
          />
          {type === "expense" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setValue("amount", a, { shouldValidate: true })}
                  className="tabular h-8 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary"
                >
                  {rupiah(a)}
                </button>
              ))}
            </div>
          )}
        </Field>

        {type === "expense" ? (
          <Field label="Kategori" error={formState.errors.category_id?.message}>
            {categories.isLoading ? (
              <Spinner />
            ) : categories.data?.length ? (
              <div role="radiogroup" aria-label="Kategori" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categories.data.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={categoryId === c.id}
                    onClick={() => setValue("category_id", c.id, { shouldValidate: true })}
                    className={cn(
                      "flex h-11 items-center gap-2 rounded-[10px] border px-3 text-left text-[13px] font-medium transition-colors",
                      categoryId === c.id ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <CategoryIcon name={c.icon} className="size-4 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line p-4 text-center">
                <p className="text-sm text-muted">Belum ada kategori pengeluaran.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  loading={createDefaults.isPending}
                  onClick={() => createDefaults.mutate(undefined, { onError: (e) => toast.error(friendlyError(e)) })}
                >
                  Buat kategori bawaan
                </Button>
              </div>
            )}
          </Field>
        ) : (
          <Field label="Sumber pemasukan" error={formState.errors.income_source?.message}>
            <div role="radiogroup" aria-label="Sumber pemasukan" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INCOME_SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={watch("income_source") === s.value}
                  onClick={() => setValue("income_source", s.value, { shouldValidate: true })}
                  className={cn(
                    "h-11 rounded-[10px] border px-3 text-[13px] font-medium transition-colors",
                    watch("income_source") === s.value ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tanggal" htmlFor="tx-date" error={formState.errors.occurred_on?.message}>
            <Input id="tx-date" type="date" {...register("occurred_on")} />
          </Field>
          <Field label="Catatan" htmlFor="tx-note" optional error={formState.errors.note?.message}>
            <Input id="tx-note" placeholder="mis. Nasi padang" maxLength={200} {...register("note")} />
          </Field>
        </div>
      </form>

      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Hapus transaksi ini?"
          description={`${editing.type === "expense" ? "Pengeluaran" : "Pemasukan"} ${rupiah(editing.amount)} akan dihapus permanen.`}
          loading={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(editing.id);
              toast.success("Transaksi dihapus");
              setConfirmDelete(false);
              onClose();
            } catch (e) {
              toast.error(friendlyError(e));
            }
          }}
        />
      )}
    </Modal>
  );
}
