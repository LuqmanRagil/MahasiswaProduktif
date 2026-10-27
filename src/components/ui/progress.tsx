import { cn, clamp } from "@/lib/utils";

const tones = { blue: "bg-primary", green: "bg-success", yellow: "bg-warning", red: "bg-danger" } as const;

export function Progress({ value, tone = "blue", className, label }: { value: number; tone?: keyof typeof tones; className?: string; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(value, 0, 100))}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", tones[tone])} style={{ width: `${clamp(value, 0, 100)}%` }} />
    </div>
  );
}
