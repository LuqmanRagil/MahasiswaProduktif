import { Suspense, useState } from "react";
import { LoadingState } from "@/components/ui/states";
import { NavLink, Outlet, useNavigate } from "react-router";
import { FlaskConical, LogOut, Menu as MenuIcon, Plus, Receipt } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useAuth } from "@/auth/AuthProvider";
import { useQuickActions } from "@/features/quick/QuickActions";
import { useProfile } from "@/hooks/useProfile";
import { useToday } from "@/hooks/useToday";
import { longDate, shortDate, weekdayShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { BOTTOM_NAV, NAV_GROUPS } from "./nav";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "M"
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { addExpense } = useQuickActions();
  const { signOut, localMode } = useAuth();
  const navigate = useNavigate();
  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-xs font-medium text-slate-400">{g.label}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                      isActive ? "bg-primary-soft text-primary-dark" : "text-slate-600 hover:bg-slate-100 hover:text-ink",
                    )
                  }
                >
                  <it.icon className="size-[18px]" aria-hidden />
                  {it.label}
                </NavLink>
              </li>
            ))}
            {g.label === "Keuangan" && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate?.();
                    addExpense();
                  }}
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <Receipt className="size-[18px]" aria-hidden />
                  Catat Pengeluaran
                </button>
              </li>
            )}
            {g.label === "Pengaturan" && !localMode && (
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    onNavigate?.();
                    await signOut();
                    navigate("/masuk", { replace: true });
                  }}
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="size-[18px]" aria-hidden />
                  Keluar
                </button>
              </li>
            )}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ProfileChip() {
  const { data: profile } = useProfile();
  const { email, localMode } = useAuth();
  const name = profile?.full_name || "Mahasiswa";
  return (
    <NavLink to="/pengaturan" className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-slate-100">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-dark">
        {initials(name)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        <span className="block truncate text-xs text-muted">{localMode ? "Mode Coba" : (email ?? "")}</span>
      </span>
    </NavLink>
  );
}

export function AppLayout() {
  const { localMode } = useAuth();
  const { addExpense } = useQuickActions();
  const today = useToday();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      {localMode && (
        <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-1.5 text-center text-[12.5px] text-amber-900 lg:pl-64">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Mode Coba</strong> — data hanya tersimpan di browser ini, belum tersambung ke Supabase.
          </span>
        </div>
      )}

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 pb-4">
          <Logo />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          <NavList />
        </div>
        <div className="border-t border-line p-3">
          <ProfileChip />
        </div>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Logo compact />
        <span className="text-[13px] font-medium text-muted">
          {weekdayShort(today)}, {shortDate(today)}
        </span>
      </header>

      {/* Header desktop */}
      <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-line bg-bg/90 pr-8 pl-72 backdrop-blur lg:flex">
        <p className="text-sm text-muted">{longDate(today)}</p>
        <button
          type="button"
          onClick={addExpense}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
        >
          <Plus className="size-4" aria-hidden />
          Catat Pengeluaran
        </button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-32 sm:px-6 lg:pt-6 lg:pr-8 lg:pb-12 lg:pl-72 lg:max-w-none xl:pr-12">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<LoadingState className="min-h-[50dvh]" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {/* Tombol mengambang catat pengeluaran (HP & tablet) */}
      <button
        type="button"
        onClick={addExpense}
        className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary pr-5 pl-4 text-sm font-semibold text-white shadow-[var(--shadow-pop)] transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="size-5" aria-hidden />
        Catat Pengeluaran
      </button>

      {/* Navigasi bawah HP */}
      <nav aria-label="Navigasi cepat" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM_NAV.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.end}
                className={({ isActive }) =>
                  cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive ? "text-primary" : "text-slate-500")
                }
              >
                <it.icon className="size-[22px]" aria-hidden />
                {it.label}
              </NavLink>
            </li>
          ))}
          <li>
            <D.Root open={moreOpen} onOpenChange={setMoreOpen}>
              <D.Trigger className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-slate-500">
                <MenuIcon className="size-[22px]" aria-hidden />
                Lainnya
              </D.Trigger>
              <D.Portal>
                <D.Overlay className="fixed inset-0 z-50 bg-slate-900/40 data-[state=open]:animate-in" />
                <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-xs flex-col bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-in">
                  <D.Title className="sr-only">Menu</D.Title>
                  <D.Description className="sr-only">Semua halaman aplikasi</D.Description>
                  <div className="px-5 pt-5 pb-4">
                    <Logo />
                  </div>
                  <div className="flex-1 overflow-y-auto px-3 pb-4">
                    <NavList onNavigate={() => setMoreOpen(false)} />
                  </div>
                  <div className="pb-safe border-t border-line p-3" onClick={() => setMoreOpen(false)}>
                    <ProfileChip />
                  </div>
                </D.Content>
              </D.Portal>
            </D.Root>
          </li>
        </ul>
      </nav>
    </div>
  );
}
