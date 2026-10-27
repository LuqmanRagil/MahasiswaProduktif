import { BookOpen, CalendarClock, ClipboardCheck, MapPin } from "lucide-react";
import { EVENT_STYLE, eventTypeLabel } from "@/lib/constants";
import { clock } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/services/calendar";

export function KindIcon({ item, className }: { item: AgendaItem; className?: string }) {
  const I = item.kind === "class" ? BookOpen : item.kind === "deadline" ? ClipboardCheck : CalendarClock;
  return <I className={cn("size-3.5", className)} aria-hidden />;
}

/** Baris agenda (dipakai di dashboard, daftar agenda, panel hari). */
export function AgendaRow({ item, onClick, now }: { item: AgendaItem; onClick: () => void; now?: number }) {
  const s = EVENT_STYLE[item.type];
  const past = now !== undefined && new Date(item.end ?? item.start).getTime() < now;
  return (
    <li>
      <button type="button" onClick={onClick} className={cn("flex w-full items-stretch gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-50", past && "opacity-55")}>
        <div className="tabular w-12 shrink-0 pt-0.5 text-right text-[13px] leading-tight">
          <p className="font-semibold text-ink">{clock(item.start)}</p>
          {item.end && <p className="text-muted">{clock(item.end)}</p>}
        </div>
        <span className={cn("w-1 shrink-0 rounded-full", s.bar)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <KindIcon item={item} />
              {item.kind === "deadline" ? "Deadline" : eventTypeLabel(item.type)}
              {item.subtitle && ` · ${item.subtitle}`}
            </span>
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {item.location}
              </span>
            )}
          </p>
        </div>
      </button>
    </li>
  );
}

/** Chip kecil di sel kalender bulanan */
export function AgendaChip({ item, onClick }: { item: AgendaItem; onClick: () => void }) {
  const s = EVENT_STYLE[item.type];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${clock(item.start)} ${item.title} (${item.kind === "deadline" ? "Deadline" : eventTypeLabel(item.type)})`}
      className={cn("flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] leading-snug font-medium", s.soft, s.text)}
    >
      <span className="tabular shrink-0 opacity-75">{clock(item.start)}</span>
      <span className="truncate">{item.title}</span>
    </button>
  );
}
