import { daysBetween, fromWib, isoWeekday, toDateStr } from "@/lib/time";
import type { CalendarEvent, Course, CourseSchedule, EventType, Task } from "@/types/db";

export type AgendaKind = "event" | "class" | "deadline";

export interface AgendaItem {
  /** unik per kemunculan */
  key: string;
  kind: AgendaKind;
  type: EventType | "deadline";
  title: string;
  subtitle?: string;
  start: string; // ISO
  end: string | null; // ISO (null untuk deadline)
  location: string;
  courseId: string | null;
  /** id baris sumber (event / schedule / task) */
  sourceId: string;
}

/** Ubah jadwal mingguan menjadi kemunculan nyata di rentang tanggal. */
export function expandSchedules(schedules: CourseSchedule[], courses: Course[], from: string, to: string): AgendaItem[] {
  const out: AgendaItem[] = [];
  const courseById = new Map(courses.map((c) => [c.id, c]));
  for (const date of daysBetween(from, to)) {
    const wd = isoWeekday(date);
    for (const s of schedules) {
      if (s.day_of_week !== wd) continue;
      const c = courseById.get(s.course_id);
      if (!c) continue;
      out.push({
        key: `class:${s.id}:${date}`,
        kind: "class",
        type: "kuliah",
        title: c.name,
        subtitle: c.code || undefined,
        start: fromWib(date, s.start_time.slice(0, 5)),
        end: fromWib(date, s.end_time.slice(0, 5)),
        location: s.room || c.room,
        courseId: c.id,
        sourceId: s.id,
      });
    }
  }
  return out;
}

export function deadlineItems(tasks: Task[], courses: Course[], from: string, to: string): AgendaItem[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return tasks
    .filter((t) => t.due_at && t.status !== "done")
    .filter((t) => {
      const d = toDateStr(t.due_at!);
      return d >= from && d <= to;
    })
    .map((t) => ({
      key: `deadline:${t.id}`,
      kind: "deadline" as const,
      type: "deadline" as const,
      title: t.title,
      subtitle: t.course_id ? courseById.get(t.course_id)?.name : undefined,
      start: t.due_at!,
      end: null,
      location: "",
      courseId: t.course_id,
      sourceId: t.id,
    }));
}

export function eventItems(events: CalendarEvent[], from: string, to: string): AgendaItem[] {
  return events
    .filter((e) => toDateStr(e.start_at) <= to && toDateStr(e.end_at) >= from)
    .map((e) => ({
      key: `event:${e.id}`,
      kind: "event" as const,
      type: e.type,
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      location: e.location,
      courseId: e.course_id,
      sourceId: e.id,
    }));
}

export function buildAgenda(
  input: { events: CalendarEvent[]; schedules: CourseSchedule[]; courses: Course[]; tasks: Task[] },
  from: string,
  to: string,
): AgendaItem[] {
  return [
    ...eventItems(input.events, from, to),
    ...expandSchedules(input.schedules, input.courses, from, to),
    ...deadlineItems(input.tasks, input.courses, from, to),
  ].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** Item yang terjadi pada tanggal (WIB) tertentu. */
export function itemsOnDate(items: AgendaItem[], date: string): AgendaItem[] {
  return items.filter((i) => {
    const s = toDateStr(i.start);
    if (!i.end) return s === date;
    // end eksklusif: agenda yang selesai tepat 00:00 tidak dihitung di hari berikutnya
    const e = toDateStr(new Date(new Date(i.end).getTime() - 1));
    return s <= date && e >= date;
  });
}

/** Cari agenda/kuliah yang bertabrakan dengan rentang waktu [start, end). Deadline diabaikan. */
export function findConflicts(start: string, end: string, items: AgendaItem[], ignoreKey?: string): AgendaItem[] {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return items.filter((i) => {
    if (i.kind === "deadline" || !i.end || i.key === ignoreKey) return false;
    return new Date(i.start).getTime() < e && s < new Date(i.end).getTime();
  });
}
