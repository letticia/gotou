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
  /** 省略時false。trueの場合、bodyを1画面にまとめず3行ずつバッチでページ送りする
   * (誦経・一枚起請文等の長文向け。次ページ冒頭に前ページ最終行を薄くエコー表示する) */
  paginated?: boolean;
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

export interface GongyoPageLine {
  text: string;
  ruby?: string;
  /** paginated unitの2ページ目以降、直前ページ最終行のエコー表示であることを示す */
  dimmed?: boolean;
}

export interface GongyoPage {
  unitId: string;
  /** 常時ラベル表示用 */
  unitTitle: string;
  lines: GongyoPageLine[];
  /** paginated unit由来のページかどうか。trueの場合、表示側はlineSizeTierによる
   * 縮小をせず常に標準サイズで表示する(バッチ行数を読みやすく保つための固定サイズ) */
  paginated?: boolean;
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

/** paginated unitで1タップあたりに進む新規行数(開発者確認済み) */
const PAGINATED_BATCH_SIZE = 3;

/**
 * presetの各itemのunitを解決し、1画面分の表示単位(ページ)の配列にする。
 * 通常のunitはbody全体を1ページにまとめる(グループ表示)。
 * paginated unitはPAGINATED_BATCH_SIZE行ずつページを分け、2ページ目以降の冒頭に
 * 直前ページ最終行を薄いエコーとして加える。解決できないunit参照はスキップする。
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

    if (unit.paginated) {
      for (let i = 0; i < unit.body.length; i += PAGINATED_BATCH_SIZE) {
        const lines: GongyoPageLine[] = [];
        if (i > 0) {
          const prev = unit.body[i - 1];
          lines.push({ text: prev.text, ruby: prev.ruby, dimmed: true });
        }
        for (const b of unit.body.slice(i, i + PAGINATED_BATCH_SIZE)) {
          lines.push({ text: b.text, ruby: b.ruby });
        }
        pages.push({
          unitId: unit.id,
          unitTitle: unit.title,
          lines,
          paginated: true,
          counterTotal: item.counter,
        });
      }
    } else {
      pages.push({
        unitId: unit.id,
        unitTitle: unit.title,
        lines: unit.body.map((b) => ({ text: b.text, ruby: b.ruby })),
        counterTotal: item.counter,
        counterRubyOverrides:
          unit.body.length === 1 ? unit.body[0].counterRubyOverrides : undefined,
      });
    }
  }
  return pages;
}

/** counterRemaining(残数)に応じた読みの上書きがあればそれを、無ければ最初の行の通常のrubyを返す。
 * counter付きページは常に1行のみのため、最初の行にのみ適用すればよい。 */
export function resolveDisplayRuby(
  page: GongyoPage,
  counterRemaining: number | null,
): string | undefined {
  if (counterRemaining !== null) {
    const override = page.counterRubyOverrides?.[counterRemaining];
    if (override !== undefined) return override;
  }
  return page.lines[0]?.ruby;
}

/** グループ表示時、行数に応じた文字サイズの段階(1が最大)を返す */
export function lineSizeTier(lineCount: number): 1 | 2 | 3 | 4 {
  if (lineCount <= 2) return 1;
  if (lineCount <= 4) return 2;
  if (lineCount <= 6) return 3;
  return 4;
}
