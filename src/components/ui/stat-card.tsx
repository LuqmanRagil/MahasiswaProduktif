import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Angka ringkasan. Satu angka, satu label — tanpa dekorasi berlebih. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-[var(--shadow-card)]",
        onClick && "transition-colors hover:border-blue-200 hover:bg-blue-50/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {icon && (
          <span
            className={cn(
              "[&_svg]:size-4",
              tone === "default" && "text-slate-400",
              tone === "warning" && "text-amber-500",
              tone === "danger" && "text-red-500",
              tone === "success" && "text-green-600",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="tabular mt-2 text-2xl font-bold tracking-tight text-ink">{value}</span>
      {hint && <span className="mt-1 text-[12.5px] text-muted">{hint}</span>}
    </Comp>
  );
}
