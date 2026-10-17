import type { GohogoToken } from "./gohogo";
import { normalizeSearchInput } from "./variants";

/**
 * 語釈リンク。御法語の本文の語を、辞書(浄土宗大辞典)の見出しと照らし合わせて
 * リンクにする。
 *
 * 辞書は利用者の端末がダウンロードするデータなので、どの語が辞書にあるかは
 * リポジトリに持てない(掟1)。照合は端末の中で、開いた辞書の見出しに対して行う。
 *
 * 規則(開発者=僧侶の判断、2026-10):
 * - 2字以上の見出しだけを使う(「仏」「法」のような1字の見出しまで拾うと
 *   本文がリンクだらけになる)。
 * - 本文を頭から見て、そこから始まる**いちばん長い見出し**を採る(最長一致)。
 *   「南無阿弥陀仏」は一語として扱い、「阿弥陀」「仏」に分けない。
 * - 照合は**トークンの切れ目**でだけ行う。ルビ付きの語は語ごとにトークンに
 *   なっているので、語の途中から始まる・途中で終わる一致は採らない
 *   (ルビを割ることになり、表記と読みの対応が崩れるため)。
 * - かなだけの一致は採らない(「ただ」「この」のような語を拾わないため)。
 * - 異体字・旧字体は検索と同じ正規化(variants.json)を両側に通してから比べる。
 */

/** 見出しの最低字数 */
export const MIN_GLOSS_LENGTH = 2;

/** 一致を探すときに先まで見るトークンの数の上限(語はふつう数トークンに収まる) */
const MAX_TOKENS_PER_MATCH = 8;

export interface GlossEntry {
  id: number;
  title: string;
  reading: string;
}

export interface HeadwordIndex {
  byKey: Map<string, GlossEntry>;
  maxLength: number;
}

export interface GlossSpan {
  /** 一致したトークンの範囲 [start, end) */
  start: number;
  end: number;
  entry: GlossEntry;
}

const KANJI = /[㐀-鿿豈-﫿]/;

export function buildHeadwordIndex(rows: GlossEntry[]): HeadwordIndex {
  const byKey = new Map<string, GlossEntry>();
  let maxLength = 0;
  for (const row of rows) {
    const key = normalizeSearchInput(row.title);
    if (key.length < MIN_GLOSS_LENGTH || !KANJI.test(key)) continue;
    // 同じ表記の見出しが複数あれば先のものを使う(どれに飛んでも同じ表記なので)
    if (!byKey.has(key)) byKey.set(key, row);
    maxLength = Math.max(maxLength, key.length);
  }
  return { byKey, maxLength };
}

/** トークン列から語釈リンクにする範囲を、重ならないように左から順に探す */
export function findGlossSpans(tokens: GohogoToken[], index: HeadwordIndex): GlossSpan[] {
  if (index.byKey.size === 0) return [];
  const keys = tokens.map((token) => normalizeSearchInput(token[0]));
  const spans: GlossSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    let best: GlossSpan | null = null;
    let candidate = "";
    for (let j = i; j < Math.min(tokens.length, i + MAX_TOKENS_PER_MATCH); j++) {
      candidate += keys[j];
      if (candidate.length > index.maxLength) break;
      const entry = index.byKey.get(candidate);
      if (entry) best = { start: i, end: j + 1, entry };
    }
    if (best) {
      spans.push(best);
      i = best.end;
    } else {
      i += 1;
    }
  }
  return spans;
}
