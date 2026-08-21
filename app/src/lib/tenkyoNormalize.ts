// 逆引き典拠検索の入力正規化(docs/tenkyo-spec.md B-1)。
//
// 重要: ローカル検索(辞書本文・勤行テキスト)では**句読点を除去しない**。
// 本文側には句読点が残っているため、除去した検索語はどこにも一致しなくなる
// (実キャッシュ9,197件での実測で再現率1%まで落ちた)。代わりに句読点で
// 分割し、句ごとに部分一致を取る(同条件で再現率100%)。
// 句読点の除去は浄全DBへのリンクアウト検索(buildJozenKeyword)専用。

/** 句の区切りとして扱う文字。ここで分割した各句が照合の単位になる */
const CLAUSE_SEPARATORS = /[、。，．,.！？!?\n\r・…‥「」『』（）()【】〔〕〈〉《》\s　]+/;

/** 短すぎる句は誤ヒットが多いので捨てる(「また」「この」等) */
const MIN_CLAUSE_LENGTH = 4;

/** 問い合わせ回数を抑えるための上限。長い句ほど特徴的なので長い順に採る */
const MAX_CLAUSES = 5;

/** 浄全DBのAND検索は前後2行が範囲。長すぎる語は当たらないので丸める */
const JOZEN_KEYWORD_MAX = 20;

/**
 * 一節を句読点・括弧で分割し、照合に使える句の配列にする。
 * 長い順に並べ、最大5件まで返す(重複は除く)。
 */
export function extractClauses(input: string): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  for (const part of input.split(CLAUSE_SEPARATORS)) {
    const clause = part.trim();
    if (clause.length >= MIN_CLAUSE_LENGTH) seen.add(clause);
  }
  return [...seen].sort((a, b) => b.length - a.length).slice(0, MAX_CLAUSES);
}

/**
 * 浄全DBへ渡す検索語を組み立てる。句読点・括弧・空白を除去して20字に丸める。
 * 20字を超える入力は「前半 後半」の2語AND形式にする(スペース区切りでAND検索になり、
 * 長い一節をそのまま投げるより当たりやすい)。
 */
export function buildJozenKeyword(input: string): string {
  const compact = input.split(CLAUSE_SEPARATORS).join("");
  if (compact.length <= JOZEN_KEYWORD_MAX) return compact;

  // 前半・後半それぞれを10字ずつ採り、AND検索の2語にする
  const half = Math.floor(JOZEN_KEYWORD_MAX / 2);
  return `${compact.slice(0, half)} ${compact.slice(half, JOZEN_KEYWORD_MAX)}`;
}
