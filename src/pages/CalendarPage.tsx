import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { friendlyError } from "@/data";
import { useToday } from "@/hooks/useToday";
import { EVENT_STYLE, EVENT_TYPES } from "@/lib/constants";
import { DAY_NAMES, longDate, monthYear, shortDate, weekdayShort } from "@/lib/format";
import { addDays, addMonths, daysBetween, endOfMonth, startOfMonth, startOfWeek, timeToMinutes, toDateStr, toTimeStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { itemsOnDate, type AgendaItem } from "@/services/calendar";
import { AgendaChip, AgendaRow } from "@/features/calendar/AgendaItemView";
import { useAgenda, useOpenAgendaItem } from "@/features/calendar/useAgenda";
import { useQuickActions } from "@/features/quick/QuickActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type View = "month" | "week" | "day" | "list";

function rangeFor(view: View, cursor: string): [string, string] {
  if (view === "month") {
    const s = startOfWeek(startOfMonth(cursor));
    return [s, addDays(startOfWeek(endOfMonth(cursor)), 6)];
  }
  if (view === "week") {
    const s = startOfWeek(cursor);
    return [s, addDays(s, 6)];
  }
  if (view === "day") return [cursor, cursor];
  return [cursor, addDays(cursor, 29)];
}

export function CalendarPage() {
  const today = useToday();
  const { addEvent } = useQuickActions();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [from, to] = rangeFor(view, cursor);
  const agenda = useAgenda(from, to);
  const open = useOpenAgendaItem(agenda.events, agenda.tasks);

  const step = (dir: 1 | -1) => {
    const next = view === "month" ? addMonths(cursor, dir) : view === "week" ? addDays(cursor, 7 * dir) : view === "day" ? addDays(cursor, dir) : addDays(cursor, 30 * dir);
    setCursor(next);
    if (view === "month") setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : startOfMonth(next));
    else setSelected(next);
  };
  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const title =
    view === "month"
      ? monthYear(cursor)
      : view === "week"
        ? `${shortDate(from)} – ${shortDate(to)}`
        : view === "day"
          ? longDate(cursor)
          : `${shortDate(from)} – ${shortDate(to)}`;

  return (
    <>
      <PageHeader
        title="Kalender Terpadu"
        description="Jadwal kuliah, deadline tugas, ujian, dan kegiatan organisasi dalam satu tempat. Waktu dalam WIB."
        actions={
          <Button onClick={() => addEvent({ date: selected >= today ? selected : today })}>
            <Plus /> Tambah agenda
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-10 items-center rounded-[10px] border border-line bg-surface">
            <button type="button" onClick={() => step(-1)} className="flex h-full w-9 items-center justify-center text-muted hover:text-ink" aria-label="Sebelumnya">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => step(1)} className="flex h-full w-9 items-center justify-center text-muted hover:text-ink" aria-label="Berikutnya">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Button variant="outline" onClick={goToday}>
            Hari ini
          </Button>
          <h2 className="ml-1 text-base font-semibold capitalize sm:text-lg">{title}</h2>
        </div>
        <Segmented
          label="Tampilan kalender"
          value={view}
          onChange={(v) => {
            setView(v);
            setCursor(selected);
          }}
          options={[
            { value: "month", label: "Bulan" },
            { value: "week", label: "Minggu" },
            { value: "day", label: "Hari" },
            { value: "list", label: "Daftar" },
          ]}
        />
      </div>

      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Keterangan warna">
        {[{ value: "deadline", label: "Deadline tugas" } as const, ...EVENT_TYPES].map((t) => (
          <li key={t.value} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", EVENT_STYLE[t.value].bar)} aria-hidden />
            {t.label}
          </li>
        ))}
      </ul>

      {agenda.isLoading ? (
        <LoadingState />
      ) : agenda.error ? (
        <ErrorState message={friendlyError(agenda.error)} onRetry={agenda.refetch} />
      ) : view === "month" ? (
        <MonthView cursor={cursor} from={from} to={to} today={today} items={agenda.items} selected={selected} onSelect={setSelected} onOpen={open} onAdd={(d) => addEvent({ date: d })} />
      ) : view === "week" ? (
        <WeekView from={from} today={today} items={agenda.items} onOpen={open} onAdd={(d) => addEvent({ date: d })} />
      ) : view === "day" ? (
        <DayView date={cursor} items={itemsOnDate(agenda.items, cursor)} onOpen={open} onAdd={(t) => addEvent({ date: cursor, start_time: t })} />
      ) : (
        <ListView from={from} to={to} today={today} items={agenda.items} onOpen={open} />
      )}
    </>
  );
}

