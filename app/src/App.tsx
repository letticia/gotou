import { useEffect, useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";
import type { GongyoPreset } from "./lib/gongyo";
import { parseShareHash } from "./lib/presetSharing";

type Mode = "search" | "gongyo";

export default function App() {
  const [mode, setMode] = useState<Mode>("search");
  const [pendingImport, setPendingImport] = useState<GongyoPreset | null>(null);

  // 差定の共有URL(#share=...)を開いた場合、勤行モードへ切り替えて取り込み確認を出す
  useEffect(() => {
    const imported = parseShareHash(window.location.hash);
    if (imported) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setMode("gongyo");
      setPendingImport(imported);
    }
  }, []);

  return (
    <div className={mode === "gongyo" ? "shell shell-gongyo" : "shell"}>
      <div className="prototype-notice">
        これは開発中のプロトタイプです。収録内容はダミーデータで、浄土宗大辞典の内容ではありません。浄土宗の公式アプリではありません。
      </div>
      <nav className="mode-tabs">
        <button
          type="button"
          className={mode === "search" ? "active" : ""}
          onClick={() => setMode("search")}
        >
          辞書
        </button>
        <button
          type="button"
          className={mode === "gongyo" ? "active" : ""}
          onClick={() => setMode("gongyo")}
        >
          勤行
        </button>
      </nav>
      {mode === "search" ? (
        <SearchMode />
      ) : (
        <GongyoMode
          pendingImport={pendingImport}
          onImportHandled={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}
