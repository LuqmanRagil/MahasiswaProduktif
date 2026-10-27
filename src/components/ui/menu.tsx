import type { ReactNode } from "react";
import { DropdownMenu as M } from "radix-ui";
import { cn } from "@/lib/utils";

export function Menu({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-44 rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)] data-[state=open]:animate-pop"
        >
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function MenuItem({ children, onSelect, danger }: { children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-slate-100 [&_svg]:size-4",
        danger ? "text-red-600 data-[highlighted]:bg-red-50" : "text-ink [&_svg]:text-muted",
      )}
    >
      {children}
    </M.Item>
  );
}
