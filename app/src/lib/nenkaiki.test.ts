import { describe, expect, it } from "vitest";
import { listMemorials, nextMemorial } from "./nenkaiki";

/** ローカル日付で作り、YYYY-MM-DD で比べる(時差の影響を受けないように) */
function d(y: number, m: number, day: number): Date {
  return new Date(y, m - 1, day);
}
function ymd(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
function byLabel(deathDate: Date) {
  return Object.fromEntries(listMemorials(deathDate).map((m) => [m.label, ymd(m.date)]));
}

describe("listMemorials", () => {
  const m = byLabel(d(2026, 10, 1));

  it("counts 中陰 with the day of death as day 1", () => {
    expect(m["初七日"]).toBe("2026-10-07");
    expect(m["二七日"]).toBe("2026-10-14");
    expect(m["四十九日(七七日)"]).toBe("2026-11-18");
  });

  it("counts 百箇日 the same way", () => {
    expect(m["百箇日"]).toBe("2027-01-08");
  });

  it("puts 一周忌 one full year later and 三回忌 two years later", () => {
    expect(m["一周忌"]).toBe("2027-10-01");
    expect(m["三回忌"]).toBe("2028-10-01");
  });

  it("puts N回忌 N-1 years later", () => {
    expect(m["七回忌"]).toBe("2032-10-01");
    expect(m["十三回忌"]).toBe("2038-10-01");
    expect(m["十七回忌"]).toBe("2042-10-01");
    expect(m["二十三回忌"]).toBe("2048-10-01");
    expect(m["二十七回忌"]).toBe("2052-10-01");
    expect(m["三十三回忌"]).toBe("2058-10-01");
    expect(m["五十回忌"]).toBe("2075-10-01");
  });

  it("lists only the agreed anniversaries (no 二十五回忌)", () => {
    const labels = listMemorials(d(2026, 10, 1)).map((x) => x.label);
    expect(labels).not.toContain("二十五回忌");
    expect(labels.filter((l) => l.endsWith("回忌") || l === "一周忌")).toEqual([
      "一周忌", "三回忌", "七回忌", "十三回忌", "十七回忌",
      "二十三回忌", "二十七回忌", "三十三回忌", "五十回忌",
    ]);
  });

  it("is in date order", () => {
    const times = listMemorials(d(2026, 10, 1)).map((x) => x.date.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("crosses the year end for 中陰", () => {
    expect(byLabel(d(2026, 12, 20))["四十九日(七七日)"]).toBe("2027-02-06");
  });

  it("keeps a 2/29 命日 in February in non-leap years", () => {
    const leap = byLabel(d(2028, 2, 29));
    expect(leap["一周忌"]).toBe("2029-02-28");
    expect(leap["三回忌"]).toBe("2030-02-28");
    // 満4年(七回忌ではないが、うるう年に戻れば29日)
    expect(leap["七回忌"]).toBe("2034-02-28");
  });

  it("ignores the time of day of the death date", () => {
    expect(byLabel(new Date(2026, 9, 1, 23, 59))["初七日"]).toBe("2026-10-07");
  });
});

describe("nextMemorial", () => {
  const memorials = listMemorials(d(2026, 10, 1));

  it("returns the nearest upcoming one", () => {
    expect(nextMemorial(memorials, d(2026, 10, 3))?.label).toBe("初七日");
  });

  it("includes today", () => {
    expect(nextMemorial(memorials, d(2026, 10, 7))?.label).toBe("初七日");
  });

  it("moves on once the day has passed", () => {
    expect(nextMemorial(memorials, d(2026, 10, 8))?.label).toBe("二七日");
    expect(nextMemorial(memorials, d(2027, 2, 1))?.label).toBe("一周忌");
  });

  it("returns null after the last one", () => {
    expect(nextMemorial(memorials, d(2080, 1, 1))).toBeNull();
  });
});
