// @sqlite.org/sqlite-wasm はTS型定義を同梱していないための最小限のアンビエント宣言。
// 実際に使うOO1 API (https://sqlite.org/wasm/doc/trunk/api-oo1.md) の範囲のみ型付けする。
declare module "@sqlite.org/sqlite-wasm" {
  export interface ExecOptions {
    sql: string;
    bind?: unknown[];
    rowMode?: "array" | "object" | "stmt";
    callback?: (row: Record<string, unknown>) => void;
  }

  export class Database {
    constructor(filename: string, mode?: string);
    exec(sql: string): void;
    exec(options: ExecOptions): void;
    close(): void;
  }

  export interface Sqlite3Static {
    oo1: {
      DB: typeof Database;
    };
    version: { libVersion: string };
  }

  export default function sqlite3InitModule(config?: unknown): Promise<Sqlite3Static>;
}
