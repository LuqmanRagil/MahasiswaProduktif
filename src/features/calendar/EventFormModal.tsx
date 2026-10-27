import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, BellOff, Trash2 } from "lucide-react";
import { friendlyError } from "@/data";
import { useInsert, useRemove, useRows, useUpdate } from "@/hooks/useData";
import { useToday } from "@/hooks/useToday";
import { EVENT_TYPES, REMINDER_OPTIONS, eventTypeLabel } from "@/lib/constants";
import { clock } from "@/lib/format";
import { addDays, fromWib, toDateStr, toTimeStr } from "@/lib/time";
import { eventSchema, type EventForm } from "@/schemas";
import { buildAgenda, findConflicts, type AgendaItem } from "@/services/calendar";
import type { CalendarEvent, EventType } from "@/types/db";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { EventDefaults } from "@/features/quick/QuickActions";

export function EventFormModal({ editing, defaults, onClose }: { editing: CalendarEvent | null; defaults?: EventDefaults; onClose: () => void }) {
  const today = useToday();
  const insert = useInsert("calendar_events");
  const update = useUpdate("calendar_events");
  const remove = useRemove("calendar_events");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [conflicts, setConflicts] = useState<AgendaItem[] | null>(null);

  const { register, handleSubmit, watch, formState } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: editing
      ? {
          type: editing.type,
          title: editing.title,
          date: toDateStr(editing.start_at),
          start_time: toTimeStr(editing.start_at),
          end_time: toTimeStr(editing.end_at),
          location: editing.location,
          description: editing.description,
          course_id: editing.course_id ?? "",
          task_id: editing.task_id ?? "",
          reminder: editing.reminder_minutes === null ? "" : String(editing.reminder_minutes),
        }
      : {
          type: defaults?.type ?? "rapat",
          title: "",
          date: defaults?.date ?? today,
          start_time: defaults?.start_time ?? "09:00",
          end_time: defaults?.start_time ? `${String(Math.min(23, Number(defaults.start_time.slice(0, 2)) + 1)).padStart(2, "0")}:${defaults.start_time.slice(3, 5)}` : "10:00",
          location: "",
          description: "",
          course_id: defaults?.course_id ?? "",
          task_id: defaults?.task_id ?? "",
          reminder: "",
        },
  });

  const date = watch("date");
  const start = watch("start_time");
  const end = watch("end_time");

  // Data pembanding untuk cek bentrok (hari yang dipilih ± 1 hari).
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const range = validDate ? { from: addDays(date, -1), to: addDays(date, 1) } : null;
  const events = useRows(
    "calendar_events",
    range ? { filters: [{ column: "start_at", op: "gte", value: fromWib(range.from) }, { column: "start_at", op: "lte", value: fromWib(range.to, "23:59") }] } : undefined,
    !!range,
  );
  const schedules = useRows("course_schedules");
  const courses = useRows("courses", { order: [{ column: "name" }] });
  const tasks = useRows("tasks");

  const agenda = useMemo(
    () =>
      range
        ? buildAgenda({ events: events.data ?? [], schedules: schedules.data ?? [], courses: courses.data ?? [], tasks: [] }, range.from, range.to)
        : [],
    [range?.from, range?.to, events.data, schedules.data, courses.data], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Waktu berubah → peringatan bentrok lama tidak berlaku lagi.
  useEffect(() => setConflicts(null), [date, start, end]);

  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done" || t.id === editing?.task_id);

  const onSubmit = handleSubmit(async (v) => {
    const start_at = fromWib(v.date, v.start_time);
    const end_at = fromWib(v.date, v.end_time);
    if (!conflicts) {
      const found = findConflicts(start_at, end_at, agenda, editing ? `event:${editing.id}` : undefined);
      if (found.length) {
        setConflicts(found);
        return; // tampilkan peringatan dulu, simpan pada klik berikutnya
      }
    }
    const row = {
      type: v.type as EventType,
      title: v.title,
      start_at,
      end_at,
      location: v.location,
      description: v.description,
      course_id: v.course_id || null,
      task_id: v.task_id || null,
      reminder_minutes: v.reminder === "" ? null : Number(v.reminder),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: { ...row, is_demo: false } });
        toast.success("Agenda diperbarui");
      } else {
        await insert.mutateAsync([row]);
        toast.success("Agenda ditambahkan");
      }
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    }
  });

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={editing ? "Ubah agenda" : "Tambah agenda"} size="lg">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Judul agenda" htmlFor="ev-title" error={formState.errors.title?.message}>
            <Input id="ev-title" autoFocus={!editing} placeholder="mis. Rapat divisi acara" aria-invalid={!!formState.errors.title} {...register("title")} />
          </Field>
          <Field label="Jenis" htmlFor="ev-type">
            <Select id="ev-type" {...register("type")}>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Tanggal" htmlFor="ev-date" error={formState.errors.date?.message} className="col-span-2 sm:col-span-1">
            <Input id="ev-date" type="date" {...register("date")} />
          </Field>
          <Field label="Mulai (WIB)" htmlFor="ev-start" error={formState.errors.start_time?.message}>
            <Input id="ev-start" type="time" {...register("start_time")} />
          </Field>
          <Field label="Selesai (WIB)" htmlFor="ev-end" error={formState.errors.end_time?.message}>
            <Input id="ev-end" type="time" aria-invalid={!!formState.errors.end_time} {...register("end_time")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lokasi" htmlFor="ev-loc" optional>
            <Input id="ev-loc" placeholder="mis. Sekretariat BEM" {...register("location")} />
          </Field>
          <Field
            label="Pengingat"
            htmlFor="ev-rem"
            optional
            hint={
              <span className="inline-flex items-center gap-1">
                <BellOff className="size-3.5" aria-hidden /> Disimpan, tapi notifikasi otomatis belum aktif di versi ini.
              </span>
            }
          >
            <Select id="ev-rem" {...register("reminder")}>
              {REMINDER_OPTIONS.map((r) => (
                <option key={r.label} value={r.value === null ? "" : String(r.value)}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Terkait mata kuliah" htmlFor="ev-course" optional>
            <Select id="ev-course" {...register("course_id")}>
              <option value="">Tidak ada</option>
              {courses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Terkait tugas" htmlFor="ev-task" optional>
            <Select id="ev-task" {...register("task_id")}>
              <option value="">Tidak ada</option>
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Deskripsi" htmlFor="ev-desc" optional>
          <Textarea id="ev-desc" rows={2} {...register("description")} />
        </Field>

        {conflicts && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="size-4" aria-hidden /> Jadwal ini bentrok dengan:
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-6 text-sm text-amber-900">
              {conflicts.map((c) => (
                <li key={c.key} className="list-disc">
                  {c.title} ({eventTypeLabel(c.type)}, {clock(c.start)}–{c.end ? clock(c.end) : ""})
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-amber-800">Ubah jamnya, atau klik "Tetap simpan" kalau memang disengaja.</p>
          </div>
        )}

        <div className="mt-2 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          {editing && (
            <Button variant="danger-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Hapus agenda
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={insert.isPending || update.isPending}>
            {conflicts ? "Tetap simpan" : editing ? "Simpan perubahan" : "Tambah agenda"}
          </Button>
        </div>
      </form>

      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Hapus agenda ini?"
          description={`"${editing.title}" akan dihapus dari kalender.`}
          loading={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(editing.id);
              toast.success("Agenda dihapus");
              setConfirmDelete(false);
              onClose();
            } catch (e) {
              toast.error(friendlyError(e));
            }
          }}
        />
      )}
    </Modal>
  );
}
