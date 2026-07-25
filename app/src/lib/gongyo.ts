export interface GongyoUnitBodyItem {
  text: string;
  ruby?: string;
  /** カウンター残数(gongyoNav.tsのcounterRemaining)ごとの読み上書き。十念9回目の「なむあみだぶつ」等、
   * 回数によって読みが変わる場合に使う(文字自体は変わらないためtextは対象外)。 */
  counterRubyOverrides?: Record<number, string>;
}

export interface GongyoUnit {
  id: string;
  title: string;
  reading: string;
  body: GongyoUnitBodyItem[];
  source?: { name: string; url?: string; license: string };
}

export interface GongyoPresetItem {
  unit: string;
  counter?: number;
  /** 省略時はtrue扱い。falseの場合buildPagesでスキップされる(編集操作のオン/オフ用) */
  enabled?: boolean;
}

export interface GongyoPreset {
  version: number;
  id: string;
  name: string;
  items: GongyoPresetItem[];
}

export interface GongyoPage {
  unitId: string;
  bodyIndex: number;
  text: string;
  ruby?: string;
  counterTotal?: number;
  counterRubyOverrides?: Record<number, string>;
}

const unitModules = import.meta.glob<GongyoUnit>("../shared/gongyo/units/*.json", {
  eager: true,
  import: "default",
});
const presetModules = import.meta.glob<GongyoPreset>("../shared/gongyo/presets/*.json", {
  eager: true,
  import: "default",
});

/** shared/gongyo/units/*.json をすべて読み込み、id -> unit のMapを返す */
export function loadGongyoUnits(): Map<string, GongyoUnit> {
  const map = new Map<string, GongyoUnit>();
  for (const unit of Object.values(unitModules)) {
    map.set(unit.id, unit);
  }
  return map;
}

/** shared/gongyo/presets/*.json をすべて読み込み、id -> preset のMapを返す */
export function loadGongyoPresets(): Map<string, GongyoPreset> {
  const map = new Map<string, GongyoPreset>();
  for (const preset of Object.values(presetModules)) {
    map.set(preset.id, preset);
  }
  return map;
}

/**
 * presetの各itemのunitを解決し、unit.bodyの各要素を1ページとして展開する。
 * bodyIndexが読書位置アンカー(docs/saijo-spec.md「unit id + bodyインデックス」)。
 * 解決できないunit参照はスキップする。
 */
export function buildPages(
  preset: GongyoPreset,
  unitsById: Map<string, GongyoUnit>,
): GongyoPage[] {
  const pages: GongyoPage[] = [];
  for (const item of preset.items) {
    if (item.enabled === false) continue;
    const unit = unitsById.get(item.unit);
    if (!unit) continue;
    unit.body.forEach((bodyItem, bodyIndex) => {
      pages.push({
        unitId: unit.id,
        bodyIndex,
        text: bodyItem.text,
        ruby: bodyItem.ruby,
        counterTotal: item.counter,
        counterRubyOverrides: bodyItem.counterRubyOverrides,
      });
    });
  }
  return pages;
}

/** counterRemaining(残数)に応じた読みの上書きがあればそれを、無ければ通常のrubyを返す */
export function resolveDisplayRuby(
  page: GongyoPage,
  counterRemaining: number | null,
): string | undefined {
  if (counterRemaining !== null) {
    const override = page.counterRubyOverrides?.[counterRemaining];
    if (override !== undefined) return override;
  }
  return page.ruby;
}