function MonthView({
  cursor,
  from,
  to,
  today,
  items,
  selected,
  onSelect,
  onOpen,
  onAdd,
}: {
  cursor: string;
  from: string;
  to: string;
  today: string;
  items: AgendaItem[];
  selected: string;
  onSelect: (d: string) => void;
  onOpen: (i: AgendaItem) => void;
  onAdd: (d: string) => void;
}) {
  const days = daysBetween(from, to);
  const month = cursor.slice(0, 7);
  const byDay = useMemo(() => new Map(days.map((d) => [d, itemsOnDate(items, d)])), [items, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const selItems = byDay.get(selected) ?? itemsOnDate(items, selected);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-slate-50/70">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted">
              {d.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.slice(0, 7) === month;
            const isToday = d === today;
            const isSel = d === selected;
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(d)}
                onDoubleClick={() => onAdd(d)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(d))}
                aria-label={`${longDate(d)}, ${list.length} agenda`}
                aria-pressed={isSel}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col gap-1 border-line p-1 text-left outline-none sm:min-h-28 sm:p-1.5",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  !inMonth && "bg-slate-50/60",
                  isSel && "bg-primary-soft/50 ring-2 ring-primary ring-inset",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-6 items-center justify-center self-center rounded-full text-xs font-medium sm:self-start",
                    isToday ? "bg-primary text-white" : inMonth ? "text-ink" : "text-slate-400",
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {/* HP: titik; layar lebar: chip */}
                <div className="flex justify-center gap-0.5 sm:hidden">
                  {list.slice(0, 3).map((it) => (
                    <span key={it.key} className={cn("size-1.5 rounded-full", EVENT_STYLE[it.type].bar)} />
                  ))}
                </div>
                <div className="hidden flex-col gap-0.5 sm:flex">
                  {list.slice(0, 3).map((it) => (
                    <AgendaChip key={it.key} item={it} onClick={() => onOpen(it)} />
                  ))}
                  {list.length > 3 && <span className="px-1.5 text-[11px] font-medium text-muted">+{list.length - 3} lainnya</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="h-fit">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="text-xs text-muted">{selected === today ? "Hari ini" : weekdayShort(selected)}</p>
            <p className="text-[15px] font-semibold">{longDate(selected)}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onAdd(selected)}>
            <Plus /> Agenda
          </Button>
        </div>
        {selItems.length ? (
          <ul className="px-2 pb-3">
            {selItems.map((it) => (
              <AgendaRow key={it.key} item={it} onClick={() => onOpen(it)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-5 text-sm text-muted">Tidak ada agenda.</p>
        )}
      </Card>
    </div>
  );
}

function WeekView({ from, today, items, onOpen, onAdd }: { from: string; today: string; items: AgendaItem[]; onOpen: (i: AgendaItem) => void; onAdd: (d: string) => void }) {
  const days = daysBetween(from, addDays(from, 6));
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-2">
      {days.map((d) => {
        const list = itemsOnDate(items, d);
        return (
          <Card key={d} className={cn("flex flex-col md:min-h-80", d === today && "border-primary/50 ring-1 ring-primary/30")}>
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-sm font-semibold">
                <span className={cn(d === today && "text-primary")}>{weekdayShort(d)}</span>{" "}
                <span className="tabular font-normal text-muted">{shortDate(d)}</span>
              </p>
              <button type="button" onClick={() => onAdd(d)} className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-ink" aria-label={`Tambah agenda ${longDate(d)}`}>
                <Plus className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-1.5">
              {list.length ? (
                list.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onOpen(it)}
                    className={cn("relative overflow-hidden rounded-lg py-1.5 pr-2 pl-3 text-left", EVENT_STYLE[it.type].soft)}
                  >
                    <span className={cn("absolute inset-y-0 left-0 w-[3px]", EVENT_STYLE[it.type].bar)} aria-hidden />
                    <p className={cn("tabular text-[11.5px] font-medium", EVENT_STYLE[it.type].text)}>
                      {toTimeStr(it.start).replace(":", ".")}
                      {it.end && `–${toTimeStr(it.end).replace(":", ".")}`}
                    </p>
                    <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink">{it.title}</p>
                  </button>
                ))
              ) : (
                <p className="px-1.5 py-2 text-xs text-slate-400">Kosong</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;
const PX_PER_MIN = 0.9;

/** Tampilan harian berbasis jam, agenda yang tumpang tindih ditaruh bersebelahan. */
function DayView({ date, items, onOpen, onAdd }: { date: string; items: AgendaItem[]; onOpen: (i: AgendaItem) => void; onAdd: (time: string) => void }) {
  const timed = items.map((it) => {
    const startsBefore = toDateStr(it.start) < date;
    const endsAfter = it.end ? toDateStr(new Date(new Date(it.end).getTime() - 1)) > date : false;
    const s = Math.min(DAY_END - 30, Math.max(DAY_START, startsBefore ? DAY_START : timeToMinutes(toTimeStr(it.start))));
    const e = it.end ? (endsAfter ? DAY_END : Math.min(DAY_END, timeToMinutes(toTimeStr(it.end)))) : s + 30;
    return { it, s, e: Math.max(e, s + 30) };
  });
  // Penempatan kolom sederhana untuk agenda yang bertabrakan.
  const cols: { e: number }[][] = [];
  const placed = timed
    .sort((a, b) => a.s - b.s)
    .map((t) => {
      let c = cols.findIndex((col) => col[col.length - 1].e <= t.s);
      if (c === -1) {
        cols.push([]);
        c = cols.length - 1;
      }
      cols[c].push(t);
      return { ...t, col: c };
    });
  const ncol = Math.max(1, cols.length);
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);

  return (
    <Card className="overflow-hidden">
      {items.length === 0 && (
        <EmptyState icon={<CalendarDays />} title="Hari ini kosong" description="Klik jam di bawah untuk menambah agenda." className="border-b border-line py-6" />
      )}
      <div className="relative" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
        {hours.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onAdd(`${String(h).padStart(2, "0")}:00`)}
            className="absolute inset-x-0 flex border-t border-line text-left hover:bg-slate-50/70"
            style={{ top: (h * 60 - DAY_START) * PX_PER_MIN, height: 60 * PX_PER_MIN }}
            aria-label={`Tambah agenda jam ${h}.00`}
          >
            <span className="tabular w-14 shrink-0 pt-1 pr-2 text-right text-[11px] text-muted">{String(h).padStart(2, "0")}.00</span>
          </button>
        ))}
        <div className="absolute inset-y-0 right-2 left-14">
          {placed.map(({ it, s, e, col }) => (
            <button
              key={it.key}
              type="button"
              onClick={() => onOpen(it)}
              className={cn("absolute overflow-hidden rounded-lg py-1 pr-2 pl-3 text-left shadow-sm", EVENT_STYLE[it.type].soft)}
              style={{
                top: (s - DAY_START) * PX_PER_MIN + 1,
                height: (e - s) * PX_PER_MIN - 2,
                left: `calc(${(col / ncol) * 100}% + 2px)`,
                width: `calc(${100 / ncol}% - 4px)`,
              }}
            >
              <span className={cn("absolute inset-y-0 left-0 w-[3px]", EVENT_STYLE[it.type].bar)} aria-hidden />
              <p className={cn("truncate text-[13px] font-semibold", EVENT_STYLE[it.type].text)}>{it.title}</p>
              <p className="tabular truncate text-[11.5px] text-slate-600">
                {toTimeStr(it.start).replace(":", ".")}
                {it.end ? `–${toTimeStr(it.end).replace(":", ".")}` : " · deadline"}
                {it.location && ` · ${it.location}`}
              </p>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ListView({ from, to, today, items, onOpen }: { from: string; to: string; today: string; items: AgendaItem[]; onOpen: (i: AgendaItem) => void }) {
  const days = daysBetween(from, to).filter((d) => itemsOnDate(items, d).length);
  if (!days.length) return <Card><EmptyState icon={<CalendarDays />} title="Tidak ada agenda 30 hari ke depan" /></Card>;
  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => (
        <Card key={d}>
          <p className={cn("border-b border-line px-4 py-2.5 text-[13px] font-semibold", d === today ? "text-primary" : "text-slate-700")}>
            {d === today ? "Hari ini — " : ""}
            {longDate(d)}
          </p>
          <ul className="px-2 py-2">
            {itemsOnDate(items, d).map((it) => (
              <AgendaRow key={it.key} item={it} onClick={() => onOpen(it)} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
