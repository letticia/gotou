export type AppMode = "search" | "gohogo" | "gongyo";

const STORAGE_KEY = "gotou:last-mode";

/** 初めて開いたときのタブ。辞書が主役のアプリなので辞書から始める */
export const DEFAULT_MODE: AppMode = "search";

function isAppMode(value: unknown): value is AppMode {
  return value === "search" || value === "gohogo" || value === "gongyo";
}

/** 最後に開いていたタブを読む。勤行や御法語だけを使う人が、毎回
 *  辞書の「ダウンロード開始」画面から始めずに済むようにするため */
export function loadLastMode(): AppMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isAppMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveLastMode(mode: AppMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(次回は辞書から始まるだけ)
  }
}
