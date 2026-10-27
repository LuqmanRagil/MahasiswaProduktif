import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, Plus, X } from "lucide-react";
import { friendlyError, store } from "@/data";
import { invalidateTable, useRows } from "@/hooks/useData";
import { cn, round2 } from "@/lib/utils";
import { finalScore, letterFor, minScoreForLetter, requiredScoreForTarget, sortScale } from "@/services/academic";
import type { Course, GradeComponent, GradeScaleRow } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/states";

interface Row {
  name: string;
  weight: string;
  score: string;
}

const TEMPLATE: Row[] = [
  { name: "Tugas", weight: "20", score: "" },
  { name: "Kuis", weight: "10", score: "" },
  { name: "UTS", weight: "30", score: "" },
  { name: "UAS", weight: "40", score: "" },
];

const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

export function FinalScoreCalculator({ courses, scale, courseId, onCourseChange }: { courses: Course[]; scale: GradeScaleRow[]; courseId: string; onCourseChange: (id: string) => void }) {
  const components = useRows("grade_components", { filters: [{ column: "course_id", op: "eq", value: courseId }], order: [{ column: "position" }] }, !!courseId);

  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Calculator />}
          title="Belum ada mata kuliah"
          description="Tambahkan mata kuliah dulu supaya komponen nilainya bisa disimpan."
          action={
            <Link to="/mata-kuliah" className="text-sm font-semibold text-primary hover:underline">
              Ke halaman Mata Kuliah
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-sm">
        <Select value={courseId} onChange={(e) => onCourseChange(e.target.value)} aria-label="Pilih mata kuliah">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (Smt {c.semester})
            </option>
          ))}
        </Select>
      </div>
      {components.isLoading ? (
        <LoadingState />
      ) : (
        <Editor key={courseId + (components.data?.map((c) => c.updated_at).join() ?? "")} course={courses.find((c) => c.id === courseId)!} saved={components.data ?? []} scale={scale} />
      )}
    </div>
  );
}

