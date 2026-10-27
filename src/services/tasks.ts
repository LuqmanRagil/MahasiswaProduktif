import { PRIORITY_RANK } from "@/lib/constants";
import type { Task, TaskStatus } from "@/types/db";

export type DueState = "terlambat" | "segera" | "nanti" | "tanpa";

/** Status tenggat: lewat (terlambat), ≤ 48 jam lagi (segera), atau masih lama. */
export function dueState(task: Pick<Task, "due_at" | "status">, now: Date = new Date()): DueState {
  if (!task.due_at) return "tanpa";
  if (task.status === "done") return "nanti";
  const diff = new Date(task.due_at).getTime() - now.getTime();
  if (diff < 0) return "terlambat";
  if (diff <= 48 * 3600 * 1000) return "segera";
  return "nanti";
}

export type TaskSort = "deadline" | "priority" | "created";

export function sortTasks<T extends Pick<Task, "due_at" | "priority" | "created_at" | "position">>(tasks: T[], by: TaskSort): T[] {
  const byDeadline = (a: T, b: T) => {
    if (a.due_at === b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at < b.due_at ? -1 : 1;
  };
  return [...tasks].sort((a, b) => {
    if (by === "deadline") return byDeadline(a, b) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (by === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDeadline(a, b);
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
  });
}

/** Patch saat status berubah — completed_at selalu konsisten dengan status. */
export function statusPatch(task: Pick<Task, "status" | "completed_at">, status: TaskStatus, now: Date = new Date()) {
  return {
    status,
    completed_at: status === "done" ? (task.status === "done" && task.completed_at ? task.completed_at : now.toISOString()) : null,
  };
}

/** Posisi pecahan di antara dua kartu (untuk urutan Kanban). */
export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next! - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}
