#!/usr/bin/env node
// Google FontsからNoto Serif JP / Zen Old Mincho / Klee Oneのwoff2一式を取得し、
// app/public/fonts/ に自前ホスティングする(オフラインファースト方針。app/CLAUDE.md参照)。
// 一度だけ手動実行するスクリプト(predev/prebuild/pretestには組み込まない)。
// Googleは文字のUnicode範囲ごとに多数の小さなwoff2に分割して配信しており、
// このスクリプトはその分割構造をそのままローカルへ複製する(ブラウザ側の
// unicode-rangeによる「使う文字のぶんだけ取得」という挙動を自前ホスティングでも
// 保つため)。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const FONTS_DIR = join(APP_DIR, "public", "fonts");

const FAMILIES = [
  { name: "Noto Serif JP", slug: "noto-serif-jp", weights: "400;700" },
  { name: "Zen Old Mincho", slug: "zen-old-mincho", weights: "400;700" },
  { name: "Klee One", slug: "klee-one", weights: "400;600" },
];

// unicode-range分割済みのwoff2を得るには、モダンブラウザのUser-Agentを名乗る必要がある
// (既定のUAだと分割前のフォールバック用ttfが返る)。
const MODERN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CONCURRENCY = 8;

async function fetchCss() {
  const familyParams = FAMILIES.map(
    (f) => `family=${encodeURIComponent(f.name)}:wght@${f.weights}`,
  ).join("&");
  const url = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": MODERN_UA } });
  if (!res.ok) throw new Error(`Google Fonts CSS取得に失敗: ${res.status}`);
  return res.text();
}

function parseFontFaceBlocks(css) {
  const blocks = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  return blocks.map((block) => {
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
    const style = block.match(/font-style:\s*(\w+)/)?.[1] ?? "normal";
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    const url = block.match(/url\(([^)]+)\)/)?.[1];
    const unicodeRange = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    const slug = FAMILIES.find((f) => f.name === family)?.slug;
    if (!family || !weight || !url || !slug) {
      throw new Error(`@font-faceの解析に失敗: ${block.slice(0, 120)}`);
    }
    return { family, slug, style, weight, url, unicodeRange };
  });
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function downloadFont(entry) {
  const filename = entry.url.split("/").pop();
  const destDir = join(FONTS_DIR, entry.slug);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, filename);
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`ダウンロード失敗 (${res.status}): ${entry.url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, bytes);
  return { ...entry, filename, size: bytes.length };
}

function buildLocalCss(downloaded) {
  return downloaded
    .map((f) => {
      const rangeLine = f.unicodeRange ? `\n  unicode-range: ${f.unicodeRange};` : "";
      return `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url(./${f.slug}/${f.filename}) format('woff2');${rangeLine}
}`;
    })
    .join("\n\n");
}

async function main() {
  console.log("Google Fonts CSSを取得中...");
  const css = await fetchCss();
  const entries = parseFontFaceBlocks(css);
  console.log(`@font-face ${entries.length}件を検出。ダウンロード開始(並列${CONCURRENCY})...`);

  const downloaded = await withConcurrency(entries, CONCURRENCY, async (entry, i) => {
    const result = await downloadFont(entry);
    if ((i + 1) % 50 === 0 || i + 1 === entries.length) {
      console.log(`  ${i + 1}/${entries.length} 件完了`);
    }
    return result;
  });

  const localCss = buildLocalCss(downloaded);
  mkdirSync(FONTS_DIR, { recursive: true });
  writeFileSync(join(FONTS_DIR, "fonts.css"), localCss + "\n");

  const totalBytes = downloaded.reduce((sum, f) => sum + f.size, 0);
  console.log(`\n完了: ${downloaded.length}ファイル、合計 ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`出力先: ${FONTS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
