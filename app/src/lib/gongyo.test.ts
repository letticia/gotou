import { describe, expect, it } from "vitest";
import {
  buildPages,
  firstPageIndexOfItem,
  lineSizeTier,
  paginatedBatchSize,
  paginatedSizeTier,
  resolveDisplayRuby,
  verticalMaxLineLength,
  verticalPaginatedBatchSize,
} from "./gongyo";
import type { GongyoPage, GongyoPageLine, GongyoPreset, GongyoUnit } from "./gongyo";

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
      // 1句12文字(<=20文字なのでpaginatedBatchSize=4になる)
      body: [
        { text: "AAAAAAAAAAAA", ruby: "a" },
        { text: "BBBBBBBBBBBB", ruby: "b" },
        { text: "CCCCCCCCCCCC", ruby: "c" },
        { text: "DDDDDDDDDDDD", ruby: "d" },
        { text: "EEEEEEEEEEEE", ruby: "e" },
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
        itemIndex: 0,
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
        itemIndex: 1,
        unitTitle: "ユニットB",
        lines: [{ text: "単句", ruby: undefined }],
        counterTotal: 10,
        counterRubyOverrides: undefined,
      },
    ]);
  });

  it("splits a paginated unit using paginatedBatchSize(), echoing the previous page's last line", () => {
    const preset: GongyoPreset = {
      version: 1,
      id: "p",
      name: "テスト差定",
      items: [{ unit: "unit-long" }],
    };
    const pages = buildPages(preset, units);
    // 1句12文字 -> paginatedBatchSize=4。5句あるので4句+1句の2ページに分かれる
    expect(pages).toEqual([
      {
        unitId: "unit-long",
        itemIndex: 0,
        unitTitle: "ロングユニット",
        lines: [
          { text: "AAAAAAAAAAAA", ruby: "a" },
          { text: "BBBBBBBBBBBB", ruby: "b" },
          { text: "CCCCCCCCCCCC", ruby: "c" },
          { text: "DDDDDDDDDDDD", ruby: "d" },
        ],
        paginated: true,
        counterTotal: undefined,
      },
      {
        unitId: "unit-long",
        itemIndex: 0,
        unitTitle: "ロングユニット",
        paginated: true,
        lines: [
          { text: "DDDDDDDDDDDD", ruby: "d", dimmed: true },
          { text: "EEEEEEEEEEEE", ruby: "e" },
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
    itemIndex: 0,
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
    const page: GongyoPage = {
      unitId: "u",
      itemIndex: 0,
      unitTitle: "u",
      lines: [{ text: "t", ruby: "r" }],
    };
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

describe("paginatedSizeTier", () => {
  it("returns tier 1 when the longest non-dimmed line is short and there are few lines", () => {
    expect(paginatedSizeTier([{ text: "我建超世願" }, { text: "必至無上道" }])).toBe(1);
  });

  it("returns a smaller tier as the longest non-dimmed line gets longer", () => {
    expect(paginatedSizeTier([{ text: "a".repeat(15) }])).toBe(2);
    expect(paginatedSizeTier([{ text: "a".repeat(25) }])).toBe(3);
    expect(paginatedSizeTier([{ text: "a".repeat(31) }])).toBe(4);
  });

  it("ignores dimmed echo lines when computing the tier", () => {
    const lines = [
      { text: "a".repeat(40), dimmed: true },
      { text: "短い行" },
    ];
    expect(paginatedSizeTier(lines)).toBe(1);
  });

  it("returns tier 1 for an empty lines array", () => {
    expect(paginatedSizeTier([])).toBe(1);
  });

  it("bumps short-line pages down to at least tier 2 when there are many lines (larger batch sizes)", () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ text: `句${i}` }));
    expect(paginatedSizeTier(lines)).toBe(2);
  });

  it("does not bump the tier down when there are 4 or fewer lines", () => {
    const lines = Array.from({ length: 4 }, (_, i) => ({ text: `句${i}` }));
    expect(paginatedSizeTier(lines)).toBe(1);
  });
});

describe("verticalMaxLineLength", () => {
  it("returns the longest text length when ruby is short", () => {
    expect(verticalMaxLineLength([{ text: "あ".repeat(9) }, { text: "い".repeat(14) }])).toBe(14);
  });

  it("counts ruby at 0.4x, since ruby runs along the same (vertical) axis as the text", () => {
    // 本文4字・ルビ40字 -> 実効16字ぶんの高さが要る
    expect(verticalMaxLineLength([{ text: "あああ あ".slice(0, 4), ruby: "ん".repeat(40) }])).toBe(16);
  });

  it("ignores the dimmed echo line", () => {
    expect(
      verticalMaxLineLength([{ text: "あ".repeat(40), dimmed: true }, { text: "短い" }]),
    ).toBe(2);
  });

  it("never returns 0, so it is safe as a divisor in CSS", () => {
    expect(verticalMaxLineLength([])).toBe(1);
    expect(verticalMaxLineLength([{ text: "" }])).toBe(1);
  });
});

describe("verticalPaginatedBatchSize", () => {
  function unitWithMaxLength(maxLength: number): GongyoUnit {
    return {
      id: "u",
      title: "u",
      reading: "u",
      paginated: true,
      body: [{ text: "a".repeat(maxLength) }],
    };
  }

  it("advances 3 lines per tap for short phrases (誦経)", () => {
    expect(verticalPaginatedBatchSize(unitWithMaxLength(5))).toBe(3);
    expect(verticalPaginatedBatchSize(unitWithMaxLength(10))).toBe(3);
  });

  it("advances 2 lines per tap for medium phrases", () => {
    expect(verticalPaginatedBatchSize(unitWithMaxLength(11))).toBe(2);
    expect(verticalPaginatedBatchSize(unitWithMaxLength(20))).toBe(2);
  });

  it("advances a single line for very long phrases (一枚起請文), which wraps across columns", () => {
    expect(verticalPaginatedBatchSize(unitWithMaxLength(21))).toBe(1);
    expect(verticalPaginatedBatchSize(unitWithMaxLength(114))).toBe(1);
  });

  it("advances fewer lines than the horizontal batch size for the same unit", () => {
    const unit = unitWithMaxLength(5);
    expect(verticalPaginatedBatchSize(unit)).toBeLessThan(paginatedBatchSize(unit));
  });
});

describe("buildPages with orientation", () => {
  const preset: GongyoPreset = {
    version: 1,
    id: "p",
    name: "テスト差定",
    items: [{ unit: "unit-long" }],
  };

  it("splits a paginated unit into more pages in vertical mode (smaller batches)", () => {
    const horizontal = buildPages(preset, units, "horizontal");
    const vertical = buildPages(preset, units, "vertical");
    // unit-longは1句12文字: 横書きは4行/タップ、縦書きは2行/タップ
    expect(horizontal).toHaveLength(2);
    expect(vertical).toHaveLength(3);
  });

  it("defaults to horizontal when no orientation is given", () => {
    expect(buildPages(preset, units)).toEqual(buildPages(preset, units, "horizontal"));
  });

  it("omits the dimmed echo when the batch is a single line (very long phrases)", () => {
    const longUnit: GongyoUnit = {
      id: "unit-verylong",
      title: "超長文ユニット",
      reading: "ちょうちょうぶん",
      paginated: true,
      // 1句21文字以上なので縦書きのバッチ行数は1になる
      body: [{ text: "あ".repeat(30) }, { text: "い".repeat(30) }],
    };
    const map = new Map<string, GongyoUnit>([["unit-verylong", longUnit]]);
    const pages = buildPages(
      { version: 1, id: "p", name: "n", items: [{ unit: "unit-verylong" }] },
      map,
      "vertical",
    );
    expect(verticalPaginatedBatchSize(longUnit)).toBe(1);
    expect(pages).toHaveLength(2);
    // 2ページ目にもエコー行(dimmed)が無いこと
    expect(pages[1].lines).toEqual([{ text: "い".repeat(30), ruby: undefined }]);
  });
});

describe("firstPageIndexOfItem", () => {
  // 同じunit(junen)が差定に2回現れるケース。日常勤行式では十念が4回現れる。
  const pages: GongyoPage[] = [
    { unitId: "junen", itemIndex: 0, unitTitle: "十念", lines: [{ text: "1" }] },
    { unitId: "other", itemIndex: 1, unitTitle: "他", lines: [{ text: "2" }] },
    { unitId: "junen", itemIndex: 2, unitTitle: "十念", lines: [{ text: "3" }] },
  ];

  it("distinguishes repeated occurrences of the same unit", () => {
    expect(firstPageIndexOfItem(pages, 0)).toBe(0);
    expect(firstPageIndexOfItem(pages, 2)).toBe(2);
  });

  it("returns the first page of a multi-page item, not a later one", () => {
    const multi: GongyoPage[] = [
      { unitId: "a", itemIndex: 0, unitTitle: "A", lines: [{ text: "1" }] },
      { unitId: "b", itemIndex: 1, unitTitle: "B", lines: [{ text: "2" }] },
      { unitId: "b", itemIndex: 1, unitTitle: "B", lines: [{ text: "3" }] },
    ];
    expect(firstPageIndexOfItem(multi, 1)).toBe(1);
  });

  it("falls back to the beginning for an unknown item index", () => {
    expect(firstPageIndexOfItem(pages, 99)).toBe(0);
    expect(firstPageIndexOfItem([], 0)).toBe(0);
  });
});

describe("paginatedBatchSize", () => {
  function unitWithMaxLength(maxLength: number): GongyoUnit {
    return {
      id: "u",
      title: "u",
      reading: "u",
      paginated: true,
      body: [{ text: "a".repeat(maxLength) }],
    };
  }

  it("returns 6 when the longest line is 10 characters or fewer", () => {
    expect(paginatedBatchSize(unitWithMaxLength(5))).toBe(6);
    expect(paginatedBatchSize(unitWithMaxLength(10))).toBe(6);
  });

  it("returns 4 when the longest line is 11-20 characters", () => {
    expect(paginatedBatchSize(unitWithMaxLength(11))).toBe(4);
    expect(paginatedBatchSize(unitWithMaxLength(20))).toBe(4);
  });

  it("returns 3 when the longest line exceeds 20 characters", () => {
    expect(paginatedBatchSize(unitWithMaxLength(21))).toBe(3);
    expect(paginatedBatchSize(unitWithMaxLength(114))).toBe(3);
  });
});
