import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Calculator, CalendarPlus, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { friendlyError } from "@/data";
import { useRemove, useRows } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { COURSE_COLORS, STATUS_LABEL, eventTypeLabel } from "@/lib/constants";
import { DAY_NAMES, clock, clockFromTime, shortDate } from "@/lib/format";
import { toDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { finalScore, letterFor } from "@/services/academic";
import { sortTasks } from "@/services/tasks";
import { CourseFormModal } from "@/features/courses/CourseFormModal";
import { useQuickActions } from "@/features/quick/QuickActions";
import { DueLabel, PRIORITY_TONE } from "@/features/tasks/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PRIORITY_LABEL } from "@/lib/constants";
import { ClipboardList } from "lucide-react";

export function CourseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { addTask, editTask, addEvent, editEvent } = useQuickActions();
  const profile = useProfile();
  const courses = useRows("courses");
  const schedules = useRows("course_schedules", { filters: [{ column: "course_id", op: "eq", value: id }], order: [{ column: "day_of_week" }, { column: "start_time" }] });
  const tasks = useRows("tasks", { filters: [{ column: "course_id", op: "eq", value: id }] });
  const components = useRows("grade_components", { filters: [{ column: "course_id", op: "eq", value: id }], order: [{ column: "position" }] });
  const events = useRows("calendar_events", { filters: [{ column: "course_id", op: "eq", value: id }], order: [{ column: "start_at" }] });
  const remove = useRemove("courses");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (courses.isLoading) return <LoadingState />;
  if (courses.error) return <ErrorState message={friendlyError(courses.error)} onRetry={() => courses.refetch()} />;
  const course = courses.data?.find((c) => c.id === id);
  if (!course) {
    return (
      <Card>
        <EmptyState icon={<ClipboardList />} title="Mata kuliah tidak ditemukan" description="Mungkin sudah dihapus." action={<Link to="/mata-kuliah" className="text-sm font-semibold text-primary">Kembali ke daftar</Link>} />
      </Card>
    );
  }

  const color = COURSE_COLORS[course.color];
  const fs = finalScore((components.data ?? []).map((c) => ({ weight: c.weight, score: c.score })));
  const scale = profile.data?.grade_scale ?? [];
  const predicted = fs.weightValid && fs.filledWeight > 0 ? letterFor(fs.complete ? fs.contribution : (fs.contribution * 100) / fs.filledWeight, scale) : null;
  const sortedTasks = sortTasks(tasks.data ?? [], "deadline").sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  const upcomingEvents = (events.data ?? []).filter((e) => new Date(e.end_at).getTime() >= Date.now());

  return (
    <>
      <Link to="/mata-kuliah" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Mata Kuliah
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={cn("mt-1 h-12 w-2 shrink-0 rounded-full", color.dot)} aria-hidden />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {[course.code, `${course.credits} SKS`, `Semester ${course.semester}`, course.lecturer].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Ubah
          </Button>
          <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Hapus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Tugas mata kuliah ini"
            description={`${(tasks.data ?? []).filter((t) => t.status !== "done").length} belum selesai`}
            action={
              <Button size="sm" variant="secondary" onClick={() => addTask({ course_id: course.id })}>
                <Plus /> Tugas
              </Button>
            }
          />
          {tasks.isLoading ? (
            <LoadingState />
          ) : sortedTasks.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title="Belum ada tugas" description="Tugas yang terhubung ke mata kuliah ini akan tampil di sini." />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {sortedTasks.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => editTask(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/70">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", t.status === "done" && "text-slate-500 line-through")}>{t.title}</p>
                      <DueLabel task={t} className="mt-0.5 text-[12.5px]" />
                    </div>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    <span className="hidden w-20 text-right text-xs text-muted sm:block">{STATUS_LABEL[t.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Jadwal" />
            <div className="px-5 pb-4">
              {schedules.data?.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {schedules.data.map((s) => (
                    <li key={s.id} className="tabular flex items-center gap-2">
                      <Clock className="size-4 text-slate-400" aria-hidden />
                      <span className="font-medium">{DAY_NAMES[s.day_of_week - 1]}</span>
                      {clockFromTime(s.start_time)}–{clockFromTime(s.end_time)}
                      {(s.room || course.room) && (
                        <span className="ml-auto inline-flex items-center gap-1 text-muted">
                          <MapPin className="size-3.5" aria-hidden />
                          {s.room || course.room}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Belum ada jadwal mingguan.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Nilai"
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate(`/ipk?matkul=${course.id}`)}>
                  <Calculator /> Kalkulator
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-3 px-5 pb-4">
              <div>
                <p className="text-xs text-muted">Target</p>
                <p className="text-xl font-bold">{course.target_grade || "–"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{fs.complete ? "Nilai akhir" : "Prediksi sementara"}</p>
                <p className="text-xl font-bold">
                  {predicted ? predicted.letter : "–"}
                  {fs.filledWeight > 0 && fs.weightValid && (
                    <span className="tabular ml-1.5 text-sm font-normal text-muted">
                      ({(fs.complete ? fs.contribution : (fs.contribution * 100) / fs.filledWeight).toLocaleString("id-ID", { maximumFractionDigits: 1 })})
                    </span>
                  )}
                </p>
              </div>
              {!fs.complete && fs.filledWeight > 0 && (
                <p className="col-span-2 text-xs text-muted">Dihitung dari komponen yang sudah ada nilainya ({fs.filledWeight}% dari bobot).</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Agenda terkait"
              action={
                <Button size="sm" variant="ghost" onClick={() => addEvent({ course_id: course.id, type: "ujian" })}>
                  <CalendarPlus /> Agenda
                </Button>
              }
            />
            <div className="px-5 pb-4">
              {upcomingEvents.length ? (
                <ul className="flex flex-col gap-2.5">
                  {upcomingEvents.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => editEvent(e)} className="text-left">
                        <p className="text-sm font-medium hover:text-primary">{e.title}</p>
                        <p className="tabular text-xs text-muted">
                          {eventTypeLabel(e.type)} · {shortDate(toDateStr(e.start_at))}, {clock(e.start_at)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Tidak ada agenda mendatang (ujian, belajar kelompok, dll).</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {editOpen && <CourseFormModal editing={course} schedules={schedules.data ?? []} onClose={() => setEditOpen(false)} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus ${course.name}?`}
        description="Jadwal dan komponen nilainya ikut terhapus. Tugas & agenda terkait tetap ada, tapi tidak lagi terhubung ke mata kuliah ini."
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(course.id);
            toast.success("Mata kuliah dihapus");
            navigate("/mata-kuliah", { replace: true });
          } catch (e) {
            toast.error(friendlyError(e));
          }
        }}
      />
    </>
  );
}
