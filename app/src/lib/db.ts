import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

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
  /** 本文に needle を含む項目を返す(逆引き典拠検索の第1層。docs/tenkyo-spec.md B-2) */
  searchTextContains(needle: string, limit: number): SearchRow[];
  getEntry(id: number): EntryRow | null;
  close(): void;
}

/** LIKEのワイルドカード(% _)とエスケープ文字自身を無効化する。
 * 利用者が貼り付けた一節にこれらが含まれていても素直に文字として扱うため。 */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * ダウンロード(またはCache APIから復元)したSQLiteファイルのバイト列を
 * @sqlite.org/sqlite-wasmで開く。sqlite3_deserializeを使い、DBを丸ごと
 * WASMのメモリに読み込む(ブラウザ側でスキーマを組み立て直すことはしない。
 * バイト列の生成はscripts/build-dummy-db.mts、実データ入手後は同じ仕組みで
 * factory側の出力に差し替える想定)。
 */
export async function openDatabaseFromBytes(bytes: Uint8Array): Promise<DictionaryDb> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB();

  const p = sqlite3.wasm.allocFromTypedArray(bytes);
  const rc = sqlite3.capi.sqlite3_deserialize(
    db,
    "main",
    p,
    bytes.length,
    bytes.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
  );
  if (rc !== 0) {
    db.close();
    throw new Error(`sqlite3_deserialize failed (rc=${rc})`);
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

    searchTextContains(needle, limit) {
      // FTS5のMATCHは使わない: 既定のunicode61トークナイザは句読点でしか区切らないため、
      // 日本語では句の途中の部分一致が常に0件になる(docs/tenkyo-spec.md B-2の計測参照)。
      // 本文は全体でも4.4M文字程度しかなく、LIKEの全走査でも10ms前後で収まる。
      // entries_fts.rowid は entries.id と一致するので、JOINで表示可能な項目に戻せる。
      if (!needle) return [];
      const rows: SearchRow[] = [];
      db.exec({
        sql: `SELECT e.id, e.title, e.reading FROM entries_fts f
              JOIN entries e ON e.id = f.rowid
              WHERE f.body_text LIKE ? ESCAPE '\\' LIMIT ?`,
        bind: [`%${escapeLikePattern(needle)}%`, limit],
        rowMode: "object",
        callback: (row) => {
          rows.push({
            id: row.id as number,
            title: row.title as string,
            reading: row.reading as string,
          });
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
