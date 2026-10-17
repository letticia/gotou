import { describe, expect, it } from "vitest";
import type { GohogoToken } from "./gohogo";
import { buildHeadwordIndex, findGlossSpans } from "./glossLinks";

// 見出しは自作のもの(実際の辞書データは使わない)
const index = buildHeadwordIndex([
  { id: 1, title: "阿弥陀", reading: "あみだ" },
  { id: 2, title: "南無阿弥陀仏", reading: "なむあみだぶつ" },
  { id: 3, title: "仏", reading: "ほとけ" },
  { id: 4, title: "本願", reading: "ほんがん" },
  { id: 5, title: "往生", reading: "おうじょう" },
  { id: 6, title: "往生極楽", reading: "おうじょうごくらく" },
  { id: 7, title: "ただ", reading: "ただ" },
  { id: 8, title: "彌陀", reading: "みだ" },
]);

function titles(tokens: GohogoToken[]) {
  return findGlossSpans(tokens, index).map((s) => [
    tokens.slice(s.start, s.end).map((t) => t[0]).join(""),
    s.entry.id,
  ]);
}

describe("buildHeadwordIndex", () => {
  it("drops one-character headwords", () => {
    expect(index.byKey.has("仏")).toBe(false);
  });

  it("drops kana-only headwords", () => {
    expect(index.byKey.has("ただ")).toBe(false);
  });

  it("normalizes variant characters", () => {
    // 「彌陀」は新字体の「弥陀」で引ける
    expect(index.byKey.get("弥陀")?.id).toBe(8);
  });
});

describe("findGlossSpans", () => {
  it("prefers the longest headword starting at a position", () => {
    expect(titles([["南無阿弥陀仏", "なむあみだぶつ"], ["と"], ["申", "もう"]])).toEqual([
      ["南無阿弥陀仏", 2],
    ]);
  });

  it("joins tokens when a headword spans several of them", () => {
    expect(titles([["往生", "おうじょう"], ["極楽", "ごくらく"], ["のためには、"]])).toEqual([
      ["往生極楽", 6],
    ]);
  });

  it("falls back to a shorter headword when the longer one is not there", () => {
    expect(titles([["往生", "おうじょう"], ["するぞと"]])).toEqual([["往生", 5]]);
  });

  it("finds several words in a row without overlapping", () => {
    expect(
      titles([["弥陀", "みだ"], ["の"], ["本願", "ほんがん"], ["の"], ["船", "ふね"]]),
    ).toEqual([
      ["弥陀", 8],
      ["本願", 4],
    ]);
  });

  it("does not match in the middle of a ruby token", () => {
    // 「阿弥陀仏」の中の「阿弥陀」は、トークンを割ることになるので採らない
    expect(titles([["阿弥陀仏", "あみだぶつ"]])).toEqual([]);
  });

  it("does not link kana-only text", () => {
    expect(titles([["ただ"], ["念仏"]])).toEqual([]);
  });

  it("returns nothing when the dictionary is not available", () => {
    const empty = buildHeadwordIndex([]);
    expect(findGlossSpans([["本願", "ほんがん"]], empty)).toEqual([]);
  });
});
