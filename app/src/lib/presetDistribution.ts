import type { GongyoPreset } from "./gongyo";
import { decodePresetFromUrl, isValidGongyoPreset } from "./presetSharing";

/**
 * お寺が檀信徒に差定を配る(QR・リンク)ための下回り。
 *
 * 配る側は差定に「配布元」(お寺の名前)を書き、受け取る側は開くだけで
 * その差定がすぐ読める状態になる、というのが目標。
 */

/** 配布元の長さの上限。扉や受け取り画面に一行で出すため */
export const MAX_FROM_LENGTH = 40;

/** 入力された配布元を整える。空なら undefined(項目ごと持たない) */
export function normalizeFrom(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim().slice(0, MAX_FROM_LENGTH);
  return trimmed || undefined;
}

/** 中身(名前・配布元・並び)が同じ差定を探す。同じリンクを2回開いても
 *  マイ差定に重複を作らないため。id は受け取るたびに振り直すので比べない */
export function findSamePreset(
  presets: GongyoPreset[],
  incoming: GongyoPreset,
): GongyoPreset | null {
  const key = (p: GongyoPreset) =>
    JSON.stringify({ name: p.name, from: p.from ?? null, items: p.items });
  const target = key(incoming);
  return presets.find((p) => key(p) === target) ?? null;
}

/**
 * 貼り付けられた文字列から差定を取り出す。共有リンク(…#share=…)と
 * 差定のJSONのどちらも受け付ける。読めなければ理由つきで null。
 */
export function extractSharedPreset(
  text: string,
): { preset: GongyoPreset; error: null } | { preset: null; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { preset: null, error: "リンクかJSONを貼り付けてください。" };

  const share = /#share=([A-Za-z0-9_-]+)/.exec(trimmed);
  if (share) {
    const preset = decodePresetFromUrl(share[1]);
    return preset
      ? { preset, error: null }
      : { preset: null, error: "共有リンクが途中で切れているか、壊れています。" };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isValidGongyoPreset(parsed)
      ? { preset: parsed, error: null }
      : { preset: null, error: "差定のJSONとして読み取れませんでした。" };
  } catch {
    return { preset: null, error: "共有リンクでも差定のJSONでもないようです。" };
  }
}

/**
 * iPhone・iPad のブラウザ(Safari 等)で受け取ったかどうか。
 *
 * iOS では、ホーム画面に追加したアプリとブラウザで保存場所が分かれている。
 * お寺で配られたQRをカメラで読むとブラウザで開くので、そこで受け取った差定は
 * ホーム画面のアプリには引き継がれない(manifest の start_url は "." なので
 * リンクの中身も渡らない)。この場合だけ、アプリ側で貼り付け直す案内を出す。
 * Android はブラウザとアプリで保存場所を共有するので案内しない。
 */
export function receivedInIosBrowser(
  userAgent: string,
  maxTouchPoints: number,
  standalone: boolean,
): boolean {
  if (standalone) return false;
  const iPhoneOrIPad = /iPhone|iPad|iPod/.test(userAgent);
  // iPadOS 13以降のSafariはMacを名乗るので、タッチ点数で見分ける
  const iPadAsMac = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  return iPhoneOrIPad || iPadAsMac;
}
