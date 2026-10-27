import { forwardRef } from "react";
import { formatNumber, parseRupiahInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Input rupiah dengan pemisah ribuan otomatis, keyboard angka di HP. */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  { value: number; onChange: (v: number) => void; id?: string; className?: string; autoFocus?: boolean; "aria-invalid"?: boolean; placeholder?: string; large?: boolean }
>(function MoneyInput({ value, onChange, className, large, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <span className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-medium text-muted", large ? "text-lg" : "text-sm")}>Rp</span>
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        value={value ? formatNumber(value) : ""}
        onChange={(e) => onChange(Math.min(parseRupiahInput(e.target.value), 1_000_000_000))}
        className={cn(
          "tabular w-full rounded-[10px] border border-line bg-surface pr-3 font-semibold text-ink outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-danger",
          large ? "h-14 pl-11 text-2xl" : "h-10 pl-10 text-[15px] sm:text-sm",
        )}
        placeholder={props.placeholder ?? "0"}
        {...props}
      />
    </div>
  );
});
