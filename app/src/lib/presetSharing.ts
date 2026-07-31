import type { GongyoPreset, GongyoPresetItem } from "./gongyo";

/** UTF-8を含むJSONをURLセーフなbase64にする(プリセット名等が日本語のため) */
export function encodePresetForUrl(preset: GongyoPreset): string {
  const json = JSON.stringify(preset);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isGongyoPresetItem(data: unknown): data is GongyoPresetItem {
  if (typeof data !== "object" || data === null) return false;
  const item = data as Record<string, unknown>;
  if (typeof item.unit !== "string") return false;
  if ("counter" in item && item.counter !== undefined && typeof item.counter !== "number") {
    return false;
  }
  if ("enabled" in item && item.enabled !== undefined && typeof item.enabled !== "boolean") {
    return false;
  }
  return true;
}

/** 最低限の構造チェック。壊れたJSON・想定外の形をここで弾く */
export function isValidGongyoPreset(data: unknown): data is GongyoPreset {
  if (typeof data !== "object" || data === null) return false;
  const preset = data as Record<string, unknown>;
  return (
    typeof preset.version === "number" &&
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    Array.isArray(preset.items) &&
    preset.items.every(isGongyoPresetItem)
  );
}

/** 壊れたbase64・JSON・想定外の構造のいずれでも例外を投げずnullを返す */
export function decodePresetFromUrl(encoded: string): GongyoPreset | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return isValidGongyoPreset(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** location.origin + BASE_URL を基点にした共有URLを組み立てる */
export function buildShareUrl(preset: GongyoPreset): string {
  const encoded = encodePresetForUrl(preset);
  return `${window.location.origin}${import.meta.env.BASE_URL}#share=${encoded}`;
}

/** "#share=..." 形式のハッシュから復元する。該当しない・壊れている場合はnull */
export function parseShareHash(hash: string): GongyoPreset | null {
  const match = /^#share=(.+)$/.exec(hash);
  if (!match) return null;
  return decodePresetFromUrl(match[1]);
}
