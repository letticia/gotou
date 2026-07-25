// Keep DICTIONARY_DATA_PATHS in sync with isDictionaryDataRequest() in
// src/lib/swCacheRules.ts (tested there). Duplicated here because this file
// is a plain static asset (see app/CLAUDE.md: avoid build-plugin-only features).
const DICTIONARY_DATA_PATHS = ["/dictionary.sqlite3", "/dictionary-manifest.json"];
function isDictionaryDataRequest(pathname) {
  return DICTIONARY_DATA_PATHS.some((p) => pathname === p || pathname.endsWith(p));
}

// Bump this string by hand whenever a release should force-evict old shell caches.
const SHELL_CACHE = "gotou-shell-v1";

const PRECACHE_URLS = [
  "./",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("gotou-shell-") && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
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
