import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-primary-soft text-primary-dark",
  green: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/15",
  yellow: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-500/20",
  red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15",
  outline: "border border-line text-muted",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3", tones[tone], className)}>
      {children}
    </span>
  );
}
