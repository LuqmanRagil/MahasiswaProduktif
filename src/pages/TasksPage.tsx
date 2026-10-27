import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Columns3, List, Plus, Search, SlidersHorizontal } from "lucide-react";
import { friendlyError } from "@/data";
import { useRows, useUpdate } from "@/hooks/useData";
import { useToday } from "@/hooks/useToday";
import { COURSE_COLORS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { addDays, toDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { sortTasks, statusPatch, type TaskSort } from "@/services/tasks";
import type { Task, TaskPriority, TaskStatus } from "@/types/db";
import { useQuickActions } from "@/features/quick/QuickActions";
import { KanbanBoard } from "@/features/tasks/KanbanBoard";
import { DueLabel, PRIORITY_TONE } from "@/features/tasks/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

type DeadlineFilter = "all" | "overdue" | "today" | "week" | "none";
type View = "kanban" | "list";

const VIEW_KEY = "mp:tampilan-tugas";
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "kanban";
  } catch {
    return "kanban";
  }
}

export function TasksPage() {
  const today = useToday();
  const { addTask, editTask } = useQuickActions();
  const tasks = useRows("tasks", { order: [{ column: "position" }] });
  const courses = useRows("courses", { order: [{ column: "name" }] });
  const subtasks = useRows("task_subtasks");
  const update = useUpdate("tasks");

  const [view, setViewState] = useState<View>(loadView);
  const [q, setQ] = useState("");
  const [course, setCourse] = useState("");
  const [priority, setPriority] = useState<"" | TaskPriority>("");
  const [status, setStatus] = useState<"" | TaskStatus>("");
  const [deadline, setDeadline] = useState<DeadlineFilter>("all");
  const [sort, setSort] = useState<"manual" | TaskSort>("manual");
  const [showFilters, setShowFilters] = useState(false);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* abaikan */
    }
  };

  const courseMap = useMemo(() => new Map((courses.data ?? []).map((c) => [c.id, c])), [courses.data]);
  const subtaskCount = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const s of subtasks.data ?? []) {
      const c = m.get(s.task_id) ?? { done: 0, total: 0 };
      c.total++;
      if (s.is_done) c.done++;
      m.set(s.task_id, c);
    }
    return m;
  }, [subtasks.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const now = Date.now();
    const list = (tasks.data ?? []).filter((t) => {
      if (needle && !t.title.toLowerCase().includes(needle)) return false;
      if (course && (course === "none" ? t.course_id !== null : t.course_id !== course)) return false;
      if (priority && t.priority !== priority) return false;
      if (status && t.status !== status) return false;
      if (deadline !== "all") {
        if (deadline === "none") return !t.due_at;
        if (!t.due_at) return false;
        const d = toDateStr(t.due_at);
        if (deadline === "overdue") return t.status !== "done" && new Date(t.due_at).getTime() < now;
        if (deadline === "today") return d === today;
        if (deadline === "week") return d >= today && d <= addDays(today, 7);
      }
      return true;
    });
    return sort === "manual" ? [...list].sort((a, b) => a.position - b.position) : sortTasks(list, sort);
  }, [tasks.data, q, course, priority, status, deadline, sort, today]);

  const columns = useMemo(() => {
    const c: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) c[t.status].push(t);
    return c;
  }, [filtered]);

  const move = (task: Task, s: TaskStatus, position: number) => {
    update.mutate(
      { id: task.id, patch: { ...statusPatch(task, s), position } },
      {
        onSuccess: () => {
          if (s !== task.status) toast.success(`"${task.title}" dipindah ke ${STATUS_LABEL[s]}`);
        },
        onError: (e) => toast.error(friendlyError(e)),
      },
    );
  };

  const activeFilters = [course, priority, status, deadline !== "all" ? deadline : ""].filter(Boolean).length;
  const resetFilters = () => {
    setQ("");
    setCourse("");
    setPriority("");
    setStatus("");
    setDeadline("all");
  };

  const loading = tasks.isLoading || courses.isLoading;
  const error = tasks.error || courses.error;
  const total = tasks.data?.length ?? 0;
  const open = (tasks.data ?? []).filter((t) => t.status !== "done").length;

  return (
    <>
      <PageHeader
        title="Tugas Kuliah"
        description={total ? `${open} belum selesai dari ${total} tugas` : "Kelola tugas dari semua mata kuliah"}
        actions={
          <>
            <Segmented
              label="Tampilan"
              value={view}
              onChange={setView}
              options={[
                { value: "kanban", label: "Kanban", icon: <Columns3 /> },
                { value: "list", label: "Daftar", icon: <List /> },
              ]}
            />
            <Button onClick={() => addTask()}>
              <Plus /> Tambah tugas
            </Button>
          </>
        }
      />

      {/* Filter & pencarian */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul tugas…" className="pl-9" aria-label="Cari tugas" />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="lg:hidden">
            <SlidersHorizontal /> Filter{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
        </div>
        <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid lg:grid-cols-5", !showFilters && "hidden lg:grid")}>
          <Select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter mata kuliah">
            <option value="">Semua mata kuliah</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Tanpa mata kuliah</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | "")} aria-label="Filter prioritas">
            <option value="">Semua prioritas</option>
            <option value="high">Prioritas tinggi</option>
            <option value="medium">Prioritas sedang</option>
            <option value="low">Prioritas rendah</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="todo">To-Do</option>
            <option value="doing">Dikerjakan</option>
            <option value="done">Selesai</option>
          </Select>
          <Select value={deadline} onChange={(e) => setDeadline(e.target.value as DeadlineFilter)} aria-label="Filter deadline">
            <option value="all">Semua deadline</option>
            <option value="overdue">Terlambat</option>
            <option value="today">Hari ini</option>
            <option value="week">7 hari ke depan</option>
            <option value="none">Tanpa deadline</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as "manual" | TaskSort)} aria-label="Urutkan" className="col-span-2 sm:col-span-1">
            <option value="manual">Urutan manual</option>
            <option value="deadline">Deadline terdekat</option>
            <option value="priority">Prioritas tertinggi</option>
            <option value="created">Terbaru dibuat</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={friendlyError(error)} onRetry={() => tasks.refetch()} />
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title="Belum ada tugas"
            description="Catat tugas pertamamu, lengkap dengan deadline dan mata kuliahnya."
            action={
              <Button onClick={() => addTask()}>
                <Plus /> Tambah tugas
              </Button>
            }
          />
        </Card>
      ) : view === "kanban" ? (
        <>
          {filtered.length === 0 && (
            <p className="mb-3 text-sm text-muted">
              Tidak ada tugas yang cocok dengan filter.{" "}
              <button className="font-medium text-primary hover:underline" onClick={resetFilters}>
                Reset filter
              </button>
            </p>
          )}
          <KanbanBoard
            columns={columns}
            courses={courseMap}
            subtaskCount={subtaskCount}
            manualOrder={sort === "manual"}
            onOpen={editTask}
            onAdd={(s) => addTask({ status: s })}
            onMove={move}
          />
          <p className="mt-3 hidden text-[13px] text-muted sm:block">Seret kartu untuk memindahkan status atau urutan. Di HP: tahan kartu sebentar lalu seret.</p>
        </>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search />}
            title="Tidak ada tugas yang cocok"
            action={
              <Button variant="outline" onClick={resetFilters}>
                Reset filter
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {filtered.map((t) => {
            const c = t.course_id ? courseMap.get(t.course_id) : undefined;
            const sc = subtaskCount.get(t.id);
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70">
                <input
                  type="checkbox"
                  className="mt-1 size-[18px] shrink-0 cursor-pointer accent-[#16A34A]"
                  checked={t.status === "done"}
                  aria-label={t.status === "done" ? `Tandai "${t.title}" belum selesai` : `Tandai "${t.title}" selesai`}
                  onChange={(e) => move(t, e.target.checked ? "done" : "todo", t.position)}
                />
                <button type="button" onClick={() => editTask(t)} className="min-w-0 flex-1 text-left">
                  <p className={cn("text-[14.5px] font-medium text-ink", t.status === "done" && "text-slate-500 line-through")}>{t.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                    {c && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", COURSE_COLORS[c.color].dot)} />
                        {c.name}
                      </span>
                    )}
                    <DueLabel task={t} />
                    {sc && (
                      <span className="tabular">
                        Checklist {sc.done}/{sc.total}
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                  <span className="text-xs text-muted">{STATUS_LABEL[t.status]}</span>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
