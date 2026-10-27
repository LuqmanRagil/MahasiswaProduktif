import { describe, expect, it } from "vitest";
import { fromWib, toDateStr, toTimeStr } from "@/lib/time";
import type { CalendarEvent, Course, CourseSchedule, Task } from "@/types/db";
import { buildAgenda, findConflicts, itemsOnDate } from "../calendar";
import { dueState, positionBetween, sortTasks, statusPatch } from "../tasks";

const course = { id: "c1", name: "Kalkulus", code: "MAT101", room: "R.201" } as Course;
const schedule = { id: "s1", course_id: "c1", day_of_week: 2, start_time: "08:00:00", end_time: "09:40:00", room: "" } as CourseSchedule; // Selasa

describe("zona waktu WIB", () => {
  it("konversi WIB ↔ UTC", () => {
    const iso = fromWib("2026-10-27", "08:00");
    expect(iso).toBe("2026-10-27T01:00:00.000Z");
    expect(toDateStr(iso)).toBe("2026-10-27");
    expect(toTimeStr(iso)).toBe("08:00");
    // 23.30 WIB masih tanggal yang sama walaupun di UTC sudah 16.30
    expect(toDateStr(fromWib("2026-10-27", "23:30"))).toBe("2026-10-27");
  });
});

describe("kalender", () => {
  const event = {
    id: "e1",
    type: "rapat",
    title: "Rapat BEM",
    start_at: fromWib("2026-10-27", "09:00"),
    end_at: fromWib("2026-10-27", "10:00"),
    location: "",
  } as CalendarEvent;
  const task = { id: "t1", title: "Laporan", status: "todo", due_at: fromWib("2026-10-27", "23:59"), course_id: "c1" } as Task;

  const agenda = buildAgenda({ events: [event], schedules: [schedule], courses: [course], tasks: [task] }, "2026-10-26", "2026-11-01");

  it("jadwal kuliah mingguan muncul di hari yang benar", () => {
    const classes = agenda.filter((a) => a.kind === "class");
    expect(classes).toHaveLength(1);
    expect(toDateStr(classes[0].start)).toBe("2026-10-27");
    expect(classes[0].location).toBe("R.201");
  });

  it("deadline tugas muncul di kalender", () => {
    expect(itemsOnDate(agenda, "2026-10-27").map((i) => i.kind)).toEqual(["class", "event", "deadline"]);
  });

  it("mendeteksi jadwal bentrok", () => {
    const c = findConflicts(fromWib("2026-10-27", "09:30"), fromWib("2026-10-27", "11:00"), agenda);
    expect(c.map((i) => i.title).sort()).toEqual(["Kalkulus", "Rapat BEM"]);
    // bersebelahan (10.00–11.00) tidak dianggap bentrok dengan rapat 09.00–10.00
    const c2 = findConflicts(fromWib("2026-10-27", "10:00"), fromWib("2026-10-27", "11:00"), agenda);
    expect(c2).toHaveLength(0);
    // saat mengedit agenda itu sendiri, tidak bentrok dengan dirinya
    const c3 = findConflicts(event.start_at, event.end_at, agenda, "event:e1");
    expect(c3.map((i) => i.title)).toEqual(["Kalkulus"]);
  });

  it("tugas selesai tidak tampil sebagai deadline", () => {
    const a = buildAgenda({ events: [], schedules: [], courses: [], tasks: [{ ...task, status: "done" }] }, "2026-10-26", "2026-11-01");
    expect(a).toHaveLength(0);
  });
});

describe("tugas", () => {
  const now = new Date(fromWib("2026-10-27", "12:00"));
  it("status tenggat", () => {
    expect(dueState({ status: "todo", due_at: fromWib("2026-10-27", "08:00") }, now)).toBe("terlambat");
    expect(dueState({ status: "todo", due_at: fromWib("2026-10-28", "12:00") }, now)).toBe("segera");
    expect(dueState({ status: "todo", due_at: fromWib("2026-11-05", "12:00") }, now)).toBe("nanti");
    expect(dueState({ status: "done", due_at: fromWib("2026-10-20", "08:00") }, now)).toBe("nanti");
  });

  it("completed_at mengikuti status", () => {
    expect(statusPatch({ status: "todo", completed_at: null }, "done", now).completed_at).toBe(now.toISOString());
    expect(statusPatch({ status: "done", completed_at: "x" }, "doing", now).completed_at).toBeNull();
    expect(statusPatch({ status: "done", completed_at: "x" }, "done", now).completed_at).toBe("x");
  });

  it("urutan deadline terdekat, tanpa deadline paling akhir", () => {
    const list = sortTasks(
      [
        { due_at: null, priority: "high", created_at: "1", position: 0 },
        { due_at: "2026-11-01T00:00:00Z", priority: "low", created_at: "2", position: 0 },
        { due_at: "2026-10-28T00:00:00Z", priority: "low", created_at: "3", position: 0 },
      ] as Task[],
      "deadline",
    );
    expect(list.map((t) => t.created_at)).toEqual(["3", "2", "1"]);
  });

  it("posisi kartu di antara dua kartu", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(undefined, 1000)).toBe(0);
    expect(positionBetween(1000, undefined)).toBe(2000);
  });
});
