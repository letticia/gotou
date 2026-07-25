export interface DictionaryManifest {
  version: string;
  url: string;
}

export type DictionarySource = "cache" | "network";

/** receivedBytes: これまでに受信したバイト数。totalBytes: Content-Lengthから分かる場合の総バイト数(不明なら0) */
export type ProgressCallback = (receivedBytes: number, totalBytes: number) => void;

const CACHE_NAME = "gotou-dictionary-v1";

/** バージョンをクエリパラメータとして埋め込み、バージョンごとに別のCacheキーになるようにする */
export function withVersion(url: string, version: string): string {
  const u = new URL(url, "http://placeholder.invalid");
  u.searchParams.set("v", version);
  return u.pathname + u.search;
}

/** 受信したチャンク列を1つのUint8Arrayに結合する(純粋関数) */
export function concatChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function matchAnyCachedDictionary(cache: Cache): Promise<Uint8Array | null> {
  const keys = await cache.keys();
  if (keys.length === 0) return null;
  const response = await cache.match(keys[0]);
  if (!response) return null;
  return new Uint8Array(await response.arrayBuffer());
}

/** レスポンスボディをストリームで読みつつonProgressで進捗を報告し、最終的なバイト列を返す */
async function readResponseBytes(
  response: Response,
  onProgress?: ProgressCallback,
): Promise<Uint8Array> {
  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : 0;

  if (!response.body) {
    // ReadableStream非対応環境へのフォールバック(進捗は完了時に一度だけ報告)
    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, total || buffer.byteLength);
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(received, total);
  }
  return concatChunks(chunks, received);
}

/**
 * 辞書DBのバイト列を取得する。manifestUrl(バージョン+DB本体のURL)をまず取得し、
 * 対応するバージョンがCache APIに無ければダウンロードして保存する(ダウンロード中は
 * onProgressで受信バイト数を報告する)。manifest自体の取得に失敗した場合(オフライン等)は、
 * Cacheに何かあればそれをベストエフォートで返す。Service Worker化・バックグラウンド更新はスコープ外。
 */
export async function getDictionaryBytes(
  manifestUrl: string,
  onProgress?: ProgressCallback,
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

  // clone()はbodyが読まれる前に呼ぶ必要がある(読み取り後はロックされ複製できない)
  const responseForCache = response.clone();
  const bytes = await readResponseBytes(response, onProgress);
  await cache.put(versionedUrl, responseForCache);

  return { bytes, source: "network" };
}
