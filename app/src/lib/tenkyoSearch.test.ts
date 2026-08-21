import { describe, expect, it } from "vitest";
import { searchDictionaryByClauses, searchGongyoByClauses } from "./tenkyoSearch";
import type { GongyoPreset, GongyoUnit } from "./gongyo";
import type { SearchRow } from "./db";

function row(id: number, title: string): SearchRow {
  return { id, title, reading: `よみ${id}` };
}

/** 句 -> ヒット項目 の対応表から、注入用の偽検索関数を作る */
function fakeSearch(table: Record<string, SearchRow[]>) {
  const calls: string[] = [];
  const search = (needle: string) => {
    calls.push(needle);
    return table[needle] ?? [];
  };
  return { search, calls };
}

describe("searchDictionaryByClauses", () => {
  it("ranks entries matching more clauses first", () => {
    const { search } = fakeSearch({
      句アルファ: [row(1, "項目一"), row(2, "項目二")],
      句ベータ: [row(2, "項目二")],
    });
    const hits = searchDictionaryByClauses(["句アルファ", "句ベータ"], search);
    expect(hits.map((h) => h.id)).toEqual([2, 1]);
    expect(hits[0].matchedClauses).toBe(2);
    expect(hits[1].matchedClauses).toBe(1);
  });

  it("also queries the variant-normalized form and unions the results", () => {
    // 彌 -> 弥 は shared/variants.json による正規化
    const { search, calls } = fakeSearch({ 阿弥陀仏: [row(7, "阿弥陀仏")] });
    const hits = searchDictionaryByClauses(["阿彌陀佛"], search);
    expect(calls).toContain("阿彌陀佛");
    expect(calls).toContain("阿弥陀仏");
    expect(hits.map((h) => h.id)).toEqual([7]);
  });

  it("does not double-count an entry found by both the raw and normalized form", () => {
    const { search } = fakeSearch({
      阿彌陀佛: [row(7, "阿弥陀仏")],
      阿弥陀仏: [row(7, "阿弥陀仏")],
    });
    const hits = searchDictionaryByClauses(["阿彌陀佛"], search);
    expect(hits[0].matchedClauses).toBe(1);
  });

  it("queries only once when the clause is already normalized", () => {
    const { search, calls } = fakeSearch({});
    searchDictionaryByClauses(["南無阿弥陀仏"], search);
    expect(calls).toEqual(["南無阿弥陀仏"]);
  });

  it("returns an empty array when nothing matches", () => {
    const { search } = fakeSearch({});
    expect(searchDictionaryByClauses(["該当なしの句"], search)).toEqual([]);
  });
});

describe("searchGongyoByClauses", () => {
  const units = new Map<string, GongyoUnit>([
    [
      "unit-a",
      {
        id: "unit-a",
        title: "ユニットA",
        reading: "ゆにっとえー",
        body: [
          { text: "南無阿弥陀仏", ruby: "なむあみだぶ" },
          { text: "願以此功徳", ruby: "がんにしくどく" },
        ],
      },
    ],
    [
      "unit-b",
      {
        id: "unit-b",
        title: "ユニットB",
        reading: "ゆにっとびー",
        body: [{ text: "平等施一切", ruby: "びょうどうせいっさい" }],
      },
    ],
  ]);

  const presets = new Map<string, GongyoPreset>([
    [
      "p1",
      { version: 1, id: "p1", name: "日常勤行式", items: [{ unit: "unit-a" }, { unit: "unit-b" }] },
    ],
    ["p2", { version: 1, id: "p2", name: "棚経", items: [{ unit: "unit-a" }] }],
  ]);

  it("matches when a whole gongyo line is contained in the pasted passage", () => {
    const hits = searchGongyoByClauses("先に南無阿弥陀仏と十遍となえる", [], units, presets);
    expect(hits).toHaveLength(1);
    expect(hits[0].unitTitle).toBe("ユニットA");
    expect(hits[0].lineText).toBe("南無阿弥陀仏");
    expect(hits[0].lineIndex).toBe(0);
  });

  it("matches when a clause is contained in a gongyo line", () => {
    const hits = searchGongyoByClauses("", ["以此功徳"], units, presets);
    expect(hits.map((h) => h.lineText)).toEqual(["願以此功徳"]);
  });

  it("matches against the ruby so kana input works", () => {
    const hits = searchGongyoByClauses("", ["びょうどうせいっさい"], units, presets);
    expect(hits.map((h) => h.unitId)).toEqual(["unit-b"]);
  });

  it("lists every preset that contains the unit", () => {
    const hits = searchGongyoByClauses("", ["南無阿弥陀仏"], units, presets);
    expect(hits[0].presetNames).toEqual(["日常勤行式", "棚経"]);
  });

  it("does not match a line shorter than 4 characters via the containment direction", () => {
    const shortUnits = new Map<string, GongyoUnit>([
      [
        "u",
        { id: "u", title: "短", reading: "たん", body: [{ text: "南無" }] },
      ],
    ]);
    // 「南無」は2字。入力に含まれていても短すぎるので拾わない(誤ヒット防止)
    expect(searchGongyoByClauses("南無阿弥陀仏", [], shortUnits, presets)).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(searchGongyoByClauses("", [], units, presets)).toEqual([]);
  });
});
