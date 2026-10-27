// Tipe baris database — cocok dengan supabase/migrations/0001_init.sql

export type UUID = string;
/** "YYYY-MM-DD" (tanggal kalender, tanpa jam) */
export type DateStr = string;
/** ISO timestamp UTC, mis. "2026-10-27T03:00:00.000Z" */
export type Timestamp = string;

export interface GradeScaleRow {
  letter: string;
  /** Nilai angka minimum (0–100) untuk huruf ini */
  min: number;
  /** Bobot mutu (0–4) */
  point: number;
}

export interface Profile {
  id: UUID;
  full_name: string;
  university: string;
  study_program: string;
  semester: number;
  target_gpa: number;
  monthly_allowance: number;
  previous_gpa: number;
  previous_credits: number;
  budget_start_day: number;
  grade_scale: GradeScaleRow[];
  onboarded_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface Owned {
  id: UUID;
  user_id: UUID;
  created_at: Timestamp;
}

export type CourseColor = "blue" | "teal" | "violet" | "amber" | "rose" | "slate";

export interface Course extends Owned {
  name: string;
  code: string;
  lecturer: string;
  credits: number;
  semester: number;
  target_grade: string;
  room: string;
  color: CourseColor;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface CourseSchedule extends Owned {
  course_id: UUID;
  /** 1 = Senin … 7 = Minggu */
  day_of_week: number;
  /** "HH:MM" atau "HH:MM:SS" (WIB) */
  start_time: string;
  end_time: string;
  room: string;
  is_demo: boolean;
}

export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task extends Owned {
  course_id: UUID | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: Timestamp | null;
  position: number;
  completed_at: Timestamp | null;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface TaskSubtask extends Owned {
  task_id: UUID;
  title: string;
  is_done: boolean;
  position: number;
  is_demo: boolean;
}

export interface GradeComponent extends Owned {
  course_id: UUID;
  name: string;
  weight: number;
  score: number | null;
  position: number;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface SemesterGrade extends Owned {
  course_id: UUID | null;
  course_name: string;
  credits: number;
  semester: number;
  grade_letter: string;
  grade_point: number;
  is_final: boolean;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface BudgetCategory extends Owned {
  name: string;
  icon: string;
  position: number;
}

export type BudgetMode = "percent" | "nominal";

export interface Budget extends Owned {
  period_start: DateStr;
  period_end: DateStr;
  total_amount: number;
  mode: BudgetMode;
  allow_over_allocation: boolean;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface BudgetAllocation extends Owned {
  budget_id: UUID;
  category_id: UUID;
  amount: number;
  percent: number | null;
  is_demo: boolean;
}

export type TransactionType = "income" | "expense";
export type IncomeSource = "uang_bulanan" | "beasiswa" | "freelance" | "bisnis" | "hadiah" | "lainnya";

export interface Transaction extends Owned {
  type: TransactionType;
  amount: number;
  category_id: UUID | null;
  income_source: IncomeSource | null;
  occurred_on: DateStr;
  note: string;
  is_demo: boolean;
  updated_at: Timestamp;
}

export type EventType = "kuliah" | "ujian" | "rapat" | "kepanitiaan" | "pribadi" | "belajar";

export interface CalendarEvent extends Owned {
  type: EventType;
  title: string;
  start_at: Timestamp;
  end_at: Timestamp;
  location: string;
  description: string;
  course_id: UUID | null;
  task_id: UUID | null;
  reminder_minutes: number | null;
  is_demo: boolean;
  updated_at: Timestamp;
}

export interface TableMap {
  courses: Course;
  course_schedules: CourseSchedule;
  tasks: Task;
  task_subtasks: TaskSubtask;
  grade_components: GradeComponent;
  semester_grades: SemesterGrade;
  budget_categories: BudgetCategory;
  budgets: Budget;
  budget_allocations: BudgetAllocation;
  transactions: Transaction;
  calendar_events: CalendarEvent;
}

export type TableName = keyof TableMap;

/** Kolom yang diisi otomatis oleh database */
export type Insertable<T> = Partial<Omit<T, "id" | "user_id" | "created_at" | "updated_at">> & { id?: UUID };
export type Patch<T> = Partial<Omit<T, "id" | "user_id" | "created_at" | "updated_at">>;
