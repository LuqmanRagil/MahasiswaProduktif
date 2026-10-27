import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useRows } from "@/hooks/useData";
import { fromWib } from "@/lib/time";
import { buildAgenda, type AgendaItem } from "@/services/calendar";
import { useQuickActions } from "@/features/quick/QuickActions";
import type { CalendarEvent, Task } from "@/types/db";

/** Semua agenda (kuliah, deadline, kegiatan) pada rentang tanggal WIB [from, to]. */
export function useAgenda(from: string, to: string) {
  const events = useRows("calendar_events", {
    filters: [
      { column: "start_at", op: "lte", value: fromWib(to, "23:59") },
      { column: "end_at", op: "gte", value: fromWib(from) },
    ],
    order: [{ column: "start_at" }],
  });
  const schedules = useRows("course_schedules");
  const courses = useRows("courses");
  const tasks = useRows("tasks");

  const items = useMemo(
    () => buildAgenda({ events: events.data ?? [], schedules: schedules.data ?? [], courses: courses.data ?? [], tasks: tasks.data ?? [] }, from, to),
    [events.data, schedules.data, courses.data, tasks.data, from, to],
  );

  return {
    items,
    isLoading: events.isLoading || schedules.isLoading || courses.isLoading || tasks.isLoading,
    error: events.error || schedules.error || courses.error || tasks.error,
    refetch: () => events.refetch(),
    events: events.data ?? [],
    tasks: tasks.data ?? [],
  };
}

/** Aksi saat agenda diklik: buka form yang sesuai. */
export function useOpenAgendaItem(events: CalendarEvent[], tasks: Task[]) {
  const navigate = useNavigate();
  const { editEvent, editTask } = useQuickActions();
  return (item: AgendaItem) => {
    if (item.kind === "class" && item.courseId) navigate(`/mata-kuliah/${item.courseId}`);
    else if (item.kind === "deadline") {
      const t = tasks.find((x) => x.id === item.sourceId);
      if (t) editTask(t);
    } else {
      const e = events.find((x) => x.id === item.sourceId);
      if (e) editEvent(e);
    }
  };
}
