import { forwardRef, type HTMLAttributes } from "react";
import { AlarmClock, CheckSquare, MoreHorizontal } from "lucide-react";
import { COURSE_COLORS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { clock, shortDate } from "@/lib/format";
import { toDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { dueState } from "@/services/tasks";
import type { Course, Task, TaskStatus } from "@/types/db";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Menu, MenuItem } from "@/components/ui/menu";

export const PRIORITY_TONE: Record<Task["priority"], BadgeTone> = { low: "green", medium: "yellow", high: "red" };

export function DueLabel({ task, className }: { task: Pick<Task, "due_at" | "status">; className?: string }) {
  if (!task.due_at) return <span className={cn("text-muted", className)}>Tanpa deadline</span>;
  const state = dueState(task);
  const d = toDateStr(task.due_at);
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1",
        state === "terlambat" ? "font-medium text-red-600" : state === "segera" ? "font-medium text-amber-700" : "text-muted",
        className,
      )}
    >
      <AlarmClock className="size-3.5" aria-hidden />
      {state === "terlambat" && "Terlambat · "}
      {shortDate(d)}, {clock(task.due_at)}
    </span>
  );
}

interface TaskCardProps extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  course?: Course;
  subtaskDone: number;
  subtaskTotal: number;
  onOpen: () => void;
  onMove?: (s: TaskStatus) => void;
  dragging?: boolean;
  overlay?: boolean;
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(function TaskCard(
  { task, course, subtaskDone, subtaskTotal, onOpen, onMove, dragging, overlay, className, ...rest },
  ref,
) {
  const color = course ? COURSE_COLORS[course.color] : null;
  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "group relative rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] transition-[border-color,box-shadow]",
        "hover:border-blue-200",
        dragging && "opacity-40",
        overlay && "rotate-[1.5deg] cursor-grabbing shadow-[var(--shadow-pop)]",
        task.status === "done" && "bg-slate-50/60",
        className,
      )}
    >
      <button type="button" onClick={onOpen} className="absolute inset-0 z-0 rounded-xl" aria-label={`Buka tugas ${task.title}`} />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start justify-between gap-2">
          {course ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
              <span className={cn("size-2 shrink-0 rounded-full", color?.dot)} />
              <span className="truncate">{course.name}</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">Tanpa mata kuliah</span>
          )}
          <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        </div>
        <p className={cn("mt-1.5 text-[14.5px] leading-snug font-semibold text-ink", task.status === "done" && "text-slate-500 line-through decoration-slate-300")}>
          {task.title}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <DueLabel task={task} />
          {subtaskTotal > 0 && (
            <span className={cn("tabular inline-flex items-center gap-1", subtaskDone === subtaskTotal ? "text-green-700" : "text-muted")}>
              <CheckSquare className="size-3.5" aria-hidden />
              {subtaskDone}/{subtaskTotal}
            </span>
          )}
          {task.is_demo && <Badge tone="outline">contoh</Badge>}
        </div>
      </div>
      {onMove && (
        <div className="absolute right-2 bottom-2 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <Menu
            trigger={
              <button
                type="button"
                className="rounded-md bg-surface p-1 text-muted shadow-sm ring-1 ring-line hover:text-ink"
                aria-label="Pindahkan tugas"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          >
            {(["todo", "doing", "done"] as const)
              .filter((s) => s !== task.status)
              .map((s) => (
                <MenuItem key={s} onSelect={() => onMove(s)}>
                  Pindah ke {STATUS_LABEL[s]}
                </MenuItem>
              ))}
          </Menu>
        </div>
      )}
    </div>
  );
});
