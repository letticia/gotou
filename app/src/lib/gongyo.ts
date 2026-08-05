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
  /** 縦書き時の列数・1列の字数(同じitemIndexの全ページで統一済み)。
   * horizontalでは未設定。unifyVerticalSizing参照 */
  verticalColumns?: number;
  verticalMaxChars?: number;
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
 * 一枚起請文・陀羅尼のように1句が長いunitは従来通り少なめの行数にする。
 * 横書きは分割(verticalBodyのような句読点での分割)を行わないため、一枚起請文の
 * 114字のような極端に長い句は3句まとめると画面の高さを超えてしまう。そのため
 * 60字を超える句を持つunitは1句ずつに減らし、文字サイズの段階(paginatedSizeTier)
 * だけでなく行数そのものを絞ることで画面に収める。 */
export function paginatedBatchSize(unit: GongyoUnit): number {
  const maxLength = unit.body.reduce((max, b) => Math.max(max, b.text.length), 0);
  if (maxLength <= 10) return 6;
  if (maxLength <= 20) return 4;
  if (maxLength <= 60) return 3;
  return 1;
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

    // 縦書きは短い句をまとめ、長すぎる句を分ける(unitのJSONは変えずここで組み替える)
    const body = orientation === "vertical" ? verticalBody(unit.body) : unit.body;

    if (unit.paginated) {
      const batchSize = batchSizeFor({ ...unit, body }, orientation);
      for (let i = 0; i < body.length; i += batchSize) {
        const lines: GongyoPageLine[] = [];
        // バッチが1行のとき(一枚起請文のように1句が非常に長いunit)はエコーを出さない。
        // 1ページ=1句なのでエコーは句をまるごと二重に表示することになり、
        // 続きを示す役には立たないうえ表示領域を倍消費してしまう。
        if (i > 0 && batchSize > 1) {
          const prev = body[i - 1];
          lines.push({ text: prev.text, ruby: prev.ruby, dimmed: true });
        }
        for (const b of body.slice(i, i + batchSize)) {
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
        lines: body.map((b) => ({ text: b.text, ruby: b.ruby })),
        counterTotal: item.counter,
        counterRubyOverrides: body.length === 1 ? body[0].counterRubyOverrides : undefined,
      });
    }
  }
  if (orientation === "vertical") unifyVerticalSizing(pages);
  return pages;
}

/** 同じ差定項目(itemIndex)に属する全ページの縦書き字送りを、その中の最大値に統一する。
 * ページごとに最適化すると、句の長さの差でページ送りのたびに字が大きくなったり
 * 小さくなったりしてしまうため(阿弥陀如来根本陀羅尼・一枚起請文で顕著)、
 * そのunit(1回の読誦)を通して固定した字送りにする。 */
