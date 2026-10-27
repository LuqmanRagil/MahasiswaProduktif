import { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Info, Plus, Trash2 } from "lucide-react";
import { friendlyError } from "@/data";
import { useInsert, useRemove, useRows, useUpdate } from "@/hooks/useData";
import { useUpdateProfile } from "@/hooks/useProfile";
import { cn, groupBy, sum } from "@/lib/utils";
import { cumulativeGpa, displayGpa, finalScore, ips, letterFor, requiredPointForTarget, sortScale } from "@/services/academic";
import type { Course, GradeScaleRow, Profile, SemesterGrade } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export function GpaSimulator({ profile, courses, scale }: { profile: Profile; courses: Course[]; scale: GradeScaleRow[] }) {
  const grades = useRows("semester_grades", { order: [{ column: "semester" }, { column: "course_name" }] });
  const components = useRows("grade_components");
  const insert = useInsert("semester_grades");
  const update = useUpdate("semester_grades");
  const remove = useRemove("semester_grades");
  const updateProfile = useUpdateProfile();

  const sem = profile.semester;
  const [prevGpa, setPrevGpa] = useState(String(profile.previous_gpa || ""));
  const [prevSks, setPrevSks] = useState(String(profile.previous_credits || ""));
  const [historyOpen, setHistoryOpen] = useState(false);

  const current = courses.filter((c) => c.semester === sem);
  const gradeByCourse = useMemo(() => new Map((grades.data ?? []).filter((g) => g.semester === sem && g.course_id).map((g) => [g.course_id!, g])), [grades.data, sem]);
  const compsByCourse = useMemo(() => groupBy(components.data ?? [], (c) => c.course_id), [components.data]);
  const history = (grades.data ?? []).filter((g) => g.semester < sem);

  // Nilai dari kalkulator nilai akhir (jika semua komponen sudah terisi)
  const calcLetter = (courseId: string) => {
    const comps = compsByCourse[courseId];
    if (!comps?.length) return null;
    const r = finalScore(comps.map((c) => ({ weight: c.weight, score: c.score })));
    return r.complete && r.score !== null ? letterFor(r.score, scale) : null;
  };

  const rows = current.map((c) => {
    const g = gradeByCourse.get(c.id);
    const fromCalc = calcLetter(c.id);
    const letter = g?.grade_letter ?? fromCalc?.letter ?? "";
    const point = g ? g.grade_point : (fromCalc?.point ?? null);
    return { course: c, grade: g, letter, point, auto: !g && !!fromCalc };
  });
  const filled = rows.filter((r) => r.point !== null && r.course.credits > 0).map((r) => ({ credits: r.course.credits, point: r.point! }));
  const filledCredits = sum(filled, (f) => f.credits);
  const totalCredits = sum(current, (c) => c.credits);

  const pg = Number(prevGpa.replace(",", "."));
  const ps = Number(prevSks);
  const prevValid = prevGpa.trim() === "" ? ps === 0 || prevSks.trim() === "" : pg >= 0 && pg <= 4 && Number.isInteger(ps) && ps >= 0 && ps <= 400;
  const pgv = prevGpa.trim() === "" ? 0 : pg;
  const psv = prevSks.trim() === "" ? 0 : ps;

  const ipsValue = ips(filled);
  const ipkValue = prevValid ? cumulativeGpa(pgv, psv, filled) : null;
  const target = profile.target_gpa;
  const need = prevValid ? requiredPointForTarget(target, pgv, psv, totalCredits) : null;
  const needLetter = need !== null && need > 0 && need <= 4 ? sortScale(scale).slice().reverse().find((s) => s.point >= need) : null;

  const setLetter = async (course: Course, existing: SemesterGrade | undefined, letter: string) => {
    try {
      if (!letter) {
        if (existing) await remove.mutateAsync(existing.id);
        return;
      }
      const point = scale.find((s) => s.letter === letter)?.point ?? 0;
      if (existing) await update.mutateAsync({ id: existing.id, patch: { grade_letter: letter, grade_point: point, credits: Math.max(1, course.credits), course_name: course.name, is_demo: false } });
      else await insert.mutateAsync([{ course_id: course.id, course_name: course.name, credits: Math.max(1, course.credits), semester: sem, grade_letter: letter, grade_point: point, is_final: false }]);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };

  const savePrev = (gpaStr: string, sksStr: string) => {
    const g = Number(gpaStr.replace(",", "."));
    const s = Number(sksStr);
    if (gpaStr.trim() !== "" && !(g >= 0 && g <= 4)) return;
    if (sksStr.trim() !== "" && !(Number.isInteger(s) && s >= 0 && s <= 400)) return;
    updateProfile.mutate(
      { previous_gpa: gpaStr.trim() === "" ? 0 : Math.round(g * 100) / 100, previous_credits: sksStr.trim() === "" ? 0 : s },
      { onError: (e) => toast.error(friendlyError(e)) },
    );
  };

  const fromHistory = () => {
    const finals = history.filter((h) => h.is_final);
    const v = cumulativeGpa(0, 0, finals.map((h) => ({ credits: h.credits, point: h.grade_point })));
    if (v === null) return toast.error("Belum ada riwayat nilai resmi");
    const g = (Math.round(v * 100) / 100).toFixed(2);
    const s = String(sum(finals, (h) => h.credits));
    setPrevGpa(g);
    setPrevSks(s);
    savePrev(g, s);
    toast.success(`IPK sebelumnya dihitung dari ${finals.length} mata kuliah`);
  };

  const progress = ipkValue !== null && target > 0 ? Math.min(100, (ipkValue / target) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Nilai sebelum semester ini" description={sem === 1 ? "Semester 1 — biarkan kosong." : `Akumulasi semester 1–${sem - 1}`} action={
            history.some((h) => h.is_final) ? (
              <Button size="sm" variant="ghost" onClick={fromHistory}>
                <History /> Hitung dari riwayat
              </Button>
            ) : null
          } />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5">
            <Field label="IPK sebelumnya" htmlFor="prev-gpa" error={prevGpa.trim() !== "" && !(pg >= 0 && pg <= 4) ? "IPK harus 0,00–4,00" : undefined}>
              <Input id="prev-gpa" inputMode="decimal" placeholder="mis. 3,42" value={prevGpa} onChange={(e) => setPrevGpa(e.target.value)} onBlur={() => savePrev(prevGpa, prevSks)} />
            </Field>
            <Field label="Total SKS ditempuh" htmlFor="prev-sks" error={prevSks.trim() !== "" && !(Number.isInteger(ps) && ps >= 0 && ps <= 400) ? "SKS harus bilangan bulat 0–400" : undefined}>
              <Input id="prev-sks" inputMode="numeric" placeholder="mis. 40" value={prevSks} onChange={(e) => setPrevSks(e.target.value)} onBlur={() => savePrev(prevGpa, prevSks)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title={`Prediksi nilai semester ${sem}`} description={`${current.length} mata kuliah · ${totalCredits} SKS. Pilih nilai yang kamu perkirakan.`} />
          {current.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Belum ada mata kuliah di semester {sem}. Tambahkan dari halaman Mata Kuliah.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {rows.map((r) => (
                <li key={r.course.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.course.name}</p>
                    <p className="text-xs text-muted">
                      {r.course.credits} SKS
                      {r.course.target_grade && ` · target ${r.course.target_grade}`}
                      {r.auto && " · dari kalkulator nilai"}
                    </p>
                  </div>
                  <Select className="w-28" value={r.letter} onChange={(e) => setLetter(r.course, r.grade, e.target.value)} aria-label={`Nilai ${r.course.name}`}>
                    <option value="">–</option>
                    {scale.map((s) => (
                      <option key={s.letter} value={s.letter}>
                        {s.letter} ({String(s.point).replace(".", ",")})
                      </option>
                    ))}
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Riwayat nilai semester lalu"
            description="Opsional — dipakai untuk menghitung IPK sebelumnya secara otomatis."
            action={
              <Button size="sm" variant="secondary" onClick={() => setHistoryOpen(true)} disabled={sem === 1}>
                <Plus /> Nilai
              </Button>
            }
          />
          {history.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">{sem === 1 ? "Belum ada semester sebelumnya." : "Belum ada riwayat nilai."}</p>
          ) : (
            <div className="border-t border-line">
              {Object.entries(groupBy(history, (h) => h.semester)).map(([s, list]) => (
                <div key={s} className="border-b border-line last:border-0">
                  <p className="tabular flex justify-between bg-slate-50/70 px-5 py-1.5 text-xs font-medium text-muted">
                    <span>Semester {s}</span>
                    <span>IPS {displayGpa(ips(list.map((l) => ({ credits: l.credits, point: l.grade_point }))))}</span>
                  </p>
                  <ul>
                    {list.map((h) => (
                      <li key={h.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{h.course_name}</span>
                        {h.is_demo && <Badge tone="outline">contoh</Badge>}
                        <span className="tabular w-14 text-right text-muted">{h.credits} SKS</span>
                        <span className="w-8 text-right font-semibold">{h.grade_letter}</span>
                        <Button size="icon-sm" variant="ghost" className="hover:text-red-600" onClick={() => remove.mutate(h.id, { onError: (e) => toast.error(friendlyError(e)) })} aria-label={`Hapus ${h.course_name}`}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[13px] font-medium text-muted">Prediksi IPS</p>
              <p className="tabular mt-1 text-3xl font-bold tracking-tight">{displayGpa(ipsValue)}</p>
              <p className="text-xs text-muted">{filledCredits ? `${filledCredits} dari ${totalCredits} SKS` : "Belum ada nilai"}</p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-muted">Prediksi IPK</p>
              <p className="tabular mt-1 text-3xl font-bold tracking-tight text-primary">{displayGpa(ipkValue)}</p>
              <p className="tabular text-xs text-muted">{psv + filledCredits} SKS total</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-[13px]">
              <span className="text-muted">Menuju target IPK</span>
              <span className="tabular font-semibold">{displayGpa(target)}</span>
            </div>
            <Progress value={progress} tone={ipkValue !== null && ipkValue >= target ? "green" : "blue"} label="Progres menuju target IPK" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-primary" aria-hidden /> Simulasi target
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {need === null || totalCredits === 0 ? (
              "Tambahkan mata kuliah semester ini untuk melihat simulasi."
            ) : need > 4 ? (
              <>
                Untuk IPK {displayGpa(target)}, rata-rata mutu semester ini harus <strong className="tabular">{displayGpa(need)}</strong> — di atas 4,00, jadi
                <span className="text-red-600"> belum mungkin tercapai semester ini</span>. Targetkan bertahap di semester berikutnya.
              </>
            ) : need <= 0 ? (
              <span className="text-green-700">IPK kamu tetap di atas target berapa pun nilai semester ini.</span>
            ) : (
              <>
                Agar IPK mencapai <strong>{displayGpa(target)}</strong>, rata-rata mutu {totalCredits} SKS semester ini minimal{" "}
                <strong className="tabular">{displayGpa(need)}</strong>
                {needLetter && <> (setara rata-rata {needLetter.letter} atau lebih)</>}.
              </>
            )}
          </p>
        </Card>
        <p className={cn("text-xs text-muted")}>
          IPS = Σ(SKS × mutu) ÷ Σ SKS. IPK baru = (IPK lama × SKS lama + Σ SKS × mutu semester ini) ÷ total SKS. Angka ditampilkan dibulatkan 2 desimal; kampus bisa
          memakai aturan pembulatan berbeda. Hasil ini simulasi, bukan nilai resmi.
        </p>
      </div>

      {historyOpen && <HistoryForm semester={sem} scale={scale} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

function HistoryForm({ semester, scale, onClose }: { semester: number; scale: GradeScaleRow[]; onClose: () => void }) {
  const insert = useInsert("semester_grades");
  const [name, setName] = useState("");
  const [sks, setSks] = useState("3");
  const [sem, setSem] = useState(String(Math.max(1, semester - 1)));
  const [letter, setLetter] = useState(scale[0]?.letter ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const n = Number(sks);
    if (!name.trim()) return setError("Nama mata kuliah wajib diisi");
    if (!(Number.isInteger(n) && n >= 1 && n <= 24)) return setError("SKS harus 1–24");
    try {
      await insert.mutateAsync([
        { course_name: name.trim(), credits: n, semester: Number(sem), grade_letter: letter, grade_point: scale.find((s) => s.letter === letter)?.point ?? 0, is_final: true },
      ]);
      toast.success("Nilai ditambahkan");
      setName("");
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Tambah nilai semester lalu"
      description="Bisa ditambahkan berulang. Tutup kalau sudah selesai."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Selesai
          </Button>
          <Button onClick={save} loading={insert.isPending}>
            Tambah
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama mata kuliah" htmlFor="h-name" error={error ?? undefined}>
          <Input id="h-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Semester" htmlFor="h-sem">
            <Select id="h-sem" value={sem} onChange={(e) => setSem(e.target.value)}>
              {Array.from({ length: Math.max(1, semester - 1) }, (_, i) => i + 1).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SKS" htmlFor="h-sks">
            <Input id="h-sks" inputMode="numeric" value={sks} onChange={(e) => setSks(e.target.value)} />
          </Field>
          <Field label="Nilai" htmlFor="h-grade">
            <Select id="h-grade" value={letter} onChange={(e) => setLetter(e.target.value)}>
              {scale.map((s) => (
                <option key={s.letter} value={s.letter}>
                  {s.letter}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
