-- Uji keamanan (RLS) & constraint. Jalankan setelah supabase_shim.sql + migrasi.
-- Setiap blok gagal keras (raise exception) jika aturan dilanggar.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.id', '{"full_name":"Andi"}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.id', '{"full_name":"Budi"}');

-- 1) Trigger profil otomatis
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profil tidak dibuat otomatis';
  assert (select full_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-00000000000a') = 'Andi', 'nama profil salah';
end $$;

-- 2) User A membuat data
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-00000000000a';
insert into public.courses (id, name, credits) values ('c0000000-0000-0000-0000-00000000000a', 'Kalkulus', 3);
insert into public.tasks (id, title, course_id) values ('70000000-0000-0000-0000-00000000000a', 'Tugas A', 'c0000000-0000-0000-0000-00000000000a');
insert into public.budget_categories (id, name) values ('ca000000-0000-0000-0000-00000000000a', 'Makan');
insert into public.transactions (type, amount, category_id, occurred_on) values ('expense', 15000, 'ca000000-0000-0000-0000-00000000000a', '2026-10-27');
select public.save_budget('2026-10-01', '2026-10-31', 1500000, 'nominal', false,
  '[{"category_id":"ca000000-0000-0000-0000-00000000000a","amount":600000,"percent":null}]'::jsonb);
do $$ begin
  assert (select count(*) from public.tasks) = 1, 'A harus melihat tugasnya sendiri';
  assert (select user_id from public.tasks limit 1) = 'aaaaaaaa-0000-0000-0000-00000000000a', 'user_id default salah';
  assert (select count(*) from public.budget_allocations) = 1, 'alokasi tidak tersimpan';
end $$;
commit;

-- 3) User B tidak bisa melihat / mengubah / menghapus data A
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-00000000000b';
do $$
declare n int;
begin
  assert (select count(*) from public.tasks) = 0, 'B bisa melihat tugas A!';
  assert (select count(*) from public.courses) = 0, 'B bisa melihat matkul A!';
  assert (select count(*) from public.transactions) = 0, 'B bisa melihat transaksi A!';
  assert (select count(*) from public.profiles) = 1, 'B bisa melihat profil orang lain!';
  update public.tasks set title = 'diretas' where id = '70000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B bisa mengubah tugas A!';
  delete from public.courses where id = 'c0000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B bisa menghapus matkul A!';
  update public.profiles set full_name = 'x' where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'B bisa mengubah profil A!';
end $$;
commit;

-- 3b) B tidak bisa menyisipkan baris atas nama A
do $$ begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
    insert into public.tasks (user_id, title) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'palsu');
    raise exception 'GAGAL: B bisa insert atas nama A';
  exception when insufficient_privilege then null; -- 42501: ditolak RLS (benar)
  end;
end $$;
reset role;

-- 3c) B tidak bisa menautkan tugasnya ke matkul milik A (FK gabungan)
do $$ begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', true);
    insert into public.tasks (title, course_id) values ('nyelonong', 'c0000000-0000-0000-0000-00000000000a');
    raise exception 'GAGAL: B bisa menautkan ke matkul A';
  exception when foreign_key_violation then null;
  end;
end $$;
reset role;

-- 3d) Pengguna anonim tidak melihat apa pun
begin;
set local role anon;
do $$ begin
  assert (select count(*) from public.tasks) = 0, 'anon bisa melihat data!';
  assert (select count(*) from public.profiles) = 0, 'anon bisa melihat profil!';
end $$;
commit;

-- 4) Constraint data
do $$ begin
  begin
    insert into public.transactions (user_id, type, amount, occurred_on) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'expense', -5000, '2026-10-27');
    raise exception 'GAGAL: nominal negatif diterima';
  exception when check_violation then null; end;
  begin
    insert into public.transactions (user_id, type, amount, occurred_on) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'income', 5000, '2026-10-27');
    raise exception 'GAGAL: pemasukan tanpa sumber diterima';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (user_id, title, status) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'x', 'done');
    raise exception 'GAGAL: status done tanpa completed_at diterima';
  exception when check_violation then null; end;
  begin
    insert into public.calendar_events (user_id, type, title, start_at, end_at) values
      ('aaaaaaaa-0000-0000-0000-00000000000a', 'rapat', 'x', '2026-10-27 10:00+07', '2026-10-27 09:00+07');
    raise exception 'GAGAL: agenda selesai sebelum mulai diterima';
  exception when check_violation then null; end;
end $$;

-- 5) save_budget menolak alokasi melebihi total
do $$ begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-00000000000a', true);
    perform public.save_budget('2026-10-01', '2026-10-31', 100000, 'nominal', false,
      '[{"category_id":"ca000000-0000-0000-0000-00000000000a","amount":600000,"percent":null}]'::jsonb);
    raise exception 'GAGAL: alokasi berlebih diterima';
  exception when check_violation then null; end;
end $$;
reset role;
do $$ begin
  assert (select total_amount from public.budgets) = 1500000, 'anggaran berubah padahal ditolak';
end $$;

-- 6) Hapus matkul → tugas tetap ada, course_id jadi null
delete from public.courses where id = 'c0000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select course_id from public.tasks where id = '70000000-0000-0000-0000-00000000000a') is null, 'course_id tidak di-null-kan';
  assert (select user_id from public.tasks where id = '70000000-0000-0000-0000-00000000000a') = 'aaaaaaaa-0000-0000-0000-00000000000a', 'user_id ikut ter-null';
end $$;

-- 7) Hapus akun → semua data ikut terhapus
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.tasks) = 0, 'data tidak ikut terhapus';
  assert (select count(*) from public.budgets) = 0, 'anggaran tidak ikut terhapus';
end $$;

\echo 'SEMUA TES RLS & CONSTRAINT LULUS'
