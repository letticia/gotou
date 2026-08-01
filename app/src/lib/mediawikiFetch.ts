// factory/src/fetch_articles.py のTypeScript移植。
// 浄土宗大辞典 (MediaWiki) からページ一覧・本文をブラウザから直接取得する。
// MediaWiki標準の`origin=*`パラメータでCORSを有効化している(実機ブラウザで検証済み)。
// ブラウザのfetch()はUser-Agentヘッダを上書きできない(禁止ヘッダ)ため、
// factory版のような独自UA名乗りはできない。

import type { RawArticle } from "./wikitextConvert";

export const DEFAULT_MEDIAWIKI_API_URL = "https://jodoshuzensho.jp/daijiten/api.php";
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 150;

export interface PageRef {
  pageid: string;
  title: string;
}

interface AllPagesResponse {
  query?: { allpages?: { pageid: number; title: string }[] };
  continue?: { apcontinue?: string };
}

interface RevisionsResponse {
  query?: {
    pages?: Record<
      string,
      { title?: string; revisions?: { "*": string }[] }
    >;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 標準名前空間 (ns=0) の全ページタイトルとPage IDを取得する */
export async function fetchAllPageTitles(
  onProgress?: (fetchedCount: number) => void,
  apiUrl: string = DEFAULT_MEDIAWIKI_API_URL,
): Promise<PageRef[]> {
  const pages: PageRef[] = [];
  let apcontinue: string | undefined;

  for (;;) {
    const params = new URLSearchParams({
      action: "query",
      list: "allpages",
      apnamespace: "0",
      aplimit: "max",
      format: "json",
      origin: "*",
    });
    if (apcontinue) params.set("apcontinue", apcontinue);

    const res = await fetch(`${apiUrl}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`ページ一覧の取得に失敗しました (status=${res.status})`);
    }
    const data = (await res.json()) as AllPagesResponse;

    const fetched = (data.query?.allpages ?? []).map((p) => ({
      pageid: String(p.pageid),
      title: p.title,
    }));
    pages.push(...fetched);
    onProgress?.(pages.length);

    const next = data.continue?.apcontinue;
    if (!next) break;
    apcontinue = next;
  }

  return pages;
}

/** pageids(最大50件)に対応する記事のwikitextをバッチ取得する */
export async function fetchArticleBatch(
  pageids: string[],
  apiUrl: string = DEFAULT_MEDIAWIKI_API_URL,
): Promise<RawArticle[]> {
  const params = new URLSearchParams({
    action: "query",
    pageids: pageids.join("|"),
    prop: "revisions",
    rvprop: "content",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${apiUrl}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`記事本文の取得に失敗しました (status=${res.status})`);
  }
  const data = (await res.json()) as RevisionsResponse;

  const pagesObj = data.query?.pages ?? {};
  const articles: RawArticle[] = [];
  for (const [pid, pdata] of Object.entries(pagesObj)) {
    const title = pdata.title ?? "";
    const wikitext = pdata.revisions?.[0]?.["*"] ?? "";
    articles.push({ pageid: pid, title, wikitext });
  }
  return articles;
}

/** itemsをbatchSizeずつの配列に分割する(純粋関数) */
export function makeBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 全ページの本文をバッチ取得する。バッチ間に短い待機を挟み、1台のスマホからの
 * 単発取得として節度を保つ(factoryの1リクエスト/秒スロットルに準じた配慮)。
 */
export async function fetchAllArticles(
  pages: PageRef[],
  onProgress?: (fetchedCount: number, total: number) => void,
  apiUrl: string = DEFAULT_MEDIAWIKI_API_URL,
  batchDelayMs: number = BATCH_DELAY_MS,
): Promise<RawArticle[]> {
  const batches = makeBatches(
    pages.map((p) => p.pageid),
    BATCH_SIZE,
  );
  const articles: RawArticle[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = await fetchArticleBatch(batches[i], apiUrl);
    articles.push(...batch);
    onProgress?.(articles.length, pages.length);

    if (i < batches.length - 1 && batchDelayMs > 0) {
      await sleep(batchDelayMs);
    }
  }

  return articles;
}
