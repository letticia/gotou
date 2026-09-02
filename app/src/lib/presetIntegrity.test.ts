import { describe, expect, it } from "vitest";
import { buildPages, loadGongyoPresets, loadGongyoUnits } from "./gongyo";
import { GOHOGO_DAILY_UNIT_ID, withDailyGohogo } from "./gohogo";

/**
 * shared/gongyo/presets/*.json の健全性。
 * buildPages は解決できないunit参照を黙って読み飛ばすので、綴り違いや
 * 消したunitへの参照はここで捕まえないと「勤行中に偈文が1つ抜ける」という
 * 形でしか表に出てこない。
 */

const units = loadGongyoUnits();
const presets = loadGongyoPresets();
// gohogo-daily は差定を組む前に解決される動的unit(gohogo.ts参照)
const resolvedUnits = withDailyGohogo(units, new Date(2026, 8, 30), "zenpen");

describe("差定プリセット", () => {
  it("は5件以上ある(既存分が消えていないこと)", () => {
    expect(presets.size).toBeGreaterThanOrEqual(5);
  });

  it.each([...presets.values()].map((p) => [p.id, p] as const))(
    "%s: 参照しているunitがすべて解決できる",
    (_id, preset) => {
      const unresolved = preset.items
        .filter((item) => item.enabled !== false)
        .map((item) => item.unit)
        .filter((unitId) => !resolvedUnits.has(unitId));
      expect(unresolved).toEqual([]);
    },
  );

  it.each([...presets.values()].map((p) => [p.id, p] as const))(
    "%s: id・name・itemsがそろっていて、ページを組める",
    (id, preset) => {
      expect(preset.version).toBe(1);
      expect(preset.id).toBe(id);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.items.length).toBeGreaterThan(0);
      expect(buildPages(preset, resolvedUnits).length).toBeGreaterThan(0);
    },
  );
});

describe("日替わり御法語版の差定", () => {
  const gohogoPresets = [...presets.values()].filter((p) =>
    p.items.some((item) => item.unit === GOHOGO_DAILY_UNIT_ID),
  );

  it("は四奉請版・三奉請版の2件ある", () => {
    expect(gohogoPresets.map((p) => p.id).sort()).toEqual([
      "nichijo-gongyo-sanbujo-gohogo",
      "nichijo-gongyo-shibujo-gohogo",
    ]);
  });

  it.each(gohogoPresets.map((p) => [p.id, p] as const))(
    "%s: 元の差定と一枚起請文の箇所だけが違う",
    (id, preset) => {
      const base = presets.get(id.replace("-gohogo", ""));
      expect(base).toBeDefined();
      expect(preset.items.length).toBe(base!.items.length);
      const differences = preset.items
        .map((item, i) => [base!.items[i].unit, item.unit] as const)
        .filter(([a, b]) => a !== b);
      expect(differences).toEqual([["ichimai-kishomon", GOHOGO_DAILY_UNIT_ID]]);
    },
  );

  it.each(gohogoPresets.map((p) => [p.id, p] as const))(
    "%s: 御法語が抜けずにページになる",
    (_id, preset) => {
      const pages = buildPages(preset, resolvedUnits, "vertical");
      const titles = new Set(pages.map((page) => page.unitTitle));
      expect([...titles].some((t) => t.startsWith("御法語（"))).toBe(true);
    },
  );

  it("御法語を解決できない場合、その項目だけが落ちて他は残る", () => {
    // データが読めない環境を想定(unitsに gohogo-daily を入れないまま組む)
    const preset = presets.get("nichijo-gongyo-sanbujo-gohogo")!;
    const pages = buildPages(preset, units);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.some((page) => page.unitTitle.startsWith("御法語"))).toBe(false);
  });
});

describe("既存の差定", () => {
  it.each(["nichijo-gongyo-sanbujo", "nichijo-gongyo-shibujo",
           "tanagyo-senzo-daidai", "tanagyo-shinbo", "junen-only"])(
    "%s: 日替わり御法語を入れていない(挙動が変わっていないこと)",
    (id) => {
      const preset = presets.get(id);
      expect(preset).toBeDefined();
      expect(preset!.items.some((item) => item.unit === GOHOGO_DAILY_UNIT_ID)).toBe(false);
    },
  );

  it("一枚起請文は従来どおり日常勤行式に残っている", () => {
    for (const id of ["nichijo-gongyo-sanbujo", "nichijo-gongyo-shibujo"]) {
      expect(presets.get(id)!.items.some((i) => i.unit === "ichimai-kishomon")).toBe(true);
    }
  });
});
