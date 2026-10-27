import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { registerSchema } from "@/schemas";
import { authErrorMessage } from "@/auth/authErrors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthShell } from "./AuthShell";

export function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { data, error } = await supabase!.auth.signUp({
      email: v.email,
      password: v.password,
      options: { data: { full_name: v.fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return setError(authErrorMessage(error));
    // Jika konfirmasi email aktif, session masih kosong → minta cek email.
    if (!data.session) setSentTo(v.email);
  });

  if (sentTo) {
    return (
      <AuthShell title="Cek email kamu" description={<>Kami mengirim link konfirmasi ke <strong className="text-ink">{sentTo}</strong>.</>}>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
          <MailCheck className="size-10 text-primary" aria-hidden />
          <p className="text-sm text-muted">Buka email tersebut dan klik link konfirmasi, lalu masuk. Cek juga folder Spam/Promosi.</p>
          <Link to="/masuk" className="text-sm font-semibold text-primary hover:underline">
            Ke halaman masuk
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Buat akun gratis"
      description="Satu akun untuk tugas, jadwal, IPK, dan keuanganmu."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link to="/masuk" className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field label="Nama lengkap" htmlFor="name" error={formState.errors.fullName?.message}>
          <Input id="name" autoComplete="name" aria-invalid={!!formState.errors.fullName} {...register("fullName")} />
        </Field>
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register("email")} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message} hint="Minimal 8 karakter, berisi huruf dan angka.">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
        </Field>
        <Field label="Ulangi kata sandi" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.confirm} {...register("confirm")} />
        </Field>
        <Button type="submit" size="lg" loading={formState.isSubmitting}>
          Buat akun
        </Button>
      </form>
    </AuthShell>
  );
}
