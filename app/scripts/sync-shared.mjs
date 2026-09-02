#!/usr/bin/env node
// shared/ の契約ファイルと factory の自作ダミーfixtureを app/src 配下にコピーする。
// コピー先は生成物として .gitignore 対象(唯一の正は shared/ と factory/tests/fixtures/)。
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = dirname(APP_DIR);

function copyFile(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`synced: ${src} -> ${dest}`);
}

function copyJsonDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const name of readdirSync(srcDir)) {
    if (name.endsWith(".json")) {
      copyFile(join(srcDir, name), join(destDir, name));
    }
  }
}

const fileCopies = [
  [
    join(REPO_DIR, "shared", "variants.json"),
    join(APP_DIR, "src", "shared", "variants.json"),
  ],
  [
    join(REPO_DIR, "shared", "schema.sql"),
    join(APP_DIR, "src", "shared", "schema.sql"),
  ],
];

for (const [src, dest] of fileCopies) {
  copyFile(src, dest);
}

const dirCopies = [
  [
    join(REPO_DIR, "shared", "gongyo", "units"),
    join(APP_DIR, "src", "shared", "gongyo", "units"),
  ],
  [
    join(REPO_DIR, "shared", "gongyo", "presets"),
    join(APP_DIR, "src", "shared", "gongyo", "presets"),
  ],
  [
    join(REPO_DIR, "shared", "gohogo"),
    join(APP_DIR, "src", "shared", "gohogo"),
  ],
];

for (const [src, dest] of dirCopies) {
  copyJsonDir(src, dest);
}
