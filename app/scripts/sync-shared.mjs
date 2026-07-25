#!/usr/bin/env node
// shared/ の契約ファイルと factory の自作ダミーfixtureを app/src 配下にコピーする。
// コピー先は生成物として .gitignore 対象(唯一の正は shared/ と factory/tests/fixtures/)。
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(APP_DIR);

const copies = [
  [
    join(REPO_DIR, "shared", "variants.json"),
    join(APP_DIR, "src", "shared", "variants.json"),
  ],
  [
    join(REPO_DIR, "factory", "tests", "fixtures", "articles.json"),
    join(APP_DIR, "src", "fixtures", "articles.json"),
  ],
];

for (const [src, dest] of copies) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`synced: ${src} -> ${dest}`);
}
