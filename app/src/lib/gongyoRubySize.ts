export type GongyoRubySize = "normal" | "large";

const STORAGE_KEY = "gotou:gongyo-ruby-size";

export const DEFAULT_RUBY_SIZE: GongyoRubySize = "normal";

/**
 * 縦書きでルビ(読み)が本文の何倍の字送りか。
 * 本文はすでに画面いっぱいの大きさ(375px幅で33〜48px)なのに対し、ルビは
 * 0.4倍で13〜19pxしかない。ご年配の方には読みのほうが読みにくいため、
 * 設定で0.55倍まで大きくできるようにした(2026-10、開発者の判断)。
 * gongyo.ts の字送りの見積り(ルビが高さ方向に要る字数)にもこの値を使う。
 */
export const RUBY_TO_TEXT_RATIO: Record<GongyoRubySize, number> = {
  normal: 0.4,
  large: 0.55,
};

function isRubySize(value: unknown): value is GongyoRubySize {
  return value === "normal" || value === "large";
}

export function loadRubySize(): GongyoRubySize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isRubySize(raw) ? raw : DEFAULT_RUBY_SIZE;
  } catch {
    return DEFAULT_RUBY_SIZE;
  }
}

export function saveRubySize(size: GongyoRubySize): void {
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(読誦自体は継続できる)
  }
}
