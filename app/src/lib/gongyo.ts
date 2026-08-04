import type { GongyoOrientation } from "./gongyoOrientation";

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
  /** 省略時false。trueの場合、bodyを1画面にまとめずバッチでページ送りする
   * (誦経・一枚起請文等の長文向け。次ページ冒頭に前ページ最終行を薄くエコー表示する。
   * 1タップで進む行数はpaginatedBatchSize()が1句あたりの文字数から自動で決める) */
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
  /** このページの元になったpreset.items内の位置。同じunitが差定に複数回現れる
   * (日常勤行式の十念は4回)ため、unitIdだけでは読誦位置を一意に特定できない。
   * 縦横の切り替えでページ分割が変わったときの復帰先の特定に使う。 */
  itemIndex: number;
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

/** paginated unitの1行あたりの文字数に応じて、1タップで進む新規行数を決める。
 * 誦経(四誓偈・第九真身観文)のように1句が短いunitは高速に読誦するため多めの行数を、
 * 一枚起請文・陀羅尼のように1句が長いunitは従来通り少なめの行数にする。 */
export function paginatedBatchSize(unit: GongyoUnit): number {
  const maxLength = unit.body.reduce((max, b) => Math.max(max, b.text.length), 0);
  if (maxLength <= 10) return 6;
  if (maxLength <= 20) return 4;
  return 3;
}

/** 縦書きのバッチ行数。縦書きは1行が1列を占め、列の幅(=画面の横幅)が厳しい制約になる。
 * さらにエコー行も1列消費するため、横書き(paginatedBatchSize)より少なめにする。 */
export function verticalPaginatedBatchSize(unit: GongyoUnit): number {
  const maxLength = unit.body.reduce((max, b) => Math.max(max, b.text.length), 0);
  if (maxLength <= 10) return 3;
  if (maxLength <= 20) return 2;
  return 1;
}

/** 向きに応じたバッチ行数を返す */
export function batchSizeFor(unit: GongyoUnit, orientation: GongyoOrientation): number {
  return orientation === "vertical" ? verticalPaginatedBatchSize(unit) : paginatedBatchSize(unit);
}

/**
 * presetの各itemのunitを解決し、1画面分の表示単位(ページ)の配列にする。
 * 通常のunitはbody全体を1ページにまとめる(グループ表示)。
 * paginated unitはpaginatedBatchSize()行ずつページを分け、2ページ目以降の冒頭に
 * 直前ページ最終行を薄いエコーとして加える。解決できないunit参照はスキップする。
 */
export function buildPages(
  preset: GongyoPreset,
  unitsById: Map<string, GongyoUnit>,
  orientation: GongyoOrientation = "horizontal",
): GongyoPage[] {
  const pages: GongyoPage[] = [];
  for (const [itemIndex, item] of preset.items.entries()) {
    if (item.enabled === false) continue;
    const unit = unitsById.get(item.unit);
    if (!unit) continue;

    if (unit.paginated) {
      const batchSize = batchSizeFor(unit, orientation);
      for (let i = 0; i < unit.body.length; i += batchSize) {
        const lines: GongyoPageLine[] = [];
        // バッチが1行のとき(一枚起請文のように1句が非常に長いunit)はエコーを出さない。
        // 1ページ=1句なのでエコーは句をまるごと二重に表示することになり、
        // 続きを示す役には立たないうえ表示領域を倍消費してしまう。
        if (i > 0 && batchSize > 1) {
          const prev = unit.body[i - 1];
          lines.push({ text: prev.text, ruby: prev.ruby, dimmed: true });
        }
        for (const b of unit.body.slice(i, i + batchSize)) {
          lines.push({ text: b.text, ruby: b.ruby });
        }
        pages.push({
          unitId: unit.id,
          itemIndex,
          unitTitle: unit.title,
          lines,
          paginated: true,
          counterTotal: item.counter,
        });
      }
    } else {
      pages.push({
        unitId: unit.id,
        itemIndex,
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

/** paginated表示時、行の文字数と行数に応じた文字サイズの段階(1が最大)を返す。
 * 陀羅尼(ひらがな表記で1行が長くなりがち)や一枚起請文の長文でも画面に収まるようにする。
 * paginatedBatchSize()により行数が多くなるunit(誦経等)は、行が短くても
 * 少し縮小して画面に収まる余裕を持たせる。エコー表示(dimmed)行は別途固定の
 * 小さいスタイルで表示するため対象外にする。 */
export function paginatedSizeTier(lines: GongyoPageLine[]): 1 | 2 | 3 | 4 {
  const visible = lines.filter((line) => !line.dimmed);
  const maxLength = visible.reduce((max, line) => Math.max(max, line.text.length), 0);
  let tier: 1 | 2 | 3 | 4 = 1;
  if (maxLength > 28) tier = 4;
  else if (maxLength > 18) tier = 3;
  else if (maxLength > 10) tier = 2;
  if (visible.length > 4 && tier < 2) tier = 2;
  return tier;
}

// --- 縦書きの字送り ---
// 縦書きは横書きと制約が逆転する: 1行が1列を占めるため「行数」が画面の横幅を、
// 「1行の長さ」が画面の高さを圧迫する。
// 横書きのように字数から段階(tier)を決め打ちすると、375px幅に合わせた閾値が
// 360px幅の端末でははみ出す、という具合に端末ごとに破綻する。そこで縦書きでは
// 「列数」と「1列に必要な字数」だけをCSSカスタムプロパティとして渡し、
// 実際の字送りはCSS側のmin()が画面の実寸から決める(index.cssの.gongyo-vertical参照)。

/** ルビは本文のおよそ0.4倍の字送りで、縦書きでは本文と同じ高さ方向を占める。
 * 本文が短くルビが極端に長い行(摂益文・破地獄偈等)で必要な高さを見誤らないための係数。 */
const RUBY_TO_TEXT_RATIO = 0.4;

/** 1列に必要な字数(=高さ方向の必要量)の最大値を返す。
 * ルビは本文の約0.4倍の字送りなので、本文字数とルビ字数×0.4の大きい方で評価する。
 * エコー行(dimmed)は専用の小さいサイズで描かれるため対象外。
 * 0除算を避けるため最小値は1。 */
export function verticalMaxLineLength(lines: GongyoPageLine[]): number {
  const visible = lines.filter((line) => !line.dimmed);
  return visible.reduce((max, line) => {
    const effective = Math.max(line.text.length, (line.ruby?.length ?? 0) * RUBY_TO_TEXT_RATIO);
    return Math.max(max, effective);
  }, 1);
}

/** 差定内の指定位置(preset.itemsのindex)に対応する最初のページ番号を返す(無ければ0)。
 * 縦書き⇔横書きの切り替えでページ分割が変わっても、読誦中の偈文の先頭に留まるために使う。
 * unitIdではなくitemIndexで引くのは、同じunitが差定に複数回現れる場合
 * (日常勤行式の十念は4回)に最初の1回へ戻ってしまうのを避けるため。 */
export function firstPageIndexOfItem(pages: GongyoPage[], itemIndex: number): number {
  const index = pages.findIndex((page) => page.itemIndex === itemIndex);
  return index < 0 ? 0 : index;
}

/** 横書きのページ種別に応じた文字サイズの段階を返す。
 * 縦書きは段階ではなくCSS側のmin()で字送りを決めるため、この関数は使わない。 */
export function sizeTierFor(page: GongyoPage): 1 | 2 | 3 | 4 {
  return page.paginated ? paginatedSizeTier(page.lines) : lineSizeTier(page.lines.length);
}
