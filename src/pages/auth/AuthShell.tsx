import type { ReactNode } from "react";
import { CalendarCheck2, ClipboardCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="9" fill="#fff" />
            <path d="M9 22V10l7 6 7-6v12" fill="none" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[15px] font-bold">Mahasiswa Produktif</span>
        </div>
        <div className="max-w-md">
          <p className="text-[34px] leading-[1.15] font-bold tracking-tight">Atur Kuliahmu, Kelola Uangmu, Bangun Masa Depanmu.</p>
          <ul className="mt-8 space-y-4 text-[15px] text-blue-50">
            <li className="flex gap-3">
              <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
              Deadline tugas tidak lagi terlewat — semua terkumpul di satu papan.
            </li>
            <li className="flex gap-3">
              <Wallet className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
              Tahu sisa jatah uang per hari sebelum kiriman berikutnya datang.
            </li>
            <li className="flex gap-3">
              <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-white" aria-hidden />
              Jadwal kuliah, rapat, dan ujian dalam satu kalender, lengkap dengan cek bentrok.
            </li>
          </ul>
        </div>
        <p className="text-[13px] text-blue-50">© {new Date().getFullYear()} Mahasiswa Produktif</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Logo className="lg:hidden" />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
