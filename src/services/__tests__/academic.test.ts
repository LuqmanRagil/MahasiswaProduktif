import { describe, expect, it } from "vitest";
import { DEFAULT_GRADE_SCALE } from "@/lib/constants";
import {
  cumulativeGpa,
  displayGpa,
  finalScore,
  ips,
  letterFor,
  requiredPointForTarget,
  requiredScoreForTarget,
  validateScale,
} from "../academic";

describe("nilai akhir", () => {
  it("menghitung contoh bobot 20/10/30/40", () => {
    const r = finalScore([
      { weight: 20, score: 85 },
      { weight: 10, score: 90 },
      { weight: 30, score: 78 },
      { weight: 40, score: 82 },
    ]);
    // 17 + 9 + 23.4 + 32.8 = 82.2
    expect(r.score).toBe(82.2);
    expect(r.complete).toBe(true);
  });

  it("menolak bobot yang tidak 100%", () => {
    const r = finalScore([
      { weight: 50, score: 80 },
      { weight: 40, score: 80 },
    ]);
    expect(r.weightValid).toBe(false);
    expect(r.score).toBeNull();
  });

  it("menghitung nilai UAS minimum agar dapat target", () => {
    const comps = [
      { weight: 20, score: 85 },
      { weight: 10, score: 90 },
      { weight: 30, score: 78 },
      { weight: 40, score: null },
    ];
    // sudah 49.4, butuh 85 → (85 - 49.4) / 0.4 = 89
    expect(requiredScoreForTarget(comps, 85)).toBe(89);
  });
});

describe("huruf mutu", () => {
  it("memakai skala A/A-/B+", () => {
    expect(letterFor(85, DEFAULT_GRADE_SCALE)?.letter).toBe("A");
    expect(letterFor(84.99, DEFAULT_GRADE_SCALE)?.letter).toBe("A-");
    expect(letterFor(72, DEFAULT_GRADE_SCALE)?.letter).toBe("B");
    expect(letterFor(10, DEFAULT_GRADE_SCALE)?.letter).toBe("E");
  });

  it("validasi skala", () => {
    expect(validateScale(DEFAULT_GRADE_SCALE)).toBeNull();
    expect(validateScale([{ letter: "A", min: 80, point: 4 }])).toMatch(/terendah/);
    expect(
      validateScale([
        { letter: "A", min: 80, point: 3 },
        { letter: "B", min: 0, point: 3.5 },
      ]),
    ).toMatch(/turun/);
  });
});

describe("IPS & IPK", () => {
  const sem = [
    { credits: 3, point: 4 },
    { credits: 2, point: 3.3 },
    { credits: 3, point: 3 },
  ];

  it("IPS = Σ(SKS×mutu)/ΣSKS", () => {
    // (12 + 6.6 + 9) / 8 = 3.45
    expect(ips(sem)).toBeCloseTo(3.45, 10);
    expect(ips([])).toBeNull();
  });

  it("IPK kumulatif", () => {
    // (3.2×40 + 27.6) / 48 = 155.6/48 = 3.241666…
    expect(cumulativeGpa(3.2, 40, sem)).toBeCloseTo(3.2416667, 6);
    expect(displayGpa(cumulativeGpa(3.2, 40, sem))).toBe("3,24");
  });

  it("IPK semester pertama (tanpa SKS lama)", () => {
    expect(cumulativeGpa(0, 0, sem)).toBeCloseTo(3.45, 10);
  });

  it("mutu rata-rata yang dibutuhkan untuk target", () => {
    // target 3.5 dengan 40 SKS lama IPK 3.2 dan 20 SKS baru → (3.5×60 − 128)/20 = 4.1 (mustahil)
    expect(requiredPointForTarget(3.5, 3.2, 40, 20)).toBeCloseTo(4.1, 10);
    expect(requiredPointForTarget(3.3, 3.2, 40, 20)).toBeCloseTo(3.5, 10);
  });
});
