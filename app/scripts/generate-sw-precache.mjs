#!/usr/bin/env node
// vite build後、dist/assets/の実ファイル名(ハッシュ付きJS/CSS・SQLite wasm・
// ワーカースクリプト)をdist/sw.jsのPRECACHE_URLSへ機械的に反映する。
// これが無いと、SWのinstall時点ではHTMLシェル・manifest・アイコンしか
// 事前キャッシュされず、アプリ本体のJS/wasmは「一度オンラインでリクエストされた」
// ときにcacheFirstRuntimeCacheが後追いでキャッシュするだけになる。SW有効化直後、
// まだ何もランタイムキャッシュされていないタイミングでオフラインになると
// アプリ本体が読み込めなくなる(機内モードで起動が進まない不具合の原因)。
//
// あわせてSHELL_CACHEの名前をアセット一覧のハッシュで自動バージョニングする。
// ビルドごとに値が変わることで、既存のactivateイベント内のクリーンアップ
// ("gotou-shell-"で始まり現在のSHELL_CACHEと一致しないキャッシュを削除)が
// 前回ビルドの古いキャッシュを自動で捨てるようになる(手動バンプ不要)。
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST_DIR = join(APP_DIR, "dist");
const ASSETS_DIR = join(DIST_DIR, "assets");
const SW_FILE = join(DIST_DIR, "sw.js");

const ASSET_URLS_MARKER = "const BUILD_ASSET_URLS = [];";
const SHELL_CACHE_MARKER = 'const SHELL_CACHE = "gotou-shell-dev";';

const assetFiles = readdirSync(ASSETS_DIR).sort();
const assetUrls = assetFiles.map((name) => `./assets/${name}`);

const hash = createHash("sha256").update(assetFiles.join("\n")).digest("hex").slice(0, 12);

let swSource = readFileSync(SW_FILE, "utf8");

if (!swSource.includes(ASSET_URLS_MARKER)) {
  throw new Error(
    `${SW_FILE} に "${ASSET_URLS_MARKER}" が見つかりません。app/public/sw.js が` +
      " 手動編集でズレていないか確認してください。",
  );
}
if (!swSource.includes(SHELL_CACHE_MARKER)) {
  throw new Error(
    `${SW_FILE} に "${SHELL_CACHE_MARKER}" が見つかりません。app/public/sw.js が` +
      " 手動編集でズレていないか確認してください。",
  );
}

const assetUrlsLiteral =
  "const BUILD_ASSET_URLS = [\n" +
  assetUrls.map((url) => `  ${JSON.stringify(url)},`).join("\n") +
  "\n];";

swSource = swSource.replace(ASSET_URLS_MARKER, assetUrlsLiteral);
swSource = swSource.replace(SHELL_CACHE_MARKER, `const SHELL_CACHE = "gotou-shell-${hash}";`);

writeFileSync(SW_FILE, swSource);

console.log(
  `sw.js の事前キャッシュ一覧を更新: ${assetUrls.length}件のビルド成果物 ` +
    `(SHELL_CACHE=gotou-shell-${hash})`,
);
