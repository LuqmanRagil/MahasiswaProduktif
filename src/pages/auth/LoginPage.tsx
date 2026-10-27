import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { supabase } from "@/lib/supabase";
import { loginSchema } from "@/schemas";
import { authErrorMessage } from "@/auth/authErrors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthShell } from "./AuthShell";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await supabase!.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return setError(authErrorMessage(error));
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== "/masuk" ? from : "/", { replace: true });
  });

  return (
    <AuthShell
      title="Masuk ke akunmu"
      description="Lanjutkan mengatur tugas, jadwal, dan uang bulananmu."
      footer={
        <>
          Belum punya akun?{" "}
          <Link to="/daftar" className="font-semibold text-primary hover:underline">
            Daftar gratis
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
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" inputMode="email" aria-invalid={!!formState.errors.email} {...register("email")} />
        </Field>
        <Field label="Kata sandi" htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
        </Field>
        <Link to="/lupa-password" className="-mt-1 self-end text-[13px] font-medium text-primary hover:underline">
          Lupa kata sandi?
        </Link>
        <Button type="submit" size="lg" loading={formState.isSubmitting}>
          Masuk
        </Button>
      </form>
    </AuthShell>
  );
}
