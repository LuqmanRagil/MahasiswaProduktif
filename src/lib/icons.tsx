import { BookOpen, Bus, Coffee, Gift, Home, PiggyBank, Printer, Shield, ShoppingBag, Utensils, Wallet, Wifi, Heart, Shirt, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home,
  utensils: Utensils,
  bus: Bus,
  printer: Printer,
  wifi: Wifi,
  book: BookOpen,
  piggy: PiggyBank,
  coffee: Coffee,
  shield: Shield,
  wallet: Wallet,
  bag: ShoppingBag,
  gift: Gift,
  heart: Heart,
  shirt: Shirt,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const I = CATEGORY_ICONS[name] ?? Wallet;
  return <I className={className} aria-hidden />;
}
