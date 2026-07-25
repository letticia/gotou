export interface DictionaryManifest {
  version: string;
  url: string;
}

export type DictionarySource = "cache" | "network";

const CACHE_NAME = "gotou-dictionary-v1";

/** バージョンをクエリパラメータとして埋め込み、バージョンごとに別のCacheキーになるようにする */
export function withVersion(url: string, version: string): string {
  const u = new URL(url, "http://placeholder.invalid");
  u.searchParams.set("v", version);
  return u.pathname + u.search;
}

async function matchAnyCachedDictionary(cache: Cache): Promise<Uint8Array | null> {
  const keys = await cache.keys();
  if (keys.length === 0) return null;
  const response = await cache.match(keys[0]);
  if (!response) return null;
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * 辞書DBのバイト列を取得する。manifestUrl(バージョン+DB本体のURL)をまず取得し、
 * 対応するバージョンがCache APIに無ければダウンロードして保存する。
 * manifest自体の取得に失敗した場合(オフライン等)は、Cacheに何かあればそれを
 * ベストエフォートで返す。Service Worker化・進捗表示・バックグラウンド更新はスコープ外。
 */
export async function getDictionaryBytes(
  manifestUrl: string,
): Promise<{ bytes: Uint8Array; source: DictionarySource }> {
  const cache = await caches.open(CACHE_NAME);

  let manifest: DictionaryManifest | null = null;
  try {
    const manifestResponse = await fetch(manifestUrl, { cache: "no-store" });
    if (manifestResponse.ok) {
      manifest = (await manifestResponse.json()) as DictionaryManifest;
    }
  } catch {
    // オフライン等。下でCacheへのフォールバックを試みる。
  }

  if (!manifest) {
    const cached = await matchAnyCachedDictionary(cache);
    if (cached) return { bytes: cached, source: "cache" };
    throw new Error("辞書データを取得できません。ネットワークに接続してから開き直してください。");
  }

  const versionedUrl = withVersion(manifest.url, manifest.version);

  const cached = await cache.match(versionedUrl);
  if (cached) {
    return { bytes: new Uint8Array(await cached.arrayBuffer()), source: "cache" };
  }

  const response = await fetch(versionedUrl);
  if (!response.ok) {
    throw new Error(`辞書データのダウンロードに失敗しました (status=${response.status})`);
  }
  await cache.put(versionedUrl, response.clone());
  return { bytes: new Uint8Array(await response.arrayBuffer()), source: "network" };
}
