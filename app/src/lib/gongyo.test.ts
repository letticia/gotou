import { describe, expect, it } from "vitest";
import { buildPages } from "./gongyo";
import type { GongyoPreset, GongyoUnit } from "./gongyo";

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
