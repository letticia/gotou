// Keep DICTIONARY_DATA_PATHS in sync with isDictionaryDataRequest() in
// src/lib/swCacheRules.ts (tested there). Duplicated here because this file
// is a plain static asset (see app/CLAUDE.md: avoid build-plugin-only features).
const DICTIONARY_DATA_PATHS = ["/dictionary.sqlite3", "/dictionary-manifest.json"];
function isDictionaryDataRequest(pathname) {
  return DICTIONARY_DATA_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

// scripts/generate-sw-precache.mjs がビルド後に "gotou-shell-<アセット一覧のハッシュ>" へ
// 書き換える。この値はスクリプト未実行時(ソースそのまま)のプレースホルダ。
const SHELL_CACHE = "gotou-shell-dev";

// scripts/generate-sw-precache.mjs がビルド後に dist/assets/ の実ファイル名
// (ハッシュ付きJS/CSS・SQLite wasm・ワーカースクリプト)で置き換える。
// これが空のままだと、SW有効化直後まだ何もランタイムキャッシュされていない
// タイミングでオフラインになった場合にアプリ本体が読み込めなくなる。
const BUILD_ASSET_URLS = [];

const PRECACHE_URLS = [
  "./",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  ...BUILD_ASSET_URLS,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("gotou-shell-") && name !== SHELL_CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
      // skipWaiting経由でactivateした新SWが、リロードなしで即座に既存ページの
      // 制御を握れるようにする(自動skipWaitingはしていないため、通常の
      // ライフサイクルでは無関係)
      self.clients.claim(),
    ]),
  );
});

// ページ側(useServiceWorkerUpdateの「再読み込み」操作)からの明示的な指示でのみ、
// 待機中のSWをactivateさせる。自動では呼ばない。
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (isDictionaryDataRequest(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }
  event.respondWith(cacheFirstRuntimeCache(req));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(request)) || (await cache.match("./"));
  }
}

async function cacheFirstRuntimeCache(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
