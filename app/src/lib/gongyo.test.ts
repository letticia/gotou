import { describe, expect, it } from "vitest";
import { buildPages, lineSizeTier, resolveDisplayRuby } from "./gongyo";
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
  [
    "unit-long",
    {
      id: "unit-long",
      title: "ロングユニット",
      reading: "ろんぐゆにっと",
      paginated: true,
      body: [
        { text: "一", ruby: "いち" },
        { text: "二", ruby: "に" },
        { text: "三", ruby: "さん" },
        { text: "四", ruby: "よん" },
        { text: "五", ruby: "ご" },
      ],
    },
  ],
]);

describe("buildPages", () => {
  it("groups each unit's whole body into a single page (grouped display)", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-a" }, { unit: "unit-b", counter: 10 }],
    };
    const pages = buildPages(preset, units);
    expect(pages).toEqual([
      {
        unitId: "unit-a",
        unitTitle: "ユニットA",
        lines: [
          { text: "一句目", ruby: "いっくめ" },
          { text: "二句目", ruby: "にくめ" },
        ],
        counterTotal: undefined,
        counterRubyOverrides: undefined,
      },
      {
        unitId: "unit-b",
        unitTitle: "ユニットB",
        lines: [{ text: "単句", ruby: undefined }],
        counterTotal: 10,
        counterRubyOverrides: undefined,
      },
    ]);
  });

  it("splits a paginated unit into batches of 3 new lines, echoing the previous page's last line", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-long" }],
    };
    const pages = buildPages(preset, units);
    expect(pages).toEqual([
      {
        unitId: "unit-long",
        unitTitle: "ロングユニット",
        lines: [
          { text: "一", ruby: "いち" },
          { text: "二", ruby: "に" },
          { text: "三", ruby: "さん" },
        ],
        paginated: true,
        counterTotal: undefined,
      },
      {
        unitId: "unit-long",
        unitTitle: "ロングユニット",
        paginated: true,
        lines: [
          { text: "三", ruby: "さん", dimmed: true },
          { text: "四", ruby: "よん" },
          { text: "五", ruby: "ご" },
        ],
        counterTotal: undefined,
      },
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
    expect(pages.map((p) => p.unitId)).toEqual(["unit-b"]);
  });

  it("skips preset items referencing an unknown unit", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "does-not-exist" }, { unit: "unit-b" }],
    };
    const pages = buildPages(preset, units);
    expect(pages.map((p) => p.unitId)).toEqual(["unit-b"]);
  });

  it("does not carry counterRubyOverrides for multi-line grouped pages", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-a" }],
    };
    const pages = buildPages(preset, units);
    expect(pages[0].counterRubyOverrides).toBeUndefined();
  });
});

describe("resolveDisplayRuby", () => {
  const basePage: GongyoPage = {
    unitId: "junen",
    unitTitle: "十念",
    lines: [{ text: "南無阿弥陀仏", ruby: "なむあみだぶ" }],
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
    const page: GongyoPage = { unitId: "u", unitTitle: "u", lines: [{ text: "t", ruby: "r" }] };
    expect(resolveDisplayRuby(page, 2)).toBe("r");
  });
});

describe("lineSizeTier", () => {
  it("returns tier 1 for 1-2 lines", () => {
    expect(lineSizeTier(1)).toBe(1);
    expect(lineSizeTier(2)).toBe(1);
  });

  it("returns tier 2 for 3-4 lines", () => {
    expect(lineSizeTier(3)).toBe(2);
    expect(lineSizeTier(4)).toBe(2);
  });

  it("returns tier 3 for 5-6 lines", () => {
    expect(lineSizeTier(5)).toBe(3);
    expect(lineSizeTier(6)).toBe(3);
  });

  it("returns tier 4 for 7+ lines", () => {
    expect(lineSizeTier(7)).toBe(4);
    expect(lineSizeTier(20)).toBe(4);
  });
});
