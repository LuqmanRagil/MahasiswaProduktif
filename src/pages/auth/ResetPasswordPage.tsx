import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resetSchema } from "@/schemas";
import { useAuth } from "@/auth/AuthProvider";
import { authErrorMessage } from "@/auth/authErrors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { AuthShell } from "./AuthShell";

export function ResetPasswordPage() {
  const { status, localMode, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (localMode) return <Navigate to="/" replace />;
  if (status === "loading") return <LoadingState className="min-h-dvh" label="Memverifikasi link…" />;

  if (status === "signed-out") {
    return (
      <AuthShell title="Link tidak valid" description="Link reset sudah kedaluwarsa atau sudah pernah dipakai.">
        <Link to="/lupa-password" className="text-sm font-semibold text-primary hover:underline">
          Minta link baru
        </Link>
      </AuthShell>
    );
  }

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const { error } = await supabase!.auth.updateUser({ password: v.password });
    if (error) return setError(authErrorMessage(error));
    clearRecovery();
    toast.success("Kata sandi berhasil diganti");
    navigate("/", { replace: true });
  });

  return (
    <AuthShell title="Buat kata sandi baru" description="Gunakan minimal 8 karakter berisi huruf dan angka.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}
        <Field label="Kata sandi baru" htmlFor="password" error={formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
        </Field>
        <Field label="Ulangi kata sandi baru" htmlFor="confirm" error={formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.confirm} {...register("confirm")} />
        </Field>
        <Button type="submit" size="lg" loading={formState.isSubmitting}>
          Simpan kata sandi
        </Button>
      </form>
    </AuthShell>
  );
}
