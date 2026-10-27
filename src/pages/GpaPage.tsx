import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { friendlyError } from "@/data";
import { useRows } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { FinalScoreCalculator } from "@/features/gpa/FinalScoreCalculator";
import { GpaSimulator } from "@/features/gpa/GpaSimulator";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { ErrorState, LoadingState } from "@/components/ui/states";

type Tab = "nilai" | "ipk";

export function GpaPage() {
  const [params, setParams] = useSearchParams();
  const profile = useProfile();
  const courses = useRows("courses", { order: [{ column: "semester", ascending: false }, { column: "name" }] });
  const tab: Tab = params.get("tab") === "ipk" ? "ipk" : params.has("matkul") || params.get("tab") === "nilai" ? "nilai" : "ipk";

  const sorted = useMemo(() => {
    const sem = profile.data?.semester;
    const list = courses.data ?? [];
    return [...list.filter((c) => c.semester === sem), ...list.filter((c) => c.semester !== sem)];
  }, [courses.data, profile.data?.semester]);
  const courseId = params.get("matkul") && sorted.some((c) => c.id === params.get("matkul")) ? params.get("matkul")! : (sorted[0]?.id ?? "");

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Kalkulator IPK"
        description="Hitung nilai akhir mata kuliah, prediksi IPS & IPK, dan simulasikan target."
        actions={
          <Segmented
            label="Pilih kalkulator"
            value={tab}
            onChange={setTab}
            options={[
              { value: "ipk", label: "IPS & IPK" },
              { value: "nilai", label: "Nilai akhir matkul" },
            ]}
          />
        }
      />
      {profile.isLoading || courses.isLoading ? (
        <LoadingState />
      ) : courses.error || !profile.data ? (
        <ErrorState message={friendlyError(courses.error)} onRetry={() => courses.refetch()} />
      ) : tab === "nilai" ? (
        <FinalScoreCalculator
          courses={sorted}
          scale={profile.data.grade_scale}
          courseId={courseId}
          onCourseChange={(id) => {
            const next = new URLSearchParams(params);
            next.set("matkul", id);
            next.set("tab", "nilai");
            setParams(next, { replace: true });
          }}
        />
      ) : (
        <GpaSimulator profile={profile.data} courses={courses.data ?? []} scale={profile.data.grade_scale} />
      )}
    </>
  );
}
