export type GongyoOrientation = "vertical" | "horizontal";

const STORAGE_KEY = "gotou:gongyo-orientation";

/** 経本は基本的に縦書きで、それに見慣れた読み手が多いため既定は縦書きにする */
export const DEFAULT_ORIENTATION: GongyoOrientation = "vertical";

function isOrientation(value: unknown): value is GongyoOrientation {
  return value === "vertical" || value === "horizontal";
}

/** localStorageから向きを読む(未設定・不正値・非対応環境では既定の縦書き) */
export function loadOrientation(): GongyoOrientation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isOrientation(raw) ? raw : DEFAULT_ORIENTATION;
  } catch {
    return DEFAULT_ORIENTATION;
  }
}

export function saveOrientation(orientation: GongyoOrientation): void {
  try {
    localStorage.setItem(STORAGE_KEY, orientation);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(表示自体は継続できる)
  }
}

export function toggleOrientation(orientation: GongyoOrientation): GongyoOrientation {
  return orientation === "vertical" ? "horizontal" : "vertical";
}
