import { z } from "zod";

const req = (label: string) => ({ error: `${label} wajib diisi` });
const num = (label: string) => z.number({ error: `${label} harus berupa angka` });

// ------------------------------------------------------------------ Auth
export const loginSchema = z.object({
  email: z.email({ error: "Format email tidak valid" }),
  password: z.string().min(1, req("Kata sandi")),
});

const password = z
  .string()
  .min(8, { error: "Kata sandi minimal 8 karakter" })
  .max(72, { error: "Kata sandi maksimal 72 karakter" })
  .regex(/[A-Za-z]/, { error: "Kata sandi harus mengandung huruf" })
  .regex(/\d/, { error: "Kata sandi harus mengandung angka" });

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, { error: "Nama minimal 2 karakter" }).max(100),
    email: z.email({ error: "Format email tidak valid" }),
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Konfirmasi kata sandi tidak sama" });

export const forgotSchema = z.object({ email: z.email({ error: "Format email tidak valid" }) });

export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Konfirmasi kata sandi tidak sama" });

// ------------------------------------------------------------------ Profil
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, { error: "Nama minimal 2 karakter" }).max(100),
  university: z.string().trim().max(150),
  study_program: z.string().trim().max(150),
  semester: num("Semester").int().min(1, { error: "Semester 1–14" }).max(14, { error: "Semester 1–14" }),
  target_gpa: num("Target IPK").min(0, { error: "Target IPK 0–4" }).max(4, { error: "Target IPK 0–4" }),
  monthly_allowance: num("Uang bulanan").min(0).max(1_000_000_000),
});
export type ProfileForm = z.infer<typeof profileSchema>;

// ------------------------------------------------------------------ Mata kuliah
export const courseSchema = z.object({
  name: z.string().trim().min(1, req("Nama mata kuliah")).max(120),
  code: z.string().trim().max(30),
  lecturer: z.string().trim().max(120),
  credits: num("SKS").int().min(0, { error: "SKS 0–24" }).max(24, { error: "SKS 0–24" }),
  semester: num("Semester").int().min(1).max(14),
  target_grade: z.string().max(5),
  room: z.string().trim().max(60),
  color: z.enum(["blue", "teal", "violet", "amber", "rose", "slate"]),
  schedules: z
    .array(
      z
        .object({
          id: z.string().optional(),
          day_of_week: num("Hari").int().min(1).max(7),
          start_time: z.string().regex(/^\d{2}:\d{2}/, req("Jam mulai")),
          end_time: z.string().regex(/^\d{2}:\d{2}/, req("Jam selesai")),
          room: z.string().trim().max(60),
        })
        .refine((s) => s.end_time.slice(0, 5) > s.start_time.slice(0, 5), { path: ["end_time"], error: "Jam selesai harus setelah jam mulai" }),
    )
    .max(7),
});
export type CourseForm = z.infer<typeof courseSchema>;

// ------------------------------------------------------------------ Tugas
export const taskSchema = z.object({
  title: z.string().trim().min(1, req("Judul tugas")).max(200),
  description: z.string().max(5000),
  course_id: z.string(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "doing", "done"]),
  due_local: z.string(), // datetime-local, boleh kosong
  subtasks: z.array(z.object({ id: z.string().optional(), title: z.string().trim().max(200), is_done: z.boolean() })),
});
export type TaskForm = z.infer<typeof taskSchema>;

// ------------------------------------------------------------------ Transaksi
export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amount: num("Nominal").int({ error: "Nominal harus bilangan bulat" }).min(1, { error: "Nominal harus lebih dari 0" }).max(1_000_000_000, { error: "Nominal terlalu besar" }),
    category_id: z.string(),
    income_source: z.string(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, req("Tanggal")),
    note: z.string().trim().max(200, { error: "Catatan maksimal 200 karakter" }),
  })
  .refine((v) => v.type === "income" || v.category_id !== "", { path: ["category_id"], error: "Pilih kategori" })
  .refine((v) => v.type === "expense" || v.income_source !== "", { path: ["income_source"], error: "Pilih sumber pemasukan" });
export type TransactionForm = z.infer<typeof transactionSchema>;

// ------------------------------------------------------------------ Kalender
export const eventSchema = z
  .object({
    type: z.enum(["kuliah", "ujian", "rapat", "kepanitiaan", "pribadi", "belajar"]),
    title: z.string().trim().min(1, req("Judul agenda")).max(150),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, req("Tanggal")),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, req("Jam mulai")),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, req("Jam selesai")),
    location: z.string().trim().max(120),
    description: z.string().max(2000),
    course_id: z.string(),
    task_id: z.string(),
    reminder: z.string(),
  })
  .refine((v) => v.end_time > v.start_time, { path: ["end_time"], error: "Jam selesai harus setelah jam mulai" });
export type EventForm = z.infer<typeof eventSchema>;
