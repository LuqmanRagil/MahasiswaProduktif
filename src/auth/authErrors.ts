import type { AuthError } from "@supabase/supabase-js";

/** Pesan error Supabase Auth → bahasa Indonesia yang jelas. */
export function authErrorMessage(err: AuthError | Error | null | undefined): string {
  if (!err) return "Terjadi kesalahan. Coba lagi.";
  const code = (err as AuthError).code ?? "";
  const msg = err.message?.toLowerCase() ?? "";
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Buka link konfirmasi yang kami kirim ke email kamu.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "Email ini sudah terdaftar. Silakan masuk.";
  if (code === "weak_password" || msg.includes("password should")) return "Kata sandi terlalu lemah. Gunakan minimal 8 karakter berisi huruf dan angka.";
  if (code === "same_password") return "Kata sandi baru harus berbeda dari yang lama.";
  if (code.startsWith("over_") || msg.includes("rate limit") || (err as AuthError).status === 429)
    return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  if (msg.includes("fetch") || msg.includes("network")) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return "Terjadi kesalahan. Coba lagi.";
}
