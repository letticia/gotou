#!/usr/bin/env -S npx tsx
// factory/tests/fixtures/articles.json (自作ダミー) から shared/schema.sql 準拠の
// SQLiteファイルをNode上で構築し、app/public/ に書き出す(開発・確認用の生成物、
// .gitignore対象)。app本体はこのファイルを「ダウンロードして開く」だけを行う。
// 実データ入手後は、同じ仕組みのまま生成元をfactory側の本物のデータに差し替える。
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

import { buildTitleIdMap, loadDummyEntries } from "../src/lib/dummyEntries.ts";
import { buildDummyRows } from "../src/lib/dummyRows.ts";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA_FILE = join(APP_DIR, "src", "shared", "schema.sql");
const PUBLIC_DIR = join(APP_DIR, "public");
const DB_FILE = join(PUBLIC_DIR, "dictionary.sqlite3");
const MANIFEST_FILE = join(PUBLIC_DIR, "dictionary-manifest.json");

async function main() {
  const schemaSql = readFileSync(SCHEMA_FILE, "utf-8");

  const entries = loadDummyEntries();
  const titleToId = buildTitleIdMap(entries);
  const { entryRows, linkPairs } = buildDummyRows(entries, titleToId);

  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:", "c");
  db.exec(schemaSql);

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

  const bytes = sqlite3.capi.sqlite3_js_db_export(db);
  db.close();

  // 内容が変わらなければ同じバージョンIDになる(開発中のキャッシュ再利用テストが安定する)
  const version = createHash("sha256")
    .update(schemaSql)
    .update(JSON.stringify(entryRows))
    .update(JSON.stringify(linkPairs))
    .digest("hex")
    .slice(0, 12);

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(DB_FILE, bytes);
  writeFileSync(
    MANIFEST_FILE,
    JSON.stringify({ version, url: "/dictionary.sqlite3" }, null, 2),
  );

  console.log(`生成完了: ${DB_FILE} (${bytes.length} bytes, version=${version})`);
}

main();
