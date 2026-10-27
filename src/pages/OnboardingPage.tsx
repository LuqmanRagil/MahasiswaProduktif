import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Sparkles } from "lucide-react";
import { z } from "zod";
import { friendlyError, store } from "@/data";
import { useProfile } from "@/hooks/useProfile";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/constants";
import { todayStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { profileSchema } from "@/schemas";
import { periodFor } from "@/services/finance";
import { seedDemoData } from "@/features/demo/demoData";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { LoadingState } from "@/components/ui/states";

const onboardingSchema = profileSchema.extend({
  budget_start_day: z.number().int().min(1).max(28),
});
type OnboardingForm = z.infer<typeof onboardingSchema>;

export function OnboardingPage() {
  const profile = useProfile();
  if (profile.isLoading) return <LoadingState className="min-h-dvh" />;
  if (profile.data?.onboarded_at) return <Navigate to="/" replace />;
  return <OnboardingForm defaultName={profile.data?.full_name ?? ""} />;
}

function OnboardingForm({ defaultName }: { defaultName: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [withDemo, setWithDemo] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, formState, getValues } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      full_name: defaultName,
      university: "",
      study_program: "",
      semester: 1,
      target_gpa: 3.5,
      monthly_allowance: 0,
      budget_start_day: 1,
    },
  });

  const finish = async () => {
    if (withDemo === null) return;
    const v = getValues();
    setSaving(true);
    try {
      // 1. Kategori pengeluaran bawaan (bisa diubah nanti)
      const existing = await store.list("budget_categories");
      if (existing.length === 0) {
        await store.insert("budget_categories", DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ name: c.name, icon: c.icon, position: i })));
      }
      // 2. Anggaran periode ini dari uang bulanan (tanpa alokasi — pengguna yang mengatur)
      const period = periodFor(todayStr(), v.budget_start_day);
      if (v.monthly_allowance > 0) {
        await store.saveBudget({ period_start: period.start, period_end: period.end, total_amount: v.monthly_allowance, mode: "nominal", allow_over: false, allocations: [] });
      }
      // 3. Data contoh (opsional)
      if (withDemo) await seedDemoData({ semester: v.semester, allowance: v.monthly_allowance, budgetStartDay: v.budget_start_day });
      // 4. Tandai onboarding selesai
      await store.updateProfile({ ...v, onboarded_at: new Date().toISOString() });
      await qc.invalidateQueries();
      toast.success(withDemo ? "Akun siap! Data contoh sudah ditambahkan." : "Akun siap! Selamat produktif.");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg px-5 py-8">
      <div className="mx-auto max-w-lg">
        <Logo />
        <div className="mt-8 flex items-center gap-2 text-[13px] font-medium text-muted">
          <span className={cn("h-1.5 w-10 rounded-full", "bg-primary")} />
          <span className={cn("h-1.5 w-10 rounded-full", step === 2 ? "bg-primary" : "bg-slate-200")} />
          <span className="ml-1">Langkah {step} dari 2</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Kenalan dulu, yuk</h1>
            <p className="mt-1 text-sm text-muted">Data ini dipakai untuk dashboard, target IPK, dan anggaranmu. Semua bisa diubah nanti.</p>
            <form onSubmit={handleSubmit(() => setStep(2))} noValidate className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <Field label="Nama panggilan / lengkap" htmlFor="ob-name" error={formState.errors.full_name?.message}>
                <Input id="ob-name" autoFocus aria-invalid={!!formState.errors.full_name} {...register("full_name")} />
              </Field>
              <Field label="Universitas" htmlFor="ob-univ" optional>
                <Input id="ob-univ" placeholder="mis. Universitas Negeri Surabaya" {...register("university")} />
              </Field>
              <Field label="Program studi" htmlFor="ob-prodi" optional>
                <Input id="ob-prodi" placeholder="mis. Sistem Informasi" {...register("study_program")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Semester saat ini" htmlFor="ob-sem" error={formState.errors.semester?.message}>
                  <Select id="ob-sem" {...register("semester", { valueAsNumber: true })}>
                    {Array.from({ length: 14 }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Target IPK" htmlFor="ob-target" error={formState.errors.target_gpa?.message}>
                  <Input id="ob-target" type="number" inputMode="decimal" step="0.01" min={0} max={4} {...register("target_gpa", { valueAsNumber: true })} />
                </Field>
              </div>
              <Field label="Perkiraan uang bulanan" htmlFor="ob-money" optional hint="Total uang yang kamu kelola per bulan (kiriman, beasiswa, dll).">
                <Controller control={control} name="monthly_allowance" render={({ field }) => <MoneyInput id="ob-money" value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field label="Uang bulanan biasanya diterima tanggal" htmlFor="ob-day" hint="Periode anggaran dihitung mulai tanggal ini setiap bulan.">
                <Select id="ob-day" {...register("budget_start_day", { valueAsNumber: true })}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Tanggal {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" size="lg" className="mt-2">
                Lanjut
              </Button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Mau mulai dari mana?</h1>
            <p className="mt-1 text-sm text-muted">Data contoh membantumu melihat cara kerja aplikasi. Bisa dihapus kapan saja.</p>
            <div role="radiogroup" aria-label="Pilihan data awal" className="mt-6 flex flex-col gap-3">
              {[
                { v: true, icon: Sparkles, title: "Isi dengan data contoh", desc: "4 mata kuliah, jadwal, tugas, transaksi, dan agenda contoh. Ditandai “contoh” dan bisa dihapus sekali klik." },
                { v: false, icon: Database, title: "Mulai dari kosong", desc: "Isi mata kuliah, tugas, dan pengeluaranmu sendiri dari awal." },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={withDemo === o.v}
                  onClick={() => setWithDemo(o.v)}
                  className={cn(
                    "flex gap-4 rounded-2xl border bg-surface p-4 text-left transition-colors",
                    withDemo === o.v ? "border-primary ring-3 ring-primary/15" : "border-line hover:border-slate-300",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <o.icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{o.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={saving}>
                Kembali
              </Button>
              <Button size="lg" className="flex-1" disabled={withDemo === null} loading={saving} onClick={finish}>
                Mulai pakai aplikasi
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
