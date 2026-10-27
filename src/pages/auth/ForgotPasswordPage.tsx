import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { supabase } from "@/lib/supabase";
import { forgotSchema } from "@/schemas";
import { authErrorMessage } from "@/auth/authErrors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthShell } from "./AuthShell";

export function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await supabase!.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return setError(authErrorMessage(error));
    setSent(true);
  });

  return (
    <AuthShell
      title="Lupa kata sandi"
      description="Masukkan email akunmu. Kami kirimkan link untuk membuat kata sandi baru."
      footer={
        <Link to="/masuk" className="font-semibold text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
          Jika email tersebut terdaftar, link reset kata sandi sudah dikirim. Cek kotak masuk (dan folder Spam).
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register("email")} />
          </Field>
          <Button type="submit" size="lg" loading={formState.isSubmitting}>
            Kirim link reset
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
