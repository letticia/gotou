export const FONT_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.5] as const;

const STORAGE_KEY = "gotou:dict-font-scale";

/** 100%(等倍)を既定にする */
export const DEFAULT_SCALE_INDEX = 1;

/** localStorageから文字サイズの段階を読む(未設定・不正値・非対応環境では既定値) */
export function loadScaleIndex(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SCALE_INDEX;
    const index = FONT_SCALE_STEPS.findIndex((step) => String(step) === raw);
    return index === -1 ? DEFAULT_SCALE_INDEX : index;
  } catch {
    return DEFAULT_SCALE_INDEX;
  }
}

export function saveScaleIndex(index: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(FONT_SCALE_STEPS[index]));
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(表示自体は継続できる)
  }
}

export function canIncrease(index: number): boolean {
  return index < FONT_SCALE_STEPS.length - 1;
}

export function canDecrease(index: number): boolean {
  return index > 0;
}
