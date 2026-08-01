// factory/src/build_sqlite.py の generate_database() のTypeScript移植。
// @sqlite.org/sqlite-wasm でインメモリDBを構築し、sqlite3_js_db_export で
// Uint8Arrayへシリアライズする(既存のdictionaryStorage.tsのCache API保存に乗せる)。

import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import schemaSql from "../shared/schema.sql?raw";
import { normalizeSearchInput } from "./variants";
import { buildTitleIdMap, cleanWikitext, extractYomiAndCleanHeadword } from "./wikitextConvert";
import type { RawArticle } from "./wikitextConvert";

// build_sqlite.pyのYOMI_LINE_RE(先頭行が信頼できる読みソースかどうかの判定)と同一
const YOMI_LINE_RE = /^=([^／/=]+)[／/]([^=]+)=$/;

/** 先頭行が `=よみ／見出し=` パターンを持つか(読みの取得元として信頼できるか) */
function hasYomiLine(wikitext: string): boolean {
  if (!wikitext || !wikitext.trim()) return false;
  const firstLine = wikitext.trim().split("\n")[0].trim();
  return YOMI_LINE_RE.test(firstLine);
}

// 自前のescapeHtml/quoteAttr(wikitextConvert.ts)が生成しうる範囲のみカバーすれば十分
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function unescapeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent: string) => {
    if (ent[0] === "#") {
      const isHex = ent[1] === "x" || ent[1] === "X";
      const codePoint = isHex ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[ent] ?? match;
  });
}

/** body_htmlからタグを除去し、entries_fts (body_text) 用のプレーンテキストを作る */
export function htmlToText(htmlFragment: string): string {
  if (!htmlFragment) return "";
  let text = htmlFragment.replace(/<[^>]+>/g, " ");
  text = unescapeHtmlEntities(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

interface ExecutableDb {
  exec(sql: string): unknown;
}

/** ;区切りの複数CREATE文を1つずつ実行する(sqlite3_exec相当の一括実行に頼らない) */
function execScript(db: ExecutableDb, sql: string): void {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    db.exec(stmt);
  }
}

export interface BuildStats {
  entriesCount: number;
  missingReadingCount: number;
  linksCount: number;
  brokenLinksCount: number;
}

export interface BuildResult {
  bytes: Uint8Array;
  stats: BuildStats;
}

/**
 * 記事配列(RawArticle[])から shared/schema.sql 準拠のSQLiteをブラウザ内(wasm-sqlite)で構築し、
 * バイト列にシリアライズして返す。factory/src/build_sqlite.pyのgenerate_databaseの移植。
 */
export async function buildDictionaryDb(articles: RawArticle[]): Promise<BuildResult> {
  const titleToIdMap = buildTitleIdMap(articles);

  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");

  try {
    execScript(db, schemaSql);

    let entriesCount = 0;
    let missingReadingCount = 0;
    let brokenLinksCount = 0;
    const allLinks = new Set<string>(); // "from,to" 文字列で重複排除(Pythonのsorted(set)相当)

    for (const art of articles) {
      const pageid = art.pageid ?? "";
      const title = (art.title ?? "").trim();
      const wikitext = art.wikitext ?? "";
      if (!title || !pageid) continue;

      const entryId = Number(pageid);
      const { headword, yomi } = extractYomiAndCleanHeadword(title, wikitext);

      let reading: string | null;
      if (hasYomiLine(wikitext)) {
        reading = yomi;
      } else {
        reading = null;
        missingReadingCount++;
      }

      const searchKey = normalizeSearchInput(headword);

      const foundLinkTargets: number[] = [];
      let foundBrokenCount = 0;

      const bodyHtml = cleanWikitext(wikitext, titleToIdMap, {
        linkSink: (targetEntryId) => {
          const m = targetEntryId.match(/^entry_(\d+)$/);
          if (m) foundLinkTargets.push(Number(m[1]));
        },
        brokenLinkSink: () => {
          foundBrokenCount++;
        },
      });
      const bodyText = htmlToText(bodyHtml);

      db.exec({
        sql: "INSERT INTO entries (id, title, reading, search_key, body_html) VALUES (?, ?, ?, ?, ?)",
        bind: [entryId, headword, reading, searchKey, bodyHtml],
      });
      db.exec({
        sql: "INSERT INTO entries_fts (rowid, title, body_text) VALUES (?, ?, ?)",
        bind: [entryId, headword, bodyText],
      });

      for (const targetId of foundLinkTargets) {
        allLinks.add(`${entryId},${targetId}`);
      }
      brokenLinksCount += foundBrokenCount;

      entriesCount++;
    }

    for (const pair of allLinks) {
      const [fromId, toId] = pair.split(",").map(Number);
      db.exec({
        sql: "INSERT INTO links (from_id, to_id) VALUES (?, ?)",
        bind: [fromId, toId],
      });
    }

    const bytes = sqlite3.capi.sqlite3_js_db_export(db);

    return {
      bytes,
      stats: {
        entriesCount,
        missingReadingCount,
        linksCount: allLinks.size,
        brokenLinksCount,
      },
    };
  } finally {
    db.close();
  }
}
