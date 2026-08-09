export type GongyoCounterMode = "label" | "count";

const STORAGE_KEY = "gotou:gongyo-counter-mode";

/** 既定は簡易表示(unit名を1回示すだけ)。回数を数える方式は設定で明示的に選ぶ */
export const DEFAULT_COUNTER_MODE: GongyoCounterMode = "label";

function isCounterMode(value: unknown): value is GongyoCounterMode {
  return value === "label" || value === "count";
}

/** localStorageから十念・三唱礼等の数え方を読む(未設定・不正値・非対応環境では既定の簡易表示) */
export function loadCounterMode(): GongyoCounterMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isCounterMode(raw) ? raw : DEFAULT_COUNTER_MODE;
  } catch {
    return DEFAULT_COUNTER_MODE;
  }
}

export function saveCounterMode(mode: GongyoCounterMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(表示自体は継続できる)
  }
}
