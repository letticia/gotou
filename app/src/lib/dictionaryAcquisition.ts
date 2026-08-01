// アプリ自身が浄土宗大辞典に直接アクセスし、変換までを完結させるオーケストレーション層。
// mediawikiFetch(取得) → wikitextConvert(変換、buildDictionaryDb内で使用) →
// buildDictionaryDb(SQLite構築)の順に呼び出す。

import { buildDictionaryDb } from "./buildDictionaryDb";
import { fetchAllArticles, fetchAllPageTitles } from "./mediawikiFetch";

export type AcquisitionProgress =
  | { phase: "listing"; current: number }
  | { phase: "fetching"; current: number; total: number }
  | { phase: "building" };

/**
 * 浄土宗大辞典から全ページを取得し、アプリ内で変換してSQLiteのバイト列を返す。
 * 進捗はフェーズ(listing→fetching→building)をまたいでonProgressに通知する。
 */
export async function acquireDictionaryFromSource(
  onProgress?: (progress: AcquisitionProgress) => void,
): Promise<Uint8Array> {
  const pages = await fetchAllPageTitles((current) => {
    onProgress?.({ phase: "listing", current });
  });

  const articles = await fetchAllArticles(pages, (current, total) => {
    onProgress?.({ phase: "fetching", current, total });
  });

  onProgress?.({ phase: "building" });
  const { bytes } = await buildDictionaryDb(articles);

  return bytes;
}

/** AcquisitionProgressを進捗表示用の日本語文字列にする(純粋関数、テスト対象) */
export function acquisitionProgressText(progress: AcquisitionProgress): string {
  switch (progress.phase) {
    case "listing":
      return `記事一覧を取得中…(${progress.current}件)`;
    case "fetching":
      return `記事本文を取得中…(${progress.current}/${progress.total}件)`;
    case "building":
      return "変換・索引作成中…";
  }
}
