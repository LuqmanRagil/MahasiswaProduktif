-- =====================================================================
-- Mahasiswa Produktif — skema database v1
-- Jalankan sekali di Supabase: Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan pada project baru (kosong).
--
-- Prinsip:
--  * Semua tabel milik pengguna punya kolom user_id (default auth.uid()).
--  * Row Level Security (RLS) aktif di semua tabel: user hanya bisa
--    melihat/mengubah barisnya sendiri.
--  * Relasi antar tabel memakai foreign key gabungan (id, user_id) sehingga
--    data user A tidak bisa ditautkan ke data user B walaupun UUID-nya diketahui.
--  * Uang memakai numeric(14,2) (bukan float). Nilai akademik numeric.
--  * Waktu disimpan sebagai timestamptz (UTC); aplikasi menampilkan WIB.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fungsi bantu: updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- PROFILES — 1 baris per akun (id = auth.users.id)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 100),
  university        text not null default '' check (char_length(university) <= 150),
  study_program     text not null default '' check (char_length(study_program) <= 150),
  semester          smallint not null default 1 check (semester between 1 and 14),
  target_gpa        numeric(3,2) not null default 3.50 check (target_gpa between 0 and 4),
  monthly_allowance numeric(14,2) not null default 0 check (monthly_allowance >= 0),
  previous_gpa      numeric(3,2) not null default 0 check (previous_gpa between 0 and 4),
  previous_credits  smallint not null default 0 check (previous_credits between 0 and 400),
  budget_start_day  smallint not null default 1 check (budget_start_day between 1 and 28),
  -- Skala nilai bisa diubah per pengguna (tiap kampus berbeda).
  -- Format: [{ "letter": "A", "min": 85, "point": 4 }, ...]
  grade_scale       jsonb not null default '[
      {"letter":"A","min":85,"point":4},
      {"letter":"A-","min":80,"point":3.7},
      {"letter":"B+","min":75,"point":3.3},
      {"letter":"B","min":70,"point":3},
      {"letter":"B-","min":65,"point":2.7},
      {"letter":"C+","min":60,"point":2.3},
      {"letter":"C","min":55,"point":2},
      {"letter":"D","min":40,"point":1},
      {"letter":"E","min":0,"point":0}
    ]'::jsonb check (jsonb_typeof(grade_scale) = 'array' and jsonb_array_length(grade_scale) between 1 and 20),
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Profil dibuat otomatis saat akun baru terdaftar di Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- AKADEMIK
-- ---------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  code         text not null default '' check (char_length(code) <= 30),
  lecturer     text not null default '' check (char_length(lecturer) <= 120),
  credits      smallint not null default 2 check (credits between 0 and 24),
  semester     smallint not null default 1 check (semester between 1 and 14),
  target_grade text not null default '' check (char_length(target_grade) <= 5),
  room         text not null default '' check (char_length(room) <= 60),
  color        text not null default 'blue' check (color in ('blue','teal','violet','amber','rose','slate')),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);
create index courses_user_idx on public.courses (user_id, semester);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- Jadwal kuliah mingguan (1 = Senin … 7 = Minggu, jam WIB)
create table public.course_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id   uuid not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time  time not null,
  end_time    time not null,
  room        text not null default '' check (char_length(room) <= 60),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create index course_schedules_user_idx on public.course_schedules (user_id, day_of_week);
create index course_schedules_course_idx on public.course_schedules (course_id);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id    uuid,
  title        text not null check (char_length(title) between 1 and 200),
  description  text not null default '' check (char_length(description) <= 5000),
  status       text not null default 'todo' check (status in ('todo','doing','done')),
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  due_at       timestamptz,
  position     double precision not null default 0,
  completed_at timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  -- status "done" wajib punya waktu selesai, status lain tidak boleh.
  check ((status = 'done') = (completed_at is not null)),
  -- Kalau mata kuliah dihapus, tugas tetap ada (course_id jadi null).
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete set null (course_id)
);
create index tasks_user_status_idx on public.tasks (user_id, status, position);
create index tasks_user_due_idx on public.tasks (user_id, due_at);
create index tasks_course_idx on public.tasks (course_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_subtasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id    uuid not null,
  title      text not null check (char_length(title) between 1 and 200),
  is_done    boolean not null default false,
  position   integer not null default 0,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);
create index task_subtasks_task_idx on public.task_subtasks (task_id, position);
create index task_subtasks_user_idx on public.task_subtasks (user_id);

-- Komponen nilai per mata kuliah (Tugas 20%, UTS 30%, ...)
create table public.grade_components (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid not null,
  name       text not null check (char_length(name) between 1 and 60),
  weight     numeric(5,2) not null check (weight > 0 and weight <= 100),
  score      numeric(5,2) check (score between 0 and 100),
  position   integer not null default 0,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete cascade
);
create index grade_components_course_idx on public.grade_components (course_id, position);
create index grade_components_user_idx on public.grade_components (user_id);
create trigger grade_components_updated_at before update on public.grade_components
  for each row execute function public.set_updated_at();

-- Nilai mata kuliah per semester (untuk IPS/IPK). Bisa nilai resmi atau prediksi.
create table public.semester_grades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id    uuid,
  course_name  text not null check (char_length(course_name) between 1 and 120),
  credits      smallint not null check (credits between 1 and 24),
  semester     smallint not null check (semester between 1 and 14),
  grade_letter text not null check (char_length(grade_letter) between 1 and 5),
  grade_point  numeric(3,2) not null check (grade_point between 0 and 4),
  is_final     boolean not null default false,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete set null (course_id)
);
create index semester_grades_user_idx on public.semester_grades (user_id, semester);
create index semester_grades_course_idx on public.semester_grades (course_id);
create trigger semester_grades_updated_at before update on public.semester_grades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- KEUANGAN
-- ---------------------------------------------------------------------
-- Kategori pengeluaran milik pengguna (Uang kos, Makan, ...)
create table public.budget_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  icon       text not null default 'wallet' check (char_length(icon) <= 30),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);
create index budget_categories_user_idx on public.budget_categories (user_id, position);

