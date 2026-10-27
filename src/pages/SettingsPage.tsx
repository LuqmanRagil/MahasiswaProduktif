import { useState } from "react";
import { useNavigate } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { LogOut, Plus, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { friendlyError } from "@/data";
import { resetLocalStore } from "@/data/localStore";
import { useAuth } from "@/auth/AuthProvider";
import { authErrorMessage } from "@/auth/authErrors";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { DEFAULT_GRADE_SCALE } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { profileSchema, resetSchema } from "@/schemas";
import { sortScale, validateScale } from "@/services/academic";
import { clearDemoData, useHasDemo } from "@/features/demo/demoData";
import type { GradeScaleRow, Profile } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/states";

export function SettingsPage() {
  const profile = useProfile();
  if (profile.isLoading || !profile.data) return <LoadingState />;
  return (
    <>
      <PageHeader title="Profil & Pengaturan" description="Data dirimu, skala nilai kampus, dan akun." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <ProfileCard profile={profile.data} />
          <GradeScaleCard key={profile.data.updated_at} scale={profile.data.grade_scale} />
        </div>
        <div className="flex flex-col gap-4">
          <DemoCard />
          <AccountCard />
          <PrivacyCard />
        </div>
      </div>
    </>
  );
}

const settingsSchema = profileSchema.extend({ budget_start_day: z.number().int().min(1).max(28) });
type SettingsForm = z.infer<typeof settingsSchema>;

function ProfileCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const { register, control, handleSubmit, formState, reset } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      full_name: profile.full_name,
      university: profile.university,
      study_program: profile.study_program,
      semester: profile.semester,
      target_gpa: profile.target_gpa,
      monthly_allowance: profile.monthly_allowance,
      budget_start_day: profile.budget_start_day,
    },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      const p = await update.mutateAsync(v);
      reset({ ...v, target_gpa: p.target_gpa });
      toast.success("Profil disimpan");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  });
  return (
    <Card>
      <CardHeader title="Profil" description="Dipakai untuk dashboard, target IPK, dan anggaran." />
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Nama" htmlFor="s-name" error={formState.errors.full_name?.message} className="sm:col-span-2">
          <Input id="s-name" {...register("full_name")} />
        </Field>
        <Field label="Universitas" htmlFor="s-univ" optional>
          <Input id="s-univ" {...register("university")} />
        </Field>
        <Field label="Program studi" htmlFor="s-prodi" optional>
          <Input id="s-prodi" {...register("study_program")} />
        </Field>
        <Field label="Semester saat ini" htmlFor="s-sem" hint="Mata kuliah & IPS mengikuti semester ini.">
          <Select id="s-sem" {...register("semester", { valueAsNumber: true })}>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target IPK" htmlFor="s-target" error={formState.errors.target_gpa?.message}>
          <Input id="s-target" type="number" step="0.01" min={0} max={4} inputMode="decimal" {...register("target_gpa", { valueAsNumber: true })} />
        </Field>
        <Field label="Uang bulanan" htmlFor="s-money" hint="Jadi total anggaran awal saat membuat anggaran baru.">
          <Controller control={control} name="monthly_allowance" render={({ field }) => <MoneyInput id="s-money" value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Periode anggaran mulai tanggal" htmlFor="s-day" hint="Biasanya tanggal kiriman uang bulanan.">
          <Select id="s-day" {...register("budget_start_day", { valueAsNumber: true })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Tanggal {d}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <p className="text-xs text-muted">Mata uang: Rupiah (Rp). Zona waktu: WIB (Asia/Jakarta).</p>
          <Button type="submit" loading={update.isPending} disabled={!formState.isDirty}>
            Simpan profil
          </Button>
        </div>
      </form>
    </Card>
  );
}

function GradeScaleCard({ scale }: { scale: GradeScaleRow[] }) {
  const update = useUpdateProfile();
  const [rows, setRows] = useState(() => sortScale(scale).map((r) => ({ letter: r.letter, min: String(r.min), point: String(r.point) })));
  const parsed: GradeScaleRow[] = rows.map((r) => ({ letter: r.letter.trim().toUpperCase(), min: Number(r.min.replace(",", ".")), point: Number(r.point.replace(",", ".")) }));
  const error = rows.some((r) => r.min.trim() === "" || r.point.trim() === "") ? "Lengkapi batas nilai dan bobot mutu." : validateScale(parsed);
  const set = (i: number, k: "letter" | "min" | "point", v: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const save = async () => {
    if (error) return toast.error(error);
    try {
      await update.mutateAsync({ grade_scale: sortScale(parsed) });
      toast.success("Skala nilai disimpan");
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Skala nilai kampus"
        description="Setiap kampus berbeda. Sesuaikan dengan pedoman akademik kampusmu."
        action={
          <Button size="sm" variant="ghost" onClick={() => setRows(DEFAULT_GRADE_SCALE.map((r) => ({ letter: r.letter, min: String(r.min), point: String(r.point) })))}>
            <RotateCcw /> Bawaan
          </Button>
        }
      />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 pb-1.5 text-xs font-medium text-muted">
          <span>Huruf</span>
          <span>Nilai minimal</span>
          <span>Bobot mutu</span>
          <span />
        </div>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-2">
              <Input value={r.letter} maxLength={5} onChange={(e) => set(i, "letter", e.target.value)} aria-label="Huruf" />
              <Input value={r.min} inputMode="decimal" onChange={(e) => set(i, "min", e.target.value)} aria-label={`Nilai minimal ${r.letter}`} />
              <Input value={r.point} inputMode="decimal" onChange={(e) => set(i, "point", e.target.value)} aria-label={`Bobot mutu ${r.letter}`} />
              <Button size="icon" variant="ghost" onClick={() => setRows((x) => x.filter((_, idx) => idx !== i))} disabled={rows.length <= 1} aria-label={`Hapus ${r.letter}`}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-red-600">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={() => setRows((r) => [...r, { letter: "", min: "", point: "" }])} disabled={rows.length >= 20}>
            <Plus /> Huruf
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!!error}>
            Simpan skala
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DemoCard() {
  const hasDemo = useHasDemo();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!hasDemo) return null;
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <Sparkles className="size-4 text-primary" aria-hidden /> Data contoh aktif
      </p>
      <p className="mt-1 text-sm text-muted">Mata kuliah, tugas, transaksi, dan agenda berlabel “contoh” bukan data milikmu. Hapus kapan saja — data yang kamu buat sendiri tidak ikut terhapus.</p>
      <Button variant="outline" className="mt-4" onClick={() => setConfirm(true)}>
        Hapus data contoh
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus semua data contoh?"
        description="Hanya data berlabel “contoh” yang dihapus. Data contoh yang sudah kamu ubah dianggap milikmu dan tetap disimpan."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await clearDemoData();
            await qc.invalidateQueries();
            toast.success("Data contoh dihapus");
            setConfirm(false);
          } catch (e) {
            toast.error(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

function AccountCard() {
  const { email, localMode, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const pw = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  const [pwError, setPwError] = useState<string | null>(null);

  if (localMode) {
    return (
      <Card className="p-5">
        <p className="text-[15px] font-semibold">Mode Coba</p>
        <p className="mt-1 text-sm text-muted">
          Aplikasi belum tersambung ke Supabase, jadi belum ada akun & login. Data hanya tersimpan di browser ini dan tidak tersinkron ke perangkat lain.
        </p>
        <Button variant="danger-ghost" className="mt-3 -ml-3" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Mulai ulang dari awal
        </Button>
        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Hapus semua data Mode Coba?"
          description="Semua data di browser ini dihapus dan kamu kembali ke langkah onboarding."
          confirmLabel="Hapus semua"
          onConfirm={() => {
            resetLocalStore();
            window.location.reload();
          }}
        />
      </Card>
    );
  }

  const changePassword = pw.handleSubmit(async (v) => {
    setPwError(null);
    const { error } = await supabase!.auth.updateUser({ password: v.password });
    if (error) return setPwError(authErrorMessage(error));
    pw.reset({ password: "", confirm: "" });
    toast.success("Kata sandi diganti");
  });

  return (
    <Card>
      <CardHeader title="Akun" description={email ?? undefined} />
      <form onSubmit={changePassword} noValidate className="flex flex-col gap-3 px-5 pb-4">
        {pwError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pwError}</p>}
        <Field label="Kata sandi baru" htmlFor="pw-new" error={pw.formState.errors.password?.message}>
          <Input id="pw-new" type="password" autoComplete="new-password" {...pw.register("password")} />
        </Field>
        <Field label="Ulangi kata sandi baru" htmlFor="pw-confirm" error={pw.formState.errors.confirm?.message}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" {...pw.register("confirm")} />
        </Field>
        <Button type="submit" variant="outline" loading={pw.formState.isSubmitting} className="self-start">
          Ganti kata sandi
        </Button>
      </form>
      <div className="border-t border-line px-5 py-3">
        <Button
          variant="danger-ghost"
          className="-ml-3"
          onClick={async () => {
            await signOut();
            navigate("/masuk", { replace: true });
          }}
        >
          <LogOut /> Keluar
        </Button>
      </div>
    </Card>
  );
}

function PrivacyCard() {
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <ShieldCheck className="size-4 text-primary" aria-hidden /> Data & privasi
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600">
        <li>Yang disimpan: profil (nama, kampus, prodi, semester, target IPK, uang bulanan), mata kuliah, jadwal, tugas, nilai, anggaran, transaksi, dan agenda.</li>
        <li>Setiap data hanya bisa dibaca & diubah oleh akunmu sendiri (Row Level Security di database).</li>
        <li>Kata sandi dikelola Supabase Auth dan tidak pernah disimpan sebagai teks biasa oleh aplikasi ini.</li>
        <li>Tidak ada data yang dijual atau dibagikan ke pihak lain oleh aplikasi ini.</li>
      </ul>
    </Card>
  );
}
