import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import schemaSql from "../shared/schema.sql?raw";
import { loadDummyEntries, buildTitleIdMap } from "./dummyEntries";
import type { DummyEntry } from "./dummyEntries";
import { parseBody } from "./renderBody";

export interface SearchRow {
  id: number;
  title: string;
  reading: string;
}

export interface EntryRow {
  id: number;
  title: string;
  reading: string;
  bodyHtml: string;
}

export interface DictionaryDb {
  searchByPrefix(normalizedQuery: string): SearchRow[];
  getEntry(id: number): EntryRow | null;
  close(): void;
}

interface EntryRowTuple {
  id: number;
  title: string;
  reading: string;
  searchKey: string;
  bodyHtml: string;
}

/**
 * ダミーfixtureからshared/schema.sqlのentries/entries_fts/links行を組み立てる純粋関数。
 * リンク抽出は新規に書かず、既存のparseBody(renderBody.ts)が解決した結果を再利用する
 * (二重実装を避ける)。body_htmlには本物のHTMLではなく生wikitextをそのまま入れる
 * (本格的なHTML変換はfactoryの責務。詳細はdocs/handoff.md参照)。
 */
export function buildDummyRows(
  entries: DummyEntry[],
  titleToId: Map<string, number>,
): { entryRows: EntryRowTuple[]; linkPairs: [number, number][] } {
  const entryRows: EntryRowTuple[] = [];
  const linkPairs: [number, number][] = [];

  for (const entry of entries) {
    entryRows.push({
      id: entry.id,
      title: entry.title,
      reading: entry.reading,
      searchKey: entry.searchKey,
      bodyHtml: entry.body,
    });

    const segments = parseBody(entry.body, titleToId).flat();
    for (const segment of segments) {
      if (segment.kind === "link" && segment.targetId !== null) {
        linkPairs.push([entry.id, segment.targetId]);
      }
    }
  }

  return { entryRows, linkPairs };
}

/**
 * ブラウザ上で@sqlite.org/sqlite-wasmを初期化し(主スレッド・インメモリ、OPFS不使用)、
 * shared/schema.sqlを実行したうえでダミーfixtureを流し込んだSQLiteを構築する
 * (ファイルへの永続化はしない、ページを開くたびに毎回メモリ上に作り直す)。
 */
export async function openDummyDatabase(): Promise<DictionaryDb> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:", "ct");
  db.exec(schemaSql);

  const entries = loadDummyEntries();
  const titleToId = buildTitleIdMap(entries);
  const { entryRows, linkPairs } = buildDummyRows(entries, titleToId);

  for (const row of entryRows) {
    db.exec({
      sql: "INSERT INTO entries (id, title, reading, search_key, body_html) VALUES (?, ?, ?, ?, ?)",
      bind: [row.id, row.title, row.reading, row.searchKey, row.bodyHtml],
    });
    db.exec({
      sql: "INSERT INTO entries_fts (rowid, title, body_text) VALUES (?, ?, ?)",
      bind: [row.id, row.title, row.bodyHtml],
    });
  }
  for (const [fromId, toId] of linkPairs) {
    db.exec({
      sql: "INSERT INTO links (from_id, to_id) VALUES (?, ?)",
      bind: [fromId, toId],
    });
  }

  return {
    searchByPrefix(normalizedQuery) {
      const like = `${normalizedQuery}%`;
      const rows: SearchRow[] = [];
      db.exec({
        sql: "SELECT id, title, reading FROM entries WHERE reading LIKE ? OR search_key LIKE ? ORDER BY reading LIMIT 50",
        bind: [like, like],
        rowMode: "object",
        callback: (row) => {
          rows.push({ id: row.id as number, title: row.title as string, reading: row.reading as string });
        },
      });
      return rows;
    },

    getEntry(id) {
      let result: EntryRow | null = null;
      db.exec({
        sql: "SELECT id, title, reading, body_html AS bodyHtml FROM entries WHERE id = ?",
        bind: [id],
        rowMode: "object",
        callback: (row) => {
          result = {
            id: row.id as number,
            title: row.title as string,
            reading: row.reading as string,
            bodyHtml: row.bodyHtml as string,
          };
        },
      });
      return result;
    },

    close() {
      db.close();
    },
  };
}
