import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { friendlyError, store } from "@/data";
import { invalidateTable } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { COURSE_COLORS } from "@/lib/constants";
import { DAY_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { courseSchema, type CourseForm } from "@/schemas";
import type { Course, CourseColor, CourseSchedule } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

export function CourseFormModal({ editing, schedules, onClose }: { editing: Course | null; schedules: CourseSchedule[]; onClose: () => void }) {
  const qc = useQueryClient();
  const profile = useProfile();
  const scale = profile.data?.grade_scale ?? [];
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState } = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      name: editing?.name ?? "",
      code: editing?.code ?? "",
      lecturer: editing?.lecturer ?? "",
      credits: editing?.credits ?? 3,
      semester: editing?.semester ?? profile.data?.semester ?? 1,
      target_grade: editing?.target_grade ?? "",
      room: editing?.room ?? "",
      color: editing?.color ?? "blue",
      schedules: schedules.map((s) => ({ id: s.id, day_of_week: s.day_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), room: s.room })),
    },
  });
  const sch = useFieldArray({ control, name: "schedules" });
  const color = watch("color");

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true);
    try {
      const { schedules: newSch, ...course } = v;
      let courseId: string;
      if (editing) {
        await store.update("courses", editing.id, { ...course, is_demo: false });
        courseId = editing.id;
        // Jadwal disimpan ulang seluruhnya (jumlahnya kecil, lebih sederhana & konsisten).
        if (schedules.length) await store.remove("course_schedules", [{ column: "course_id", op: "eq", value: courseId }]);
      } else {
        const [created] = await store.insert("courses", [course]);
        courseId = created.id;
      }
      if (newSch.length) {
        await store.insert(
          "course_schedules",
          newSch.map((s) => ({ course_id: courseId, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, room: s.room })),
        );
      }
      invalidateTable(qc, "courses");
      invalidateTable(qc, "course_schedules");
      toast.success(editing ? "Mata kuliah diperbarui" : "Mata kuliah ditambahkan");
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Ubah mata kuliah" : "Tambah mata kuliah"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="course-form" loading={saving}>
            {editing ? "Simpan perubahan" : "Tambah mata kuliah"}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Nama mata kuliah" htmlFor="c-name" error={formState.errors.name?.message}>
            <Input id="c-name" autoFocus={!editing} placeholder="mis. Basis Data" aria-invalid={!!formState.errors.name} {...register("name")} />
          </Field>
          <Field label="Kode" htmlFor="c-code" optional>
            <Input id="c-code" placeholder="INF210" {...register("code")} />
          </Field>
        </div>
        <Field label="Dosen" htmlFor="c-lect" optional>
          <Input id="c-lect" {...register("lecturer")} />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="SKS" htmlFor="c-sks" error={formState.errors.credits?.message}>
            <Input id="c-sks" type="number" inputMode="numeric" min={0} max={24} {...register("credits", { valueAsNumber: true })} />
          </Field>
          <Field label="Semester" htmlFor="c-sem">
            <Select id="c-sem" {...register("semester", { valueAsNumber: true })}>
              {Array.from({ length: 14 }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target nilai" htmlFor="c-target" optional>
            <Select id="c-target" {...register("target_grade")}>
              <option value="">–</option>
              {scale.map((g) => (
                <option key={g.letter} value={g.letter}>
                  {g.letter}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ruang kelas" htmlFor="c-room" optional>
            <Input id="c-room" {...register("room")} />
          </Field>
        </div>

        <Field label="Warna penanda">
          <div role="radiogroup" aria-label="Warna penanda" className="flex flex-wrap gap-2">
            {(Object.keys(COURSE_COLORS) as CourseColor[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={COURSE_COLORS[c].label}
                onClick={() => setValue("color", c)}
                className={cn("flex size-9 items-center justify-center rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
              >
                <span className={cn("size-6 rounded-full", COURSE_COLORS[c].dot)} />
              </button>
            ))}
          </div>
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-700">Jadwal kuliah mingguan</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => sch.append({ day_of_week: 1, start_time: "08:00", end_time: "09:40", room: "" })}
              disabled={sch.fields.length >= 7}
            >
              <Plus /> Tambah jadwal
            </Button>
          </div>
          {sch.fields.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[13px] text-muted">
              Belum ada jadwal. Jadwal yang ditambahkan akan muncul otomatis di Kalender.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sch.fields.map((f, i) => {
                const err = formState.errors.schedules?.[i];
                return (
                  <li key={f.id} className="rounded-xl border border-line p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                      <Select aria-label="Hari" {...register(`schedules.${i}.day_of_week`, { valueAsNumber: true })}>
                        {DAY_NAMES.map((d, idx) => (
                          <option key={d} value={idx + 1}>
                            {d}
                          </option>
                        ))}
                      </Select>
                      <Button size="icon" variant="ghost" className="sm:order-3" onClick={() => sch.remove(i)} aria-label="Hapus jadwal">
                        <X />
                      </Button>
                      <div className="col-span-2 grid grid-cols-3 gap-2 sm:order-2 sm:col-span-1">
                        <Input type="time" aria-label="Jam mulai" {...register(`schedules.${i}.start_time`)} />
                        <Input type="time" aria-label="Jam selesai" aria-invalid={!!err?.end_time} {...register(`schedules.${i}.end_time`)} />
                        <Input placeholder="Ruang" aria-label="Ruang" {...register(`schedules.${i}.room`)} />
                      </div>
                    </div>
                    {err?.end_time?.message && <p className="mt-1.5 text-[13px] text-red-600">{err.end_time.message}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </form>
    </Modal>
  );
}
