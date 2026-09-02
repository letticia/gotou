import type { GongyoPreset, GongyoUnit } from "./gongyo";
import { GOHOGO_HEN_LABELS } from "./gohogoHen";
import type { GohogoHen } from "./gohogoHen";

/**
 * 日替わりの御法語。『元祖大師御法語』前篇31章・後篇31章から、
 * その日の「日」と同じ番号の章を選ぶ(知恩院サイト「今日のお言葉」と同じ規則)。
 *
 * 章は1〜31なので、第29〜31章はその日が存在する月にしか登場しない
 * (2月は第29章まで、小の月は第30章まで)。これは仕様として受け入れる。
 *
 * データの作り方・権利は shared/gohogo/README.md、
 * 勤行モードへの組み込みは docs/saijo-spec.md を参照。
 */

/** 差定のitemsがこのidを指していると、その日の章に置き換わる */
export const GOHOGO_DAILY_UNIT_ID = "gohogo-daily";

/** 本文の最小単位。`[表記]` はルビ無し、`[表記, 読み]` はルビ付き。
 *  語ごとの対応を残してあるので、読み物画面では本物の <ruby> を振れる。 */
export type GohogoToken = [string] | [string, string];

export interface GohogoClause {
  tokens: GohogoToken[];
}

/** 段落。読み物として読むときの切れ目(勤行側は跨いで平坦にする) */
export interface GohogoParagraph {
  clauses: GohogoClause[];
}

export interface GohogoChapter {
  chapter: number;
  title: string;
  titleReading: string;
  /** 本文に基づく自前生成の一文要約(サイト掲載文の転載ではない)。
   *  勤行画面には出さない。読み物の章一覧で章を選ぶ手がかりに使う。 */
  summary: string;
  paragraphs: GohogoParagraph[];
  source: { name: string; url: string; license: string };
}

export interface GohogoHenData {
  version: number;
  hen: GohogoHen;
  henLabel: string;
  chapters: GohogoChapter[];
}

const henModules = import.meta.glob<GohogoHenData>("../shared/gohogo/*.json", {
  eager: true,
  import: "default",
});

const henData = new Map<GohogoHen, GohogoHenData>();
for (const data of Object.values(henModules)) {
  henData.set(data.hen, data);
}

const KANJI_DIGITS = "〇一二三四五六七八九";

/** 1→「一」、30→「三十」、31→「三十一」(章番号の範囲だけを想定) */
export function chapterToKanji(n: number): string {
  if (n < 10) return KANJI_DIGITS[n] ?? String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const head = (tens === 1 ? "" : KANJI_DIGITS[tens]) + "十";
  return head + (ones ? KANJI_DIGITS[ones] : "");
}

/** その日に読む章番号。端末ローカルの「日」をそのまま章番号にする */
export function chapterNumberForDate(date: Date): number {
  return date.getDate();
}

/** 句の表記(トークンの表記を連ねたもの) */
export function clauseText(clause: GohogoClause): string {
  return clause.tokens.map((token) => token[0]).join("");
}

/** 句の読み(ルビのある語は読みに、無い語は表記のまま。結果はかなのみ) */
export function clauseRuby(clause: GohogoClause): string {
  return clause.tokens.map((token) => token[1] ?? token[0]).join("");
}

/** 段落を跨いで句を平坦に並べる(勤行はページ送りの単位が句なので段落を見ない) */
export function chapterClauses(chapter: GohogoChapter): GohogoClause[] {
  return chapter.paragraphs.flatMap((para) => para.clauses);
}

/** 勤行のunitのbodyの形に直す。トークン列から表記と読みを導出する */
export function chapterBody(chapter: GohogoChapter): { text: string; ruby: string }[] {
  return chapterClauses(chapter).map((clause) => ({
    text: clauseText(clause),
    ruby: clauseRuby(clause),
  }));
}

/** その篇の全章(章番号の順)。読み物の章一覧に使う */
export function listChapters(hen: GohogoHen): GohogoChapter[] {
  return henData.get(hen)?.chapters ?? [];
}

export const GOHOGO_CHAPTERS_PER_HEN = 31;

export function getGohogoChapter(hen: GohogoHen, chapter: number): GohogoChapter | null {
  const data = henData.get(hen);
  if (!data) return null;
  return data.chapters.find((c) => c.chapter === chapter) ?? null;
}

/** 勤行画面のラベル・式次第一覧に出す名前。例「御法語（前篇三十　一期勧化）」
 *
 * 「前篇第三十章」と書かずに詰めているのは、読誦画面のラベル行を1行に収めるため。
 * ここが2行になると本文に使える高さが減り、index.css の --gongyo-chrome の
 * 見積りが足りなくなって、ルビ付きの句(折り返せない)が画面の下端をはみ出す。 */
export function formatGohogoUnitTitle(hen: GohogoHen, chapter: GohogoChapter): string {
  return `御法語（${GOHOGO_HEN_LABELS[hen]}${chapterToKanji(chapter.chapter)}　${chapter.title}）`;
}

/** 扉に出す一行。例「本日の御法語: 前篇第三十章 一期勧化」 */
export function formatGohogoIntroLabel(hen: GohogoHen, chapter: GohogoChapter): string {
  return `本日の御法語: ${GOHOGO_HEN_LABELS[hen]}第${chapterToKanji(chapter.chapter)}章 ${chapter.title}`;
}

/**
 * その日の御法語を、勤行のテキスト単位(unit)として返す。
 *
 * unitのスキーマは広げない。既存のunitと同じ形の値を組み立てて返すだけなので、
 * buildPages以降(縦書きの2句連結・長句分割・ページ分け)は通常のunitと同じ扱いになる。
 * paginatedにするのは、1章が数十句あり1画面にまとめると字が小さくなりすぎるため。
 * 表記と読みはトークン列から導出する(データは語ごとの対応を保っている)。
 */
export function getDailyGohogo(date: Date, hen: GohogoHen): GongyoUnit | null {
  const chapter = getGohogoChapter(hen, chapterNumberForDate(date));
  if (!chapter) return null;
  return {
    id: `gohogo-${hen}-${chapter.chapter}`,
    title: formatGohogoUnitTitle(hen, chapter),
    reading: chapter.titleReading,
    paginated: true,
    body: chapterBody(chapter),
    source: chapter.source,
  };
}

/** その差定が日替わり御法語を含むか(扉に当日の章名を出すかの判断に使う) */
export function presetUsesDailyGohogo(preset: GongyoPreset): boolean {
  return preset.items.some(
    (item) => item.unit === GOHOGO_DAILY_UNIT_ID && item.enabled !== false,
  );
}

/**
 * 差定を組み立てる前に、gohogo-daily をその日の章に解決した units を返す。
 *
 * buildPages には手を入れない。buildPages は `unitsById.get(item.unit)` で
 * unitを引くだけなので、引かれる側の表に当日の章を入れておけば足りる
 * (解決できないunit参照は元から読み飛ばされる)。
 */
export function withDailyGohogo(
  unitsById: Map<string, GongyoUnit>,
  date: Date,
  hen: GohogoHen,
): Map<string, GongyoUnit> {
  const daily = getDailyGohogo(date, hen);
  if (!daily) return unitsById;
  const next = new Map(unitsById);
  next.set(GOHOGO_DAILY_UNIT_ID, daily);
  return next;
}
