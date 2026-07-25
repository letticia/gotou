import { describe, expect, it } from "vitest";
import { buildPages, resolveDisplayRuby } from "./gongyo";
import type { GongyoPage, GongyoPreset, GongyoUnit } from "./gongyo";

const units = new Map<string, GongyoUnit>([
  [
    "unit-a",
    {
      id: "unit-a",
      title: "ユニットA",
      reading: "ゆにっとえー",
      body: [
        { text: "一句目", ruby: "いっくめ" },
        { text: "二句目", ruby: "にくめ" },
      ],
    },
  ],
  [
    "unit-b",
    {
      id: "unit-b",
      title: "ユニットB",
      reading: "ゆにっとびー",
      body: [{ text: "単句" }],
    },
  ],
]);

describe("buildPages", () => {
  it("expands each unit's body into one page per item, in preset order", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-a" }, { unit: "unit-b", counter: 10 }],
    };
    const pages = buildPages(preset, units);
    expect(pages).toEqual([
      { unitId: "unit-a", bodyIndex: 0, text: "一句目", ruby: "いっくめ", counterTotal: undefined },
      { unitId: "unit-a", bodyIndex: 1, text: "二句目", ruby: "にくめ", counterTotal: undefined },
      { unitId: "unit-b", bodyIndex: 0, text: "単句", ruby: undefined, counterTotal: 10 },
    ]);
  });

  it("skips preset items with enabled: false", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-a", enabled: false }, { unit: "unit-b" }],
    };
    const pages = buildPages(preset, units);
    expect(pages).toEqual([
      { unitId: "unit-b", bodyIndex: 0, text: "単句", ruby: undefined, counterTotal: undefined },
    ]);
  });

  it("skips preset items referencing an unknown unit", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "does-not-exist" }, { unit: "unit-b" }],
    };
    const pages = buildPages(preset, units);
    expect(pages).toEqual([
      { unitId: "unit-b", bodyIndex: 0, text: "単句", ruby: undefined, counterTotal: undefined },
    ]);
  });
});

describe("resolveDisplayRuby", () => {
  const basePage: GongyoPage = {
    unitId: "junen",
    bodyIndex: 0,
    text: "南無阿弥陀仏",
    ruby: "なむあみだぶ",
    counterTotal: 10,
    counterRubyOverrides: { 2: "なむあみだぶつ" },
  };

  it("returns the override when counterRemaining matches a key", () => {
    expect(resolveDisplayRuby(basePage, 2)).toBe("なむあみだぶつ");
  });

  it("returns the base ruby when counterRemaining does not match any key", () => {
    expect(resolveDisplayRuby(basePage, 9)).toBe("なむあみだぶ");
  });

  it("returns the base ruby when counterRemaining is null", () => {
    expect(resolveDisplayRuby(basePage, null)).toBe("なむあみだぶ");
  });

  it("returns the base ruby when the page has no overrides", () => {
    const page: GongyoPage = { unitId: "u", bodyIndex: 0, text: "t", ruby: "r" };
    expect(resolveDisplayRuby(page, 2)).toBe("r");
  });
});
