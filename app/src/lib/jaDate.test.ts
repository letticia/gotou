import { describe, expect, it } from "vitest";
import { formatJaDate, parseDateInput } from "./jaDate";

describe("formatJaDate", () => {
  it("writes the date with the weekday in Japanese", () => {
    expect(formatJaDate(new Date(2026, 9, 7))).toBe("2026年10月7日(水)");
    expect(formatJaDate(new Date(2027, 0, 1))).toBe("2027年1月1日(金)");
  });
});

describe("parseDateInput", () => {
  it("reads YYYY-MM-DD as a local date (not UTC)", () => {
    const date = parseDateInput("2026-10-01")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 1]);
  });

  it("returns null for an empty or malformed value", () => {
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("2026/10/01")).toBeNull();
  });

  it("rejects a date that does not exist", () => {
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("2027-02-29")).toBeNull();
    expect(parseDateInput("2028-02-29")).not.toBeNull();
  });
});
