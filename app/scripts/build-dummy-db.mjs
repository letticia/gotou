#!/usr/bin/env node
// factory/tests/fixtures/articles.json (自作ダミー) から shared/schema.sql 準拠の
// SQLiteをfactoryの本物の変換パイプライン(wikitext→HTML含む)で生成し、
// app/public/ に書き出す(開発・確認用の生成物、.gitignore対象)。
// 実データ入手後は factory/output/ 側の本番出力をこの場所にコピーする運用に切り替える想定。
//
// factory/src/build_sqlite.py --source fixtures を呼ぶため、python3 が必要。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(APP_DIR);
const BUILD_SQLITE_PY = join(REPO_DIR, "factory", "src", "build_sqlite.py");
const PUBLIC_DIR = join(APP_DIR, "public");
const DB_FILE = join(PUBLIC_DIR, "dictionary.sqlite3");
const MANIFEST_FILE = join(PUBLIC_DIR, "dictionary-manifest.json");

mkdirSync(PUBLIC_DIR, { recursive: true });

const result = spawnSync(
  "python3",
  [BUILD_SQLITE_PY, "--source", "fixtures", "--output", DB_FILE],
  { cwd: REPO_DIR, stdio: "inherit" },
);

if (result.error) {
  console.error(
    "python3 の実行に失敗しました。factory/src/build_sqlite.py --source fixtures を" +
      " 実行するために python3 が必要です。",
  );
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(DB_FILE)) {
  throw new Error(`生成されるはずの ${DB_FILE} が見つかりません`);
}

// 内容が変わらなければ同じバージョンIDになる(開発中のキャッシュ再利用テストが安定する)
const version = createHash("sha256").update(readFileSync(DB_FILE)).digest("hex").slice(0, 12);

writeFileSync(
  MANIFEST_FILE,
  JSON.stringify({ version, url: "dictionary.sqlite3" }, null, 2),
);

console.log(`manifest書き出し完了: ${MANIFEST_FILE} (version=${version})`);
