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
  getEntry(id: number): EntryRow | null;
  close(): void;
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
