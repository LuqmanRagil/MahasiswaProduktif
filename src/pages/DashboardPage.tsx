import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlarmClock, CalendarPlus, CheckCircle2, ClipboardList, ListTodo, PiggyBank, Plus, Receipt, Sparkles, Target } from "lucide-react";
import { friendlyError } from "@/data";
import { useRows } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { useToday } from "@/hooks/useToday";
import { COURSE_COLORS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { gpa, longDate, rupiah, rupiahShort, shortDate, weekdayShort } from "@/lib/format";
import { addDays, daysBetween, startOfWeek, toDateStr } from "@/lib/time";
import { cn } from "@/lib/utils";
import { dailyExpenses } from "@/services/finance";
import { dueState, sortTasks } from "@/services/tasks";
import { itemsOnDate } from "@/services/calendar";
import { AgendaRow } from "@/features/calendar/AgendaItemView";
import { useAgenda, useOpenAgendaItem } from "@/features/calendar/useAgenda";
import { clearDemoData, useHasDemo } from "@/features/demo/demoData";
import { BudgetHero, CategoryUsageRow } from "@/features/finance/components";
import { useFinance } from "@/features/finance/useFinance";
import { useQuickActions } from "@/features/quick/QuickActions";
import { DueLabel, PRIORITY_TONE } from "@/features/tasks/TaskCard";
import { SimpleBarChart } from "@/components/charts/BarChartCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from "@/components/ui/states";

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }).format(now));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export function DashboardPage() {
  const today = useToday();
  const profile = useProfile();
  const { addTask, addExpense, addEvent, editTask } = useQuickActions();
  const tasks = useRows("tasks");
  const courses = useRows("courses");
  const finance = useFinance(0);
  const agenda = useAgenda(today, today);
  const openAgenda = useOpenAgendaItem(agenda.events, agenda.tasks);
  const hasDemo = useHasDemo();

  const courseMap = useMemo(() => new Map((courses.data ?? []).map((c) => [c.id, c])), [courses.data]);
  const week = useMemo(() => daysBetween(addDays(today, -6), today), [today]);

  const stats = useMemo(() => {
    const list = tasks.data ?? [];
    const open = list.filter((t) => t.status !== "done");
    const weekStart = startOfWeek(today);
    return {
      open: open.length,
      soon: open.filter((t) => dueState(t) === "segera").length,
      overdue: open.filter((t) => dueState(t) === "terlambat").length,
      doneThisWeek: list.filter((t) => t.completed_at && toDateStr(t.completed_at) >= weekStart).length,
      upcoming: sortTasks(open, "deadline").slice(0, 5),
      doneSeries: week.map((d) => ({
        label: weekdayShort(d),
        fullLabel: `${weekdayShort(d)}, ${shortDate(d)}`,
        value: list.filter((t) => t.completed_at && toDateStr(t.completed_at) === d).length,
      })),
    };
  }, [tasks.data, today, week]);

  const expenseSeries = useMemo(
    () => dailyExpenses(finance.allTxs, week).map((d) => ({ label: weekdayShort(d.date), fullLabel: `${weekdayShort(d.date)}, ${shortDate(d.date)}`, value: d.amount })),
    [finance.allTxs, week],
  );

  const todayItems = itemsOnDate(agenda.items, today);
  const name = profile.data?.full_name?.split(" ")[0] || "Mahasiswa";
  const usage = finance.usage.filter((u) => u.limit > 0).sort((a, b) => b.limit - a.limit);

  return (
    <div className="flex flex-col gap-5">
      {/* Sambutan + aksi cepat */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted lg:hidden">{longDate(today)}</p>
          <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-tight sm:text-3xl">Halo, {name}!</h1>
          <p className="mt-1 text-[15px] text-slate-600">
            {greeting()} — siap menjalani hari yang lebih produktif?
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <QuickAction icon={<Plus />} label="Tambah tugas" onClick={() => addTask()} />
          <QuickAction icon={<Receipt />} label="Catat pengeluaran" onClick={addExpense} primary />
          <QuickAction icon={<CalendarPlus />} label="Tambah jadwal" onClick={() => addEvent({ date: today })} />
        </div>
      </section>

      {hasDemo && <DemoBanner />}

      {/* Ringkasan akademik */}
      <section aria-label="Ringkasan akademik" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tasks.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-[var(--radius-card)] bg-slate-100" />)
        ) : (
          <>
            <StatCard label="Tugas belum selesai" value={stats.open} icon={<ListTodo />} hint={stats.overdue ? `${stats.overdue} sudah lewat deadline` : "Tidak ada yang terlambat"} tone={stats.overdue ? "danger" : "default"} />
            <StatCard label="Mendekati tenggat" value={stats.soon} icon={<AlarmClock />} hint="Deadline ≤ 48 jam lagi" tone={stats.soon ? "warning" : "default"} />
            <StatCard label="Selesai minggu ini" value={stats.doneThisWeek} icon={<CheckCircle2 />} hint="Sejak Senin" tone="success" />
            <StatCard label="Target IPK" value={profile.data ? gpa(profile.data.target_gpa) : "–"} icon={<Target />} hint={`Semester ${profile.data?.semester ?? "–"}`} />
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Agenda hari ini */}
        <Card>
          <CardHeader
            title="Agenda hari ini"
            description={`${weekdayShort(today)}, ${shortDate(today)} · urut berdasarkan jam`}
            action={
              <Link to="/kalender" className="text-[13px] font-medium text-primary hover:underline">
                Kalender
              </Link>
            }
          />
          <div className="px-3 pb-3">
            {agenda.isLoading ? (
              <div className="px-2">
                <SkeletonRows />
              </div>
            ) : agenda.error ? (
              <ErrorState message={friendlyError(agenda.error)} onRetry={agenda.refetch} />
            ) : todayItems.length ? (
              <ul>
                {todayItems.map((it) => (
                  <AgendaRow key={it.key} item={it} onClick={() => openAgenda(it)} now={Date.now()} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarPlus />}
                title="Tidak ada agenda hari ini"
                description="Jadwal kuliah dari Mata Kuliah dan deadline tugas otomatis muncul di sini."
                action={
                  <Button size="sm" variant="secondary" onClick={() => addEvent({ date: today })}>
                    Tambah agenda
                  </Button>
                }
                className="py-6"
              />
            )}
          </div>
        </Card>

        {/* Ringkasan keuangan */}
        <div className="flex flex-col gap-3">
          {finance.isLoading ? (
            <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-slate-100" />
          ) : finance.summary ? (
            <BudgetHero summary={finance.summary} isCurrent />
          ) : (
            <Card className="p-5">
              <PiggyBank className="size-7 text-primary" aria-hidden />
              <p className="mt-2 text-[15px] font-semibold">Atur anggaran bulan ini</p>
              <p className="mt-1 text-sm text-muted">Isi total uang bulanan supaya sisa jatah harian & mingguanmu bisa dihitung.</p>
              <Link to="/keuangan/anggaran" className="mt-3 inline-flex h-9 items-center rounded-[10px] bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary-dark">
                Atur anggaran
              </Link>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Uang bulanan" value={rupiahShort(finance.budget?.total_amount ?? profile.data?.monthly_allowance ?? 0)} hint={finance.budget ? "Total anggaran periode ini" : "Dari profil"} />
            <StatCard label="Pengeluaran periode ini" value={rupiahShort(finance.expense)} hint={`${shortDate(finance.period.start)} – ${shortDate(finance.period.end)}`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Tugas terdekat */}
        <Card>
          <CardHeader
            title="Tugas terdekat"
            description="Belum selesai, diurutkan dari deadline paling dekat"
            action={
              <Link to="/tugas" className="text-[13px] font-medium text-primary hover:underline">
                Semua tugas
              </Link>
            }
          />
          {tasks.isLoading ? (
            <div className="px-5 pb-5">
              <SkeletonRows rows={4} />
            </div>
          ) : tasks.error ? (
            <div className="px-5 pb-5">
              <ErrorState message={friendlyError(tasks.error)} onRetry={() => tasks.refetch()} />
            </div>
          ) : stats.upcoming.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {stats.upcoming.map((t) => {
                const c = t.course_id ? courseMap.get(t.course_id) : undefined;
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => editTask(t)} className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-slate-50/70">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", c ? COURSE_COLORS[c.color].dot : "bg-slate-300")} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                          <span>{c?.name ?? "Tanpa mata kuliah"}</span>
                          <DueLabel task={t} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                        <span className="text-[11px] text-muted">{STATUS_LABEL[t.status]}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<ClipboardList />}
              title="Semua tugas beres"
              description="Tidak ada tugas yang belum selesai."
              action={
                <Button size="sm" variant="secondary" onClick={() => addTask()}>
                  Tambah tugas
                </Button>
              }
              className="py-6"
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Anggaran per kategori"
            description="Terpakai dibanding batas, periode ini"
            action={
              <Link to="/keuangan" className="text-[13px] font-medium text-primary hover:underline">
                Keuangan
              </Link>
            }
          />
          <div className="px-5 pb-2">
            {finance.isLoading ? (
              <SkeletonRows />
            ) : usage.length ? (
              <ul className="divide-y divide-line">
                {usage.slice(0, 5).map((u) => (
                  <CategoryUsageRow key={u.category?.id ?? "none"} u={u} />
                ))}
              </ul>
            ) : (
              <p className="pb-4 text-sm text-muted">
                Belum ada batas per kategori.{" "}
                <Link to="/keuangan/anggaran" className="font-medium text-primary hover:underline">
                  Bagi anggaran
                </Link>
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Grafik produktivitas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Tugas selesai" description="7 hari terakhir" />
          <div className="px-3 pb-4">
            {tasks.isLoading ? <LoadingState /> : <SimpleBarChart data={stats.doneSeries} format={(n) => `${n} tugas`} formatAxis={(n) => String(n)} height={180} ariaLabel="Jumlah tugas selesai 7 hari terakhir" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Pengeluaran" description="7 hari terakhir" />
          <div className="px-3 pb-4">
            {finance.isLoading ? <LoadingState /> : <SimpleBarChart data={expenseSeries} format={rupiah} formatAxis={rupiahShort} height={180} ariaLabel="Pengeluaran 7 hari terakhir" />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-center text-[12.5px] font-medium transition-colors sm:h-10 sm:flex-row sm:py-0 sm:text-sm [&_svg]:size-[18px] sm:[&_svg]:size-4",
        primary ? "border-primary bg-primary text-white hover:bg-primary-dark" : "border-line bg-surface text-ink hover:bg-slate-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DemoBanner() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-blue-200 bg-primary-soft/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-slate-700">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        Kamu sedang melihat data contoh (berlabel “contoh”). Data ini bukan milikmu dan bisa dihapus kapan saja.
      </p>
      <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirm(true)}>
        Hapus data contoh
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Hapus semua data contoh?"
        description="Hanya data berlabel “contoh” yang dihapus. Data yang kamu buat atau ubah sendiri tetap aman."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await clearDemoData();
            await qc.invalidateQueries();
            toast.success("Data contoh dihapus");
            setConfirm(false);
          } catch (e) {
            toast.error(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
