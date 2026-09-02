export type GohogoHen = "zenpen" | "kohen";

const STORAGE_KEY = "gotou:gohogo-hen";

/** 日替わり御法語で読む篇。既定は前篇(『元祖大師御法語』の順序に従う) */
export const DEFAULT_GOHOGO_HEN: GohogoHen = "zenpen";

export const GOHOGO_HEN_LABELS: Record<GohogoHen, string> = {
  zenpen: "前篇",
  kohen: "後篇",
};

function isGohogoHen(value: unknown): value is GohogoHen {
  return value === "zenpen" || value === "kohen";
}

/** localStorageから篇の選択を読む(未設定・不正値・非対応環境では既定の前篇) */
export function loadGohogoHen(): GohogoHen {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isGohogoHen(raw) ? raw : DEFAULT_GOHOGO_HEN;
  } catch {
    return DEFAULT_GOHOGO_HEN;
  }
}

export function saveGohogoHen(hen: GohogoHen): void {
  try {
    localStorage.setItem(STORAGE_KEY, hen);
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(読誦自体は継続できる)
  }
}