function unifyVerticalSizing(pages: GongyoPage[]): void {
  const maxByItem = new Map<number, { columns: number; maxChars: number }>();
  for (const page of pages) {
    const current = maxByItem.get(page.itemIndex) ?? { columns: 1, maxChars: 1 };
    maxByItem.set(page.itemIndex, {
      columns: Math.max(current.columns, verticalColumnCount(page.lines)),
      maxChars: Math.max(current.maxChars, verticalMaxLineLength(page.lines)),
    });
  }
  for (const page of pages) {
    const agg = maxByItem.get(page.itemIndex)!;
    page.verticalColumns = agg.columns;
    page.verticalMaxChars = agg.maxChars;
  }
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

/** 縦書きで1列に入る字数の目安。これを超える句は複数列に折り返す前提で列数を数える。
 * 小さすぎる値にすると、実際には折り返さない句まで複数列と数えてしまい、
 * そのぶん1列の幅を狭く見積もって字が不必要に小さくなる(四奉請の16字等)。
 * 読みやすい字送りのとき1列に入る字数の実測(320〜375px幅で16〜19字)から20字とする。 */
const VERTICAL_CHARS_PER_COLUMN = 20;

/** 1句が何列まで折り返してよいか。これを超える長さの句はページを分ける。
 * 列が増えるほど1列の幅が狭くなり字も小さくなるため、読める大きさを保つ上限。 */
const VERTICAL_MAX_COLUMNS_PER_LINE = 3;

/** 縦書きで1ページに載せる1句あたりの最大字数 */
export const VERTICAL_MAX_CHARS_PER_LINE =
  VERTICAL_CHARS_PER_COLUMN * VERTICAL_MAX_COLUMNS_PER_LINE;

/** 2句を1列にまとめる対象とする字数の上限。5字前後の句を1句ずつ列にすると
 * 縦書きでは列の下半分以上が空いてしまうため(四誓偈・摂益文等)。 */
const VERTICAL_PAIR_MAX_LENGTH = 8;

/** 行が高さ方向に必要とする字数(ルビが本文より長い場合はルビ換算で評価する) */
function effectiveLineLength(line: GongyoPageLine): number {
  return Math.max(line.text.length, (line.ruby?.length ?? 0) * RUBY_TO_TEXT_RATIO);
}

/** その行が折り返しで占める列数 */
function columnsForLine(line: GongyoPageLine): number {
  return Math.max(1, Math.ceil(effectiveLineLength(line) / VERTICAL_CHARS_PER_COLUMN));
}

/** ページ全体が占める列数(長い句が複数列に折り返すぶんも数える)。
 * CSSはこの列数で1列あたりの幅を決めるため、折り返しを見込まないと字が大きくなりすぎる。 */
export function verticalColumnCount(lines: GongyoPageLine[]): number {
  return Math.max(
    1,
    lines.reduce((sum, line) => sum + columnsForLine(line), 0),
  );
}

/** 1列に入る字数の最大値を返す(長い句は折り返す列数で割った値になる)。
 * エコー行(dimmed)は専用の小さいサイズで描かれるため対象外。
 * 0除算を避けるため最小値は1。 */
export function verticalMaxLineLength(lines: GongyoPageLine[]): number {
  const visible = lines.filter((line) => !line.dimmed);
  return visible.reduce((max, line) => {
    const perColumn = effectiveLineLength(line) / columnsForLine(line);
    return Math.max(max, Math.ceil(perColumn));
  }, 1);
}

/** 縦書き向けにbodyを組み替える:
 * 1. 短い句(VERTICAL_PAIR_MAX_LENGTH以下)ばかりのunitは2句ずつ全角スペースでつないで1列に収める
 * 2. 長すぎる句は複数ページに分ける(句読点で切る)
 * unitのJSONは書き換えず、表示時にここで組み替える。 */
export function verticalBody(body: GongyoUnitBodyItem[]): GongyoUnitBodyItem[] {
  return splitLongBodyItems(pairShortBodyItems(body));
}

/** すべての句が短いunitに限り、2句ずつ全角スペースでつないで1句にまとめる。
 * 縦書きは1列に十数文字入るため、5字の句を1句ずつ列にすると列の大半が空き、
 * そのぶん列数が増えて字も小さくなってしまう(四誓偈・摂益文等)。 */
export function pairShortBodyItems(body: GongyoUnitBodyItem[]): GongyoUnitBodyItem[] {
  if (body.length < 2) return body;
  if (!body.every((item) => item.text.length <= VERTICAL_PAIR_MAX_LENGTH)) return body;
  // 回数表示付きの句(十念等)は読みの上書きを持つため、まとめると対応が崩れる
  if (body.some((item) => item.counterRubyOverrides)) return body;

  const paired: GongyoUnitBodyItem[] = [];
  for (let i = 0; i < body.length; i += 2) {
    const first = body[i];
    const second = body[i + 1];
    if (!second) {
      paired.push(first);
      continue;
    }
    paired.push({
      text: `${first.text}　${second.text}`,
      ruby:
        first.ruby || second.ruby ? `${first.ruby ?? ""}　${second.ruby ?? ""}` : undefined,
    });
  }
  return paired;
}

/** 長すぎる句を複数の句に分ける(それぞれが別ページになる)。
 * 1ページに全部載せようとすると字が極端に小さくなるため。
 * 句読点の直後で切って、読み上げの区切りが不自然にならないようにする。
 * ルビ付きの句は本文とルビの対応が崩れるため分割しない。 */
export function splitLongBodyItems(body: GongyoUnitBodyItem[]): GongyoUnitBodyItem[] {
  const out: GongyoUnitBodyItem[] = [];
  for (const item of body) {
    if (item.text.length <= VERTICAL_MAX_CHARS_PER_LINE || item.ruby) {
      out.push(item);
      continue;
    }
    for (const chunk of splitAtPunctuation(item.text, VERTICAL_MAX_CHARS_PER_LINE)) {
      out.push({ text: chunk });
    }
  }
  return out;
}

/** textをmaxLen以下の断片に分ける。maxLen以内の最後の句読点の直後で切り、
 * 句読点が前半に寄りすぎている(=断片が極端に短くなる)場合はmaxLenで機械的に切る。 */
export function splitAtPunctuation(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    const window = rest.slice(0, maxLen);
    const punctuation = Math.max(window.lastIndexOf("。"), window.lastIndexOf("、"));
    const cut = punctuation >= Math.floor(maxLen / 2) ? punctuation + 1 : maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
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
