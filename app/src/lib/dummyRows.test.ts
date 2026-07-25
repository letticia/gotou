import { describe, expect, it } from "vitest";
import { buildDummyRows } from "./dummyRows";
import type { DummyEntry } from "./dummyEntries";

const entries: DummyEntry[] = [
  {
    id: 1,
    title: "阿弥陀経",
    reading: "あみだきょう",
    searchKey: "阿弥陀経",
    body: "=あみだきょう／阿弥陀経=\n[[阿弥陀池]]について説く。",
  },
  {
    id: 2,
    title: "阿弥陀池",
    reading: "あみだいけ",
    searchKey: "阿弥陀池",
    body: "=あみだいけ／阿弥陀池=\n大阪にある池。[[存在しない項目]]とは無関係。",
  },
];

describe("buildDummyRows", () => {
  it("builds one entry row per DummyEntry with body_html holding the raw wikitext", () => {
    const titleToId = new Map([
      ["阿弥陀経", 1],
      ["阿弥陀池", 2],
    ]);
    const { entryRows } = buildDummyRows(entries, titleToId);
    expect(entryRows).toEqual([
      { id: 1, title: "阿弥陀経", reading: "あみだきょう", searchKey: "阿弥陀経", bodyHtml: entries[0].body },
      { id: 2, title: "阿弥陀池", reading: "あみだいけ", searchKey: "阿弥陀池", bodyHtml: entries[1].body },
    ]);
  });

  it("derives link pairs by reusing parseBody's link resolution (broken links excluded)", () => {
    const titleToId = new Map([
      ["阿弥陀経", 1],
      ["阿弥陀池", 2],
    ]);
    const { linkPairs } = buildDummyRows(entries, titleToId);
    // entry 1 -> entry 2 (resolved); entry 2's link to "存在しない項目" is unresolved and excluded
    expect(linkPairs).toEqual([[1, 2]]);
  });
});
