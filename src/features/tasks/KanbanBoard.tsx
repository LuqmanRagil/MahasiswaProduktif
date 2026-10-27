import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { STATUS_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { positionBetween } from "@/services/tasks";
import type { Course, Task, TaskStatus } from "@/types/db";
import { TaskCard } from "./TaskCard";

const COLUMNS: TaskStatus[] = ["todo", "doing", "done"];
const COLUMN_DOT: Record<TaskStatus, string> = { todo: "bg-slate-400", doing: "bg-primary", done: "bg-success" };

export interface KanbanProps {
  /** Tugas per kolom yang sudah difilter & diurutkan */
  columns: Record<TaskStatus, Task[]>;
  courses: Map<string, Course>;
  subtaskCount: Map<string, { done: number; total: number }>;
  manualOrder: boolean;
  onOpen: (t: Task) => void;
  onAdd: (status: TaskStatus) => void;
  onMove: (task: Task, status: TaskStatus, position: number) => void;
}

function DraggableCard({ task, ...props }: { task: Task } & Omit<React.ComponentProps<typeof TaskCard>, "task">) {
  const drag = useDraggable({ id: task.id, data: { task } });
  const drop = useDroppable({ id: `card:${task.id}`, data: { task } });
  return (
    <TaskCard
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      task={task}
      dragging={drag.isDragging}
      className={cn("touch-manipulation", drop.isOver && !drag.isDragging && "ring-2 ring-primary/40")}
      {...drag.attributes}
      {...drag.listeners}
      {...props}
    />
  );
}

function Column({ status, children, count, onAdd }: { status: TaskStatus; children: React.ReactNode; count: number; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { status } });
  return (
    <section
      aria-label={`Kolom ${STATUS_LABEL[status]}`}
      className={cn(
        "flex w-[85vw] max-w-sm shrink-0 snap-start flex-col rounded-2xl border border-transparent bg-slate-100/70 p-2.5 sm:w-auto sm:max-w-none sm:shrink",
        isOver && "border-primary/30 bg-primary-soft/40",
      )}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className={cn("size-2 rounded-full", COLUMN_DOT[status])} aria-hidden />
          {STATUS_LABEL[status]}
          <span className="tabular rounded-md bg-surface px-1.5 text-xs font-medium text-muted">{count}</span>
        </h2>
        <button type="button" onClick={onAdd} className="rounded-md p-1 text-muted hover:bg-surface hover:text-ink" aria-label={`Tambah tugas ke ${STATUS_LABEL[status]}`}>
          <Plus className="size-4" />
        </button>
      </header>
      <div ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2">
        {children}
        {count === 0 && (
          <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-[13px] text-muted">
            {status === "done" ? "Seret tugas yang sudah beres ke sini" : "Belum ada tugas"}
          </p>
        )}
      </div>
    </section>
  );
}

export function KanbanBoard({ columns, courses, subtaskCount, manualOrder, onOpen, onAdd, onMove }: KanbanProps) {
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Di HP: tahan sebentar untuk menyeret, supaya geser layar tetap bisa.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const allById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const s of COLUMNS) for (const t of columns[s]) m.set(t.id, t);
    return m;
  }, [columns]);

  const handleStart = (e: DragStartEvent) => setActive(allById.get(String(e.active.id)) ?? null);

  const handleEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = allById.get(String(e.active.id));
    if (!task || !e.over) return;
    const overId = String(e.over.id);
    let status: TaskStatus;
    let position: number;
    if (overId.startsWith("col:")) {
      // Dilepas di area kosong kolom → taruh paling bawah kolom tsb.
      status = overId.slice(4) as TaskStatus;
      if (status === task.status) return;
      const list = columns[status];
      position = positionBetween(list.length ? Math.max(...list.map((t) => t.position)) : undefined, undefined);
    } else {
      const target = allById.get(overId.slice(5));
      if (!target || target.id === task.id) return;
      status = target.status;
      if (status === task.status && !manualOrder) return; // urutan otomatis: hanya pindah kolom
      // Taruh tepat sebelum kartu tujuan (berdasarkan urutan posisi asli).
      const list = [...columns[status]].filter((t) => t.id !== task.id).sort((a, b) => a.position - b.position);
      const idx = list.findIndex((t) => t.id === target.id);
      position = positionBetween(list[idx - 1]?.position, list[idx].position);
    }
    if (status === task.status && position === task.position) return;
    onMove(task, status, position);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleStart} onDragEnd={handleEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {COLUMNS.map((status) => (
          <Column key={status} status={status} count={columns[status].length} onAdd={() => onAdd(status)}>
            {columns[status].map((t) => {
              const sc = subtaskCount.get(t.id);
              return (
                <DraggableCard
                  key={t.id}
                  task={t}
                  course={t.course_id ? courses.get(t.course_id) : undefined}
                  subtaskDone={sc?.done ?? 0}
                  subtaskTotal={sc?.total ?? 0}
                  onOpen={() => onOpen(t)}
                  onMove={(s) => {
                    const list = columns[s];
                    onMove(t, s, positionBetween(list.length ? Math.max(...list.map((x) => x.position)) : undefined, undefined));
                  }}
                />
              );
            })}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        {active ? (
          <TaskCard
            task={active}
            course={active.course_id ? courses.get(active.course_id) : undefined}
            subtaskDone={subtaskCount.get(active.id)?.done ?? 0}
            subtaskTotal={subtaskCount.get(active.id)?.total ?? 0}
            onOpen={() => {}}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
