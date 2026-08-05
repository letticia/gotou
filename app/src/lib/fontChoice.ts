export type FontChoice = "noto-serif-jp" | "zen-old-mincho" | "klee-one";

const STORAGE_KEY = "gotou:font-choice";

/** Noto Serif JP(源ノ明朝)を既定にする(和文の定番書体のため) */
export const DEFAULT_FONT: FontChoice = "noto-serif-jp";

export const FONT_LABELS: Record<FontChoice, string> = {
  "noto-serif-jp": "Noto Serif JP(既定)",
  "zen-old-mincho": "Zen Old Mincho",
  "klee-one": "Klee One",
};

const FONT_STACKS: Record<FontChoice, string> = {
  "noto-serif-jp": "'Noto Serif JP', serif",
  "zen-old-mincho": "'Zen Old Mincho', serif",
  "klee-one": "'Klee One', sans-serif",
};

export function fontStackFor(choice: FontChoice): string {
  return FONT_STACKS[choice];
}

function isFontChoice(value: unknown): value is FontChoice {
  return value === "noto-serif-jp" || value === "zen-old-mincho" || value === "klee-one";
}

/** localStorageから選択中のフォントを読む(未設定・不正値・非対応環境では既定値) */
export function loadFontChoice(): FontChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isFontChoice(raw) ? raw : DEFAULT_FONT;
  } catch {
    return DEFAULT_FONT;
  }
}

export function saveFontChoice(choice: FontChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(表示自体は継続できる)
  }
}