function Editor({ course, saved, scale }: { course: Course; saved: GradeComponent[]; scale: GradeScaleRow[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    saved.length ? saved.map((c) => ({ name: c.name, weight: String(c.weight), score: c.score === null ? "" : String(c.score) })) : TEMPLATE,
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(saved.length === 0);

  const parsed = rows.map((r) => ({
    name: r.name.trim(),
    weight: Number(r.weight.replace(",", ".")),
    score: r.score.trim() === "" ? null : Number(r.score.replace(",", ".")),
  }));
  const errors = parsed.map((p) => {
    if (!p.name) return "Nama komponen wajib diisi";
    if (!(p.weight > 0 && p.weight <= 100)) return "Bobot harus 1–100%";
    if (p.score !== null && !(p.score >= 0 && p.score <= 100)) return "Nilai harus 0–100";
    return null;
  });
  const valid = errors.every((e) => !e);
  const result = useMemo(() => (valid ? finalScore(parsed) : null), [JSON.stringify(parsed), valid]); // eslint-disable-line react-hooks/exhaustive-deps
  const letter = result?.score !== null && result?.score !== undefined ? letterFor(result.score, scale) : null;
  const targetMin = course.target_grade ? minScoreForLetter(course.target_grade, scale) : null;

  const update = (i: number, patch: Partial<Row>) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const save = async () => {
    if (!valid) return toast.error("Periksa kembali isian komponen nilai");
    if (!result?.weightValid) return toast.error("Total bobot harus 100%");
    setSaving(true);
    try {
      await store.remove("grade_components", [{ column: "course_id", op: "eq", value: course.id }]);
      await store.insert(
        "grade_components",
        parsed.map((p, i) => ({ course_id: course.id, name: p.name, weight: p.weight, score: p.score, position: i })),
      );
      invalidateTable(qc, "grade_components");
      setDirty(false);
      toast.success("Komponen nilai disimpan");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Komponen nilai" description="Isi bobot (%) dan nilai 0–100. Kosongkan nilai yang belum keluar." />
        <div className="px-5 pb-5">
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_96px_36px] gap-2 pb-1.5 text-xs font-medium text-muted sm:grid">
            <span>Komponen</span>
            <span>Bobot (%)</span>
            <span>Nilai</span>
            <span />
          </div>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i}>
                <div className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 sm:grid-cols-[minmax(0,1fr)_96px_96px_36px]">
                  <Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Nama komponen ${i + 1}`} maxLength={60} />
                  <Button size="icon" variant="ghost" className="sm:order-last" onClick={() => (setRows((x) => x.filter((_, idx) => idx !== i)), setDirty(true))} aria-label="Hapus komponen" disabled={rows.length <= 1}>
                    <X />
                  </Button>
                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-2 sm:contents">
                    <Input inputMode="decimal" value={r.weight} onChange={(e) => update(i, { weight: e.target.value })} aria-label={`Bobot ${r.name}`} placeholder="Bobot %" aria-invalid={!!errors[i]?.startsWith("Bobot")} />
                    <Input inputMode="decimal" value={r.score} onChange={(e) => update(i, { score: e.target.value })} aria-label={`Nilai ${r.name}`} placeholder="Belum ada" aria-invalid={!!errors[i]?.startsWith("Nilai")} />
                  </div>
                </div>
                {errors[i] && <p className="mt-1 text-[13px] text-red-600">{errors[i]}</p>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={() => (setRows((r) => [...r, { name: "", weight: "", score: "" }]), setDirty(true))} disabled={rows.length >= 10}>
              <Plus /> Komponen
            </Button>
            <p className={cn("tabular text-sm", result && !result.weightValid ? "font-medium text-red-600" : "text-muted")}>
              Total bobot: {result ? fmt(result.totalWeight) : "–"}%{result && !result.weightValid && " (harus 100%)"}
            </p>
          </div>
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            <Button onClick={save} loading={saving} disabled={!dirty}>
              {dirty ? "Simpan komponen" : "Tersimpan"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-muted">{result?.complete ? "Nilai akhir" : "Nilai terkumpul sejauh ini"}</p>
          <div className="mt-1 flex items-end gap-3">
            <p className="tabular text-4xl font-bold tracking-tight">{result ? fmt(result.complete ? result.score! : result.contribution) : "–"}</p>
            {letter && (
              <p className="pb-1 text-lg font-semibold text-primary">
                {letter.letter} <span className="tabular text-sm font-normal text-muted">(mutu {fmt(letter.point)})</span>
              </p>
            )}
          </div>
          {result && !result.complete && result.weightValid && (
            <p className="tabular mt-1 text-[13px] text-muted">
              Dari {fmt(result.filledWeight)}% bobot yang sudah ada nilainya. Sisa {fmt(result.totalWeight - result.filledWeight)}% belum dinilai.
            </p>
          )}
          {targetMin !== null && result?.weightValid && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-medium">Target: {course.target_grade} (minimal {fmt(targetMin)})</p>
              {result.complete ? (
                <p className={cn("mt-0.5", result.score! >= targetMin ? "text-green-700" : "text-red-600")}>
                  {result.score! >= targetMin ? "Target tercapai." : `Kurang ${fmt(round2(targetMin - result.score!))} poin dari target.`}
                </p>
              ) : (
                <TargetNeed need={requiredScoreForTarget(parsed, targetMin)} />
              )}
            </div>
          )}
        </Card>

        {result?.weightValid && !result.complete && (
          <Card>
            <CardHeader title="Simulasi nilai yang dibutuhkan" description="Rata-rata minimal di komponen yang belum dinilai" />
            <ul className="divide-y divide-line border-t border-line">
              {sortScale(scale)
                .filter((s) => s.min > 0)
                .map((s) => {
                  const need = requiredScoreForTarget(parsed, s.min);
                  return (
                    <li key={s.letter} className="flex items-center justify-between px-5 py-2 text-sm">
                      <span className="font-medium">{s.letter}</span>
                      <span className={cn("tabular", need === null ? "" : need > 100 ? "text-slate-400" : need <= 0 ? "text-green-700" : "text-ink")}>
                        {need === null ? "–" : need > 100 ? "Tidak mungkin" : need <= 0 ? "Sudah aman" : `≥ ${fmt(Math.ceil(need * 100) / 100)}`}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Card>
        )}
        <p className="text-xs text-muted">
          Konversi huruf memakai skala di{" "}
          <Link to="/pengaturan" className="font-medium text-primary hover:underline">
            Pengaturan
          </Link>
          . Hasil ini simulasi dan bisa berbeda dari perhitungan resmi kampus.
        </p>
      </div>
    </div>
  );
}

function TargetNeed({ need }: { need: number | null }) {
  if (need === null) return null;
  if (need <= 0) return <p className="mt-0.5 text-green-700">Target sudah aman walau sisa komponen bernilai 0.</p>;
  if (need > 100) return <p className="mt-0.5 text-red-600">Target tidak bisa dicapai lagi (butuh rata-rata di atas 100).</p>;
  return (
    <p className="tabular mt-0.5 text-slate-700">
      Butuh rata-rata minimal <strong>{fmt(Math.ceil(need * 100) / 100)}</strong> di komponen yang belum dinilai.
    </p>
  );
}
