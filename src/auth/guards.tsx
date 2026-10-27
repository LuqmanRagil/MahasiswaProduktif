import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useProfile } from "@/hooks/useProfile";
import { friendlyError } from "@/data";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "./AuthProvider";

function FullScreen({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-6">{children}</div>;
}

/** Halaman aplikasi hanya untuk pengguna yang sudah masuk. */
export function RequireAuth() {
  const { status, recovering } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return (
      <FullScreen>
        <LoadingState label="Memeriksa sesi…" />
      </FullScreen>
    );
  }
  if (recovering) return <Navigate to="/reset-password" replace />;
  if (status === "signed-out") return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Pengguna baru diarahkan ke onboarding sebelum masuk dashboard. */
export function RequireOnboarded() {
  const profile = useProfile();
  if (profile.isLoading) {
    return (
      <FullScreen>
        <LoadingState label="Menyiapkan akunmu…" />
      </FullScreen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <FullScreen>
        <ErrorState
          message={profile.error ? friendlyError(profile.error) : "Profil tidak ditemukan. Coba keluar lalu masuk lagi."}
          onRetry={() => profile.refetch()}
        />
      </FullScreen>
    );
  }
  if (!profile.data.onboarded_at) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Halaman masuk/daftar tidak perlu dibuka lagi kalau sudah masuk. */
export function GuestOnly() {
  const { status, localMode, recovering } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (localMode) return <Navigate to="/" replace />;
  if (status === "loading") {
    return (
      <FullScreen>
        <LoadingState />
      </FullScreen>
    );
  }
  if (recovering) return <Navigate to="/reset-password" replace />;
  // Setelah login, kembali ke halaman yang tadi ingin dibuka.
  if (status === "signed-in") return <Navigate to={from && !from.startsWith("/masuk") ? from : "/"} replace />;
  return <Outlet />;
}
