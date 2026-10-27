import { useEffect, useState } from "react";
import { todayStr } from "@/lib/time";

/** Tanggal hari ini (WIB) — ikut berganti saat lewat tengah malam. */
export function useToday(): string {
  const [today, setToday] = useState(todayStr());
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayStr();
      setToday((prev) => (prev === t ? prev : t));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
