import { describe, expect, it } from "vitest";
import type { BudgetCategory } from "@/types/db";
import { amountFromPercent, budgetStatus, categoryUsage, dailyExpenses, periodFor, summarizeBudget, totals } from "../finance";

describe("periode anggaran", () => {
  it("mulai tanggal 1", () => {
    expect(periodFor("2026-10-27", 1)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(periodFor("2026-02-10", 1)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("mulai tanggal kiriman (5)", () => {
    expect(periodFor("2026-10-03", 5)).toEqual({ start: "2026-09-05", end: "2026-10-04" });
    expect(periodFor("2026-10-05", 5)).toEqual({ start: "2026-10-05", end: "2026-11-04" });
    expect(periodFor("2026-12-20", 25)).toEqual({ start: "2026-11-25", end: "2026-12-24" });
  });
});

describe("saldo & total", () => {
  it("pemasukan dan pengeluaran dipisah, tidak dobel", () => {
    const txs = [
      { type: "income" as const, amount: 1_500_000 },
      { type: "expense" as const, amount: 15_000 },
      { type: "expense" as const, amount: 500_000 },
    ];
    expect(totals(txs)).toEqual({ income: 1_500_000, expense: 515_000, balance: 985_000 });
  });

  it("mengedit transaksi lama hanya mengubah transaksi itu", () => {
    const txs = [
      { id: "a", type: "expense" as const, amount: 20_000 },
      { id: "b", type: "expense" as const, amount: 30_000 },
    ];
    const edited = txs.map((t) => (t.id === "a" ? { ...t, amount: 25_000 } : t));
    expect(totals(edited).expense).toBe(55_000);
    expect(totals(txs).expense).toBe(50_000); // data awal tidak berubah
  });
});

describe("ringkasan anggaran", () => {
  it("sisa, persentase, jatah harian & mingguan", () => {
    // Selasa 27 Okt 2026, periode Okt (sisa 5 hari termasuk hari ini)
    const s = summarizeBudget(1_500_000, 1_000_000, "2026-10-27", { start: "2026-10-01", end: "2026-10-31" });
    expect(s.remaining).toBe(500_000);
    expect(s.daysLeft).toBe(5);
    expect(s.dailyAllowance).toBe(100_000);
    // minggu ini: Selasa–Sabtu 31 Okt (periode berakhir sebelum Minggu) = 5 hari
    expect(s.weekDaysLeft).toBe(5);
    expect(s.weekAllowance).toBe(500_000);
    expect(s.status).toBe("aman");
  });

  it("jatah 0 jika anggaran sudah terlampaui", () => {
    const s = summarizeBudget(1_000_000, 1_200_000, "2026-10-10", { start: "2026-10-01", end: "2026-10-31" });
    expect(s.dailyAllowance).toBe(0);
    expect(s.status).toBe("lewat");
  });

  it("status peringatan", () => {
    expect(budgetStatus(79, 100)).toBe("aman");
    expect(budgetStatus(80, 100)).toBe("waspada");
    expect(budgetStatus(101, 100)).toBe("lewat");
  });
});

describe("pemakaian per kategori", () => {
  const cat = (id: string, name: string): BudgetCategory => ({ id, name, icon: "wallet", position: 0, user_id: "u", created_at: "" });
  it("menghitung sisa per kategori & pengeluaran tanpa kategori", () => {
    const rows = categoryUsage(
      [cat("makan", "Makan"), cat("kos", "Kos")],
      [
        { category_id: "makan", amount: 600_000 },
        { category_id: "kos", amount: 500_000 },
      ],
      [
        { type: "expense", amount: 500_000, category_id: "makan" },
        { type: "expense", amount: 500_000, category_id: "kos" },
        { type: "expense", amount: 10_000, category_id: null },
        { type: "income", amount: 1_500_000, category_id: null },
      ],
    );
    expect(rows[0]).toMatchObject({ spent: 500_000, remaining: 100_000, status: "waspada" });
    expect(rows[1]).toMatchObject({ spent: 500_000, remaining: 0, status: "waspada" });
    expect(rows[2]).toMatchObject({ category: null, spent: 10_000 });
  });

  it("mode persen dibulatkan ke rupiah", () => {
    expect(amountFromPercent(1_500_000, 33.33)).toBe(499_950);
  });

  it("pengeluaran harian", () => {
    const d = dailyExpenses(
      [
        { type: "expense", amount: 5_000, occurred_on: "2026-10-26" },
        { type: "expense", amount: 7_000, occurred_on: "2026-10-26" },
        { type: "income", amount: 9_000, occurred_on: "2026-10-26" },
      ],
      ["2026-10-25", "2026-10-26"],
    );
    expect(d).toEqual([
      { date: "2026-10-25", amount: 0 },
      { date: "2026-10-26", amount: 12_000 },
    ]);
  });
});
