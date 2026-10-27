import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CalendarEvent, Task, Transaction } from "@/types/db";
import { TransactionFormModal } from "@/features/finance/TransactionFormModal";
import { TaskFormModal } from "@/features/tasks/TaskFormModal";
import { EventFormModal } from "@/features/calendar/EventFormModal";

export interface TaskDefaults {
  course_id?: string;
  status?: Task["status"];
}
export interface EventDefaults {
  date?: string;
  start_time?: string;
  course_id?: string;
  task_id?: string;
  type?: CalendarEvent["type"];
}

interface QuickActions {
  addExpense: () => void;
  addIncome: () => void;
  editTransaction: (t: Transaction) => void;
  addTask: (d?: TaskDefaults) => void;
  editTask: (t: Task) => void;
  addEvent: (d?: EventDefaults) => void;
  editEvent: (e: CalendarEvent) => void;
}

const Ctx = createContext<QuickActions | null>(null);

type TxState = { open: boolean; type: "income" | "expense"; editing: Transaction | null };
type TaskState = { open: boolean; editing: Task | null; defaults?: TaskDefaults };
type EventState = { open: boolean; editing: CalendarEvent | null; defaults?: EventDefaults };

/**
 * Formulir yang bisa dibuka dari mana saja (dashboard, FAB, halaman fitur)
 * tanpa pindah halaman.
 */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [tx, setTx] = useState<TxState>({ open: false, type: "expense", editing: null });
  const [task, setTask] = useState<TaskState>({ open: false, editing: null });
  const [event, setEvent] = useState<EventState>({ open: false, editing: null });

  const addExpense = useCallback(() => setTx({ open: true, type: "expense", editing: null }), []);
  const addIncome = useCallback(() => setTx({ open: true, type: "income", editing: null }), []);
  const editTransaction = useCallback((t: Transaction) => setTx({ open: true, type: t.type, editing: t }), []);
  const addTask = useCallback((d?: TaskDefaults) => setTask({ open: true, editing: null, defaults: d }), []);
  const editTask = useCallback((t: Task) => setTask({ open: true, editing: t }), []);
  const addEvent = useCallback((d?: EventDefaults) => setEvent({ open: true, editing: null, defaults: d }), []);
  const editEvent = useCallback((e: CalendarEvent) => setEvent({ open: true, editing: e }), []);

  const value = useMemo(
    () => ({ addExpense, addIncome, editTransaction, addTask, editTask, addEvent, editEvent }),
    [addExpense, addIncome, editTransaction, addTask, editTask, addEvent, editEvent],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {tx.open && (
        <TransactionFormModal type={tx.type} editing={tx.editing} onClose={() => setTx((s) => ({ ...s, open: false }))} />
      )}
      {task.open && <TaskFormModal editing={task.editing} defaults={task.defaults} onClose={() => setTask((s) => ({ ...s, open: false }))} />}
      {event.open && (
        <EventFormModal editing={event.editing} defaults={event.defaults} onClose={() => setEvent((s) => ({ ...s, open: false }))} />
      )}
    </Ctx.Provider>
  );
}

export function useQuickActions(): QuickActions {
  const c = useContext(Ctx);
  if (!c) throw new Error("useQuickActions harus di dalam QuickActionsProvider");
  return c;
}
