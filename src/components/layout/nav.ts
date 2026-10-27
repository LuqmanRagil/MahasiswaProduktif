import { Calculator, CalendarDays, ClipboardList, History, LayoutDashboard, LibraryBig, PiggyBank, Settings, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", items: [{ to: "/", label: "Dashboard Utama", icon: LayoutDashboard, end: true }] },
  {
    label: "Akademik",
    items: [
      { to: "/tugas", label: "Tugas Kuliah", icon: ClipboardList },
      { to: "/mata-kuliah", label: "Mata Kuliah", icon: LibraryBig },
      { to: "/ipk", label: "Kalkulator IPK", icon: Calculator },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/keuangan", label: "Dashboard Keuangan", icon: Wallet, end: true },
      { to: "/keuangan/anggaran", label: "Anggaran Bulanan", icon: PiggyBank },
      { to: "/keuangan/transaksi", label: "Riwayat Transaksi", icon: History },
    ],
  },
  { label: "Produktivitas", items: [{ to: "/kalender", label: "Kalender Terpadu", icon: CalendarDays }] },
  { label: "Pengaturan", items: [{ to: "/pengaturan", label: "Profil & Pengaturan", icon: Settings }] },
];

export const BOTTOM_NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: LayoutDashboard, end: true },
  { to: "/tugas", label: "Tugas", icon: ClipboardList },
  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/keuangan", label: "Keuangan", icon: Wallet },
];
