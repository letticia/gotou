import { describe, expect, it } from "vitest";
import { searchEntries } from "./search";
import type { DummyEntry } from "./dummyEntries";

const entries: DummyEntry[] = [
  { id: 1, title: "阿弥陀経", reading: "あみだきょう", searchKey: "阿弥陀経", body: "" },
  { id: 2, title: "阿弥陀池", reading: "あみだいけ", searchKey: "阿弥陀池", body: "" },
  { id: 3, title: "佛教大学", reading: "ぶっきょうだいがく", searchKey: "仏教大学", body: "" },
];

describe("searchEntries", () => {
  it("matches by reading prefix", () => {
    expect(searchEntries(entries, "あみだ").map((e) => e.id)).toEqual([1, 2]);
  });

  it("narrows further with a longer reading prefix", () => {
    expect(searchEntries(entries, "あみだき").map((e) => e.id)).toEqual([1]);
  });

  it("matches by normalized search key (already-modern kanji input)", () => {
    expect(searchEntries(entries, "仏教").map((e) => e.id)).toEqual([3]);
  });

  it("normalizes old-form kanji input before matching", () => {
    expect(searchEntries(entries, "佛教").map((e) => e.id)).toEqual([3]);
  });

  it("returns empty array for empty query", () => {
    expect(searchEntries(entries, "")).toEqual([]);
  });

  it("returns empty array when nothing matches", () => {
    expect(searchEntries(entries, "存在しない")).toEqual([]);
  });
});