-- Satu anggaran per periode (bulanan, mulai dari budget_start_day di profil)
create table public.budgets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_start          date not null,
  period_end            date not null,
  total_amount          numeric(14,2) not null check (total_amount >= 0),
  mode                  text not null default 'nominal' check (mode in ('percent','nominal')),
  allow_over_allocation boolean not null default false,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (period_end >= period_start),
  unique (id, user_id),
  unique (user_id, period_start)
);
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create table public.budget_allocations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_id   uuid not null,
  category_id uuid not null,
  amount      numeric(14,2) not null default 0 check (amount >= 0),
  percent     numeric(5,2) check (percent between 0 and 100),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (budget_id, category_id),
  foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade,
  foreign key (category_id, user_id) references public.budget_categories (id, user_id) on delete cascade
);
create index budget_allocations_user_idx on public.budget_allocations (user_id);
create index budget_allocations_category_idx on public.budget_allocations (category_id);

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type          text not null check (type in ('income','expense')),
  amount        numeric(14,2) not null check (amount > 0 and amount <= 1000000000),
  category_id   uuid,
  income_source text check (income_source in ('uang_bulanan','beasiswa','freelance','bisnis','hadiah','lainnya')),
  occurred_on   date not null,
  note          text not null default '' check (char_length(note) <= 200),
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Pengeluaran tidak punya sumber pemasukan; pemasukan wajib punya sumber dan tanpa kategori.
  check (
    (type = 'expense' and income_source is null)
    or (type = 'income' and income_source is not null and category_id is null)
  ),
  -- Kalau kategori dihapus, transaksi tetap ada (tercatat "Tanpa kategori").
  foreign key (category_id, user_id) references public.budget_categories (id, user_id) on delete set null (category_id)
);
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_category_idx on public.transactions (category_id);
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- KALENDER
-- ---------------------------------------------------------------------
create table public.calendar_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type             text not null check (type in ('kuliah','ujian','rapat','kepanitiaan','pribadi','belajar')),
  title            text not null check (char_length(title) between 1 and 150),
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  location         text not null default '' check (char_length(location) <= 120),
  description      text not null default '' check (char_length(description) <= 2000),
  course_id        uuid,
  task_id          uuid,
  -- Disimpan untuk fitur pengingat berikutnya. Belum ada pengiriman notifikasi otomatis.
  reminder_minutes integer check (reminder_minutes between 0 and 10080),
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (course_id, user_id) references public.courses (id, user_id) on delete set null (course_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);
create index calendar_events_user_start_idx on public.calendar_events (user_id, start_at);
create index calendar_events_course_idx on public.calendar_events (course_id);
create index calendar_events_task_idx on public.calendar_events (task_id);
create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profil: lihat milik sendiri" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profil: ubah milik sendiri" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Insert profil hanya lewat trigger handle_new_user (security definer).

do $$
declare
  t text;
begin
  foreach t in array array[
    'courses','course_schedules','tasks','task_subtasks','grade_components',
    'semester_grades','budget_categories','budgets','budget_allocations',
    'transactions','calendar_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: lihat milik sendiri" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: tambah milik sendiri" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: ubah milik sendiri" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: hapus milik sendiri" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: simpan anggaran + alokasi dalam satu transaksi
-- Validasi di server: total alokasi tidak boleh melebihi total anggaran
-- kecuali allow_over_allocation = true.
-- security invoker → RLS tetap berlaku.
-- ---------------------------------------------------------------------
create or replace function public.save_budget(
  p_period_start date,
  p_period_end date,
  p_total_amount numeric,
  p_mode text,
  p_allow_over boolean,
  p_allocations jsonb  -- [{ "category_id": uuid, "amount": number, "percent": number|null }]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_budget_id uuid;
  v_sum numeric;
begin
  if v_uid is null then
    raise exception 'Harus masuk terlebih dahulu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'Format alokasi tidak valid' using errcode = '22023';
  end if;

  select coalesce(sum((a ->> 'amount')::numeric), 0) into v_sum
  from jsonb_array_elements(p_allocations) a;

  if not p_allow_over and v_sum > p_total_amount then
    raise exception 'Total alokasi melebihi total anggaran' using errcode = '23514';
  end if;

  insert into public.budgets (user_id, period_start, period_end, total_amount, mode, allow_over_allocation)
  values (v_uid, p_period_start, p_period_end, p_total_amount, p_mode, p_allow_over)
  on conflict (user_id, period_start) do update
    set period_end = excluded.period_end,
        total_amount = excluded.total_amount,
        mode = excluded.mode,
        allow_over_allocation = excluded.allow_over_allocation,
        is_demo = false
  returning id into v_budget_id;

  delete from public.budget_allocations where budget_id = v_budget_id and user_id = v_uid;

  insert into public.budget_allocations (user_id, budget_id, category_id, amount, percent)
  select v_uid, v_budget_id, (a ->> 'category_id')::uuid, (a ->> 'amount')::numeric,
         nullif(a ->> 'percent', '')::numeric
  from jsonb_array_elements(p_allocations) a
  where (a ->> 'amount')::numeric > 0 or nullif(a ->> 'percent', '')::numeric > 0;

  return v_budget_id;
end;
$$;

revoke all on function public.save_budget(date, date, numeric, text, boolean, jsonb) from public, anon;
grant execute on function public.save_budget(date, date, numeric, text, boolean, jsonb) to authenticated;
