# Mahasiswa Produktif — v1

Aplikasi web untuk mahasiswa: **tugas kuliah (Kanban), mata kuliah, keuangan (anggaran & catat pengeluaran), kalender terpadu, dan kalkulator IPK**.
Stack: React 19 + TypeScript + Vite + Tailwind CSS 4 + Supabase (Auth + PostgreSQL + Row Level Security).

---

## 1. Yang sudah ada di versi ini

| Fitur | Isi |
|---|---|
| Autentikasi | Daftar email, masuk, keluar, lupa & reset kata sandi, proteksi halaman, ganti kata sandi (Supabase Auth) |
| Onboarding | Nama, kampus, prodi, semester, target IPK, uang bulanan, tanggal terima uang + pilihan data contoh |
| Dashboard | Ringkasan tugas, agenda hari ini, sisa anggaran + jatah harian/mingguan, tugas terdekat, grafik 7 hari, aksi cepat |
| Tugas | Kanban To-Do/Dikerjakan/Selesai (drag-and-drop, juga di HP), tampilan daftar, filter, urutan, checklist subtugas |
| Mata kuliah | CRUD, jadwal mingguan, total SKS semester, halaman detail (tugas, nilai, agenda terkait) |
| Keuangan | Dashboard keuangan, anggaran per periode (nominal / persen), kategori, catat cepat (tombol mengambang), riwayat + filter, pemasukan |
| Kalender | Bulan / minggu / hari / daftar, jadwal kuliah & deadline tugas otomatis, cek jadwal bentrok |
| Kalkulator IPK | Nilai akhir per matkul (bobot komponen), simulasi nilai yang dibutuhkan, IPS, IPK kumulatif, simulasi target IPK |
| Pengaturan | Profil, skala nilai kampus (bisa diubah), hapus data contoh, ganti kata sandi |

**Belum termasuk v1 (sengaja):** Catatan Pintar, integrasi AI, Habit Tracker, Mode Fokus, Target Semester, landing page, login Google, foto profil, notifikasi pengingat (pilihan pengingat disimpan, tapi notifikasinya belum dikirim), dark mode.

---

## 2. Menjalankan di laptop

Butuh **Node.js 22.12+** (cek: `node -v`).

```bash
npm install
npm run dev          # buka http://localhost:5173
```

Tanpa file `.env.local`, aplikasi berjalan dalam **Mode Coba**: data disimpan di browser saja, tanpa login. Ini hanya untuk mencoba tampilan — bukan database cloud.

---

## 3. Menyambungkan ke Supabase (wajib untuk pemakaian sungguhan)

1. Buat akun & project baru di <https://supabase.com> (paket gratis cukup untuk mulai).
2. **Buat tabel:** buka **SQL Editor** → *New query* → salin seluruh isi `supabase/migrations/0001_init.sql` → **Run**.
3. **Ambil URL & key:** klik tombol **Connect** di dashboard project (atau **Settings → API Keys**).
   - `Project URL`
   - **Publishable key** (`sb_publishable_...`). Project lama boleh memakai *anon key*.
   - ⚠️ Jangan pernah memakai **secret key / service_role** di aplikasi ini.
4. Salin `.env.example` menjadi `.env.local`, lalu isi:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
   ```
5. **URL redirect (untuk konfirmasi email & reset kata sandi):** di dashboard buka **Authentication → URL Configuration**:
   - *Site URL*: alamat website produksi (mis. `https://mahasiswaproduktif.vercel.app`). Saat masih lokal: `http://localhost:5173`.
   - *Redirect URLs*: tambahkan `http://localhost:5173/**` dan alamat produksi, mis. `https://mahasiswaproduktif.vercel.app/**`.
6. Jalankan ulang `npm run dev`. Sekarang aplikasi wajib login.

Catatan:
- Konfirmasi email aktif secara bawaan di Supabase. Setelah daftar, pengguna harus klik link di email dulu.
- Link konfirmasi & reset kata sandi sebaiknya dibuka **di browser yang sama** tempat meminta link (alur PKCE).
- Pengiriman email bawaan Supabase dibatasi jumlahnya. Untuk banyak pengguna, sambungkan layanan SMTP sendiri lewat pengaturan email di menu Authentication.

---

## 4. Deploy (contoh: Vercel)

1. Upload project ke GitHub, lalu *Import Project* di Vercel.
2. Isi *Environment Variables* `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Build command `npm run build`, output `dist`. File `vercel.json` sudah mengatur agar semua alamat halaman membuka aplikasi (untuk Netlify: `public/_redirects`).
4. Tambahkan alamat Vercel ke *Redirect URLs* Supabase (langkah 3.5).

---

## 5. Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run test` | Unit test perhitungan IPK, keuangan, kalender, tugas |
| `npm run typecheck` | Cek TypeScript |
| `npm run build` | Build produksi ke `dist/` |
| `npm run build:preview` | Build satu file HTML Mode Coba (untuk preview) ke `dist-preview/` |

Uji keamanan database (butuh PostgreSQL 15+ lokal, bukan untuk Supabase):

```bash
createdb mp_test
psql -d mp_test -f supabase/tests/supabase_shim.sql -f supabase/migrations/0001_init.sql -f supabase/tests/rls_test.sql
```

---

## 6. Struktur folder

```
src/
  auth/          Provider sesi, guard halaman, pesan error login
  components/    UI reusable (Button, Modal, StatCard, EmptyState, ...) + layout + grafik
  data/          Lapisan penyimpanan: supabaseStore (cloud) & localStore (Mode Coba)
  features/      Komponen per fitur (tasks, courses, finance, calendar, gpa, demo, quick)
  hooks/         useRows/useInsert/useUpdate (React Query), useProfile, useToday
  lib/           Format Rupiah & tanggal Indonesia, zona waktu WIB, konstanta
  pages/         Halaman (route)
  schemas/       Validasi formulir (Zod)
  services/      Logika perhitungan murni + unit test
  types/         Tipe tabel database
supabase/
  migrations/    Skema SQL + RLS + fungsi save_budget
  tests/         Uji RLS & constraint
```

## 7. Keamanan

- Semua tabel memakai **Row Level Security**: setiap pengguna hanya bisa membaca/mengubah datanya sendiri.
- Relasi antar tabel memakai *foreign key* gabungan `(id, user_id)` sehingga data tidak bisa ditautkan ke milik pengguna lain.
- Uang disimpan sebagai `numeric(14,2)`; waktu sebagai `timestamptz` (ditampilkan dalam WIB).
- Kata sandi dikelola Supabase Auth; aplikasi tidak menyimpan kata sandi.
- Validasi di formulir (Zod) **dan** di database (constraint + fungsi `save_budget`).
