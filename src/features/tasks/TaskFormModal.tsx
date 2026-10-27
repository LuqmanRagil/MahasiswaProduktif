import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { friendlyError, store } from "@/data";
import { invalidateTable, useRemove, useRows } from "@/hooks/useData";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/time";
import { cn } from "@/lib/utils";
import { taskSchema, type TaskForm } from "@/schemas";
import { positionBetween, statusPatch } from "@/services/tasks";
import type { Task, TaskSubtask } from "@/types/db";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import type { TaskDefaults } from "@/features/quick/QuickActions";

export function TaskFormModal({ editing, defaults, onClose }: { editing: Task | null; defaults?: TaskDefaults; onClose: () => void }) {
  const subtasks = useRows("task_subtasks", { filters: [{ column: "task_id", op: "eq", value: editing?.id ?? "" }], order: [{ column: "position" }] }, !!editing);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={editing ? "Ubah tugas" : "Tambah tugas"} size="lg">
      {editing && subtasks.isLoading ? (
        <LoadingState />
      ) : (
        <TaskFormBody editing={editing} defaults={defaults} existingSubtasks={subtasks.data ?? []} onClose={onClose} />
      )}
    </Modal>
  );
}

function TaskFormBody({
  editing,
  defaults,
  existingSubtasks,
  onClose,
}: {
  editing: Task | null;
  defaults?: TaskDefaults;
  existingSubtasks: TaskSubtask[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const courses = useRows("courses", { order: [{ column: "name" }] });
  const tasks = useRows("tasks");
  const remove = useRemove("tasks");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newSub, setNewSub] = useState("");

  const { register, control, handleSubmit, watch, setValue, formState } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: editing?.title ?? "",
      description: editing?.description ?? "",
      course_id: editing?.course_id ?? defaults?.course_id ?? "",
      priority: editing?.priority ?? "medium",
      status: editing?.status ?? defaults?.status ?? "todo",
      due_local: toDatetimeLocal(editing?.due_at),
      subtasks: existingSubtasks.map((s) => ({ id: s.id, title: s.title, is_done: s.is_done })),
    },
  });
  const subs = useFieldArray({ control, name: "subtasks" });
  const priority = watch("priority");
  const status = watch("status");

  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    subs.append({ title: t, is_done: false });
    setNewSub("");
  };

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true);
    try {
      const base = {
        title: v.title,
        description: v.description,
        course_id: v.course_id || null,
        priority: v.priority,
        due_at: fromDatetimeLocal(v.due_local),
        ...statusPatch(editing ?? { status: "todo", completed_at: null }, v.status),
      };
      const cleanSubs = v.subtasks.filter((s) => s.title.trim());
      if (editing) {
        const statusChanged = editing.status !== v.status;
        const column = (tasks.data ?? []).filter((t) => t.status === v.status && t.id !== editing.id);
        const position = statusChanged ? positionBetween(Math.max(0, ...column.map((t) => t.position)), undefined) : editing.position;
        await store.update("tasks", editing.id, { ...base, position, is_demo: false });
        // Sinkronkan subtugas: hapus yang dibuang, ubah yang ada, tambah yang baru.
        const keep = new Set(cleanSubs.map((s) => s.id).filter(Boolean));
        const removed = existingSubtasks.filter((s) => !keep.has(s.id)).map((s) => s.id);
        if (removed.length) await store.remove("task_subtasks", [{ column: "id", op: "in", value: removed }]);
        for (const [i, s] of cleanSubs.entries()) {
          const old = existingSubtasks.find((o) => o.id === s.id);
          if (old && (old.title !== s.title || old.is_done !== s.is_done || old.position !== i)) {
            await store.update("task_subtasks", old.id, { title: s.title, is_done: s.is_done, position: i });
          }
        }
        const fresh = cleanSubs.map((s, i) => ({ ...s, position: i })).filter((s) => !s.id);
        if (fresh.length) await store.insert("task_subtasks", fresh.map((s) => ({ task_id: editing.id, title: s.title, is_done: s.is_done, position: s.position })));
        toast.success("Tugas diperbarui");
      } else {
        const column = (tasks.data ?? []).filter((t) => t.status === v.status);
        const position = positionBetween(column.length ? Math.max(...column.map((t) => t.position)) : undefined, undefined);
        const [created] = await store.insert("tasks", [{ ...base, position }]);
        if (cleanSubs.length) {
          await store.insert("task_subtasks", cleanSubs.map((s, i) => ({ task_id: created.id, title: s.title, is_done: s.is_done, position: i })));
        }
        toast.success("Tugas ditambahkan");
      }
      invalidateTable(qc, "tasks");
      invalidateTable(qc, "task_subtasks");
      onClose();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Judul tugas" htmlFor="task-title" error={formState.errors.title?.message}>
        <Input id="task-title" autoFocus={!editing} placeholder="mis. Laporan praktikum modul 3" aria-invalid={!!formState.errors.title} {...register("title")} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Mata kuliah" htmlFor="task-course" optional>
          <Select id="task-course" {...register("course_id")}>
            <option value="">Tanpa mata kuliah</option>
            {courses.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" htmlFor="task-due" optional hint="Waktu WIB">
          <Input id="task-due" type="datetime-local" {...register("due_local")} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prioritas">
          <div role="radiogroup" aria-label="Prioritas" className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setValue("priority", p)}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-medium transition-colors",
                  priority === p
                    ? p === "low"
                      ? "border-green-600 bg-green-50 text-green-800"
                      : p === "medium"
                        ? "border-amber-500 bg-amber-50 text-amber-900"
                        : "border-red-500 bg-red-50 text-red-700"
                    : "border-line text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className={cn("size-2 rounded-full", p === "low" ? "bg-green-600" : p === "medium" ? "bg-amber-500" : "bg-red-500")} />
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Status">
          <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">
            {(["todo", "doing", "done"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setValue("status", s)}
                className={cn(
                  "h-10 rounded-[10px] border text-[13px] font-medium transition-colors",
                  status === s ? "border-primary bg-primary-soft text-primary-dark" : "border-line text-slate-600 hover:bg-slate-50",
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Deskripsi" htmlFor="task-desc" optional>
        <Textarea id="task-desc" rows={3} placeholder="Detail tugas, format pengumpulan, dll." {...register("description")} />
      </Field>

      <Field label="Checklist subtugas" optional>
        <ul className="flex flex-col gap-1.5">
          {subs.fields.map((f, i) => (
            <li key={f.id} className="flex items-center gap-2">
              <input type="checkbox" className="size-4 shrink-0 accent-[#2563EB]" aria-label="Selesai" {...register(`subtasks.${i}.is_done`)} />
              <Input className="h-9" aria-label={`Subtugas ${i + 1}`} {...register(`subtasks.${i}.title`)} />
              <Button size="icon-sm" variant="ghost" onClick={() => subs.remove(i)} aria-label="Hapus subtugas">
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            className="h-9"
            value={newSub}
            placeholder="Tambah langkah, mis. Cari referensi"
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <Button size="sm" variant="secondary" className="h-9" onClick={addSub} disabled={!newSub.trim()}>
            <Plus /> Tambah
          </Button>
        </div>
      </Field>

      <div className="mt-2 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        {editing && (
          <Button variant="danger-ghost" className="sm:mr-auto" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Hapus tugas
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" loading={saving}>
          {editing ? "Simpan perubahan" : "Tambah tugas"}
        </Button>
      </div>

      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Hapus tugas ini?"
          description={`"${editing.title}" beserta checklist-nya akan dihapus permanen.`}
          loading={remove.isPending}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(editing.id);
              toast.success("Tugas dihapus");
              setConfirmDelete(false);
              onClose();
            } catch (e) {
              toast.error(friendlyError(e));
            }
          }}
        />
      )}
    </form>
  );
}
