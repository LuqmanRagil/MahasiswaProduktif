import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Clock, LibraryBig, MapPin, Plus, User } from "lucide-react";
import { friendlyError } from "@/data";
import { useRows } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { COURSE_COLORS } from "@/lib/constants";
import { DAY_NAMES, clockFromTime } from "@/lib/format";
import { cn, groupBy, sum } from "@/lib/utils";
import { CourseFormModal } from "@/features/courses/CourseFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

export function CoursesPage() {
  const profile = useProfile();
  const courses = useRows("courses", { order: [{ column: "name" }] });
  const schedules = useRows("course_schedules", { order: [{ column: "day_of_week" }, { column: "start_time" }] });
  const tasks = useRows("tasks");
  const current = profile.data?.semester ?? 1;
  const [semester, setSemester] = useState<number | "all">(current);
  const [formOpen, setFormOpen] = useState(false);

  const semesters = useMemo(() => [...new Set([current, ...(courses.data ?? []).map((c) => c.semester)])].sort((a, b) => a - b), [courses.data, current]);
  const list = (courses.data ?? []).filter((c) => semester === "all" || c.semester === semester);
  const schedByCourse = useMemo(() => groupBy(schedules.data ?? [], (s) => s.course_id), [schedules.data]);
  const openTasks = useMemo(() => groupBy((tasks.data ?? []).filter((t) => t.status !== "done" && t.course_id), (t) => t.course_id!), [tasks.data]);
  const currentSks = sum((courses.data ?? []).filter((c) => c.semester === current), (c) => c.credits);

  return (
    <>
      <PageHeader
        title="Mata Kuliah"
        description={`Semester ${current} berjalan: ${currentSks} SKS`}
        actions={
          <>
            <Select value={String(semester)} onChange={(e) => setSemester(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Pilih semester" className="w-44">
              {semesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                  {s === current ? " (sekarang)" : ""}
                </option>
              ))}
              <option value="all">Semua semester</option>
            </Select>
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> Tambah mata kuliah
            </Button>
          </>
        }
      />

      {courses.isLoading ? (
        <LoadingState />
      ) : courses.error ? (
        <ErrorState message={friendlyError(courses.error)} onRetry={() => courses.refetch()} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LibraryBig />}
            title={semester === "all" ? "Belum ada mata kuliah" : `Belum ada mata kuliah di semester ${semester}`}
            description="Tambahkan mata kuliah beserta jadwalnya. Jadwal otomatis tampil di Kalender dan Dashboard."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> Tambah mata kuliah
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {list.length} mata kuliah · <span className="tabular font-medium text-ink">{sum(list, (c) => c.credits)} SKS</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => {
              const sch = schedByCourse[c.id] ?? [];
              const open = openTasks[c.id]?.length ?? 0;
              const color = COURSE_COLORS[c.color];
              return (
                <Link
                  key={c.id}
                  to={`/mata-kuliah/${c.id}`}
                  className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-blue-200"
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-1 h-9 w-1.5 shrink-0 rounded-full", color.dot)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink group-hover:text-primary-dark">{c.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {[c.code, `${c.credits} SKS`, c.target_grade && `Target ${c.target_grade}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {c.is_demo && <Badge tone="outline">contoh</Badge>}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-slate-600">
                    {c.lecturer && (
                      <span className="flex items-center gap-2">
                        <User className="size-3.5 text-slate-400" aria-hidden />
                        {c.lecturer}
                      </span>
                    )}
                    {sch.length > 0 ? (
                      sch.map((s) => (
                        <span key={s.id} className="tabular flex items-center gap-2">
                          <Clock className="size-3.5 text-slate-400" aria-hidden />
                          {DAY_NAMES[s.day_of_week - 1]}, {clockFromTime(s.start_time)}–{clockFromTime(s.end_time)}
                          {(s.room || c.room) && (
                            <span className="inline-flex items-center gap-1 text-muted">
                              <MapPin className="size-3" aria-hidden />
                              {s.room || c.room}
                            </span>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">Belum ada jadwal</span>
                    )}
                  </div>
                  <div className="mt-auto pt-3">
                    <span className={cn("text-[13px] font-medium", open ? "text-primary-dark" : "text-muted")}>
                      {open ? `${open} tugas belum selesai` : "Tidak ada tugas aktif"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {formOpen && <CourseFormModal editing={null} schedules={[]} onClose={() => setFormOpen(false)} />}
    </>
  );
}
