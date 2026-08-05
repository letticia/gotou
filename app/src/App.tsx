import { useEffect, useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";
import type { GongyoPreset } from "./lib/gongyo";
import { parseShareHash } from "./lib/presetSharing";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";
import type { FontChoice } from "./lib/fontChoice";
import { FONT_LABELS, fontStackFor, loadFontChoice, saveFontChoice } from "./lib/fontChoice";

type Mode = "search" | "gongyo";

const FALLBACK_FONT_STACK = 'system-ui, -apple-system, "Hiragino Sans", sans-serif';

export default function App() {
  const [mode, setMode] = useState<Mode>("search");
  const [pendingImport, setPendingImport] = useState<GongyoPreset | null>(null);
  const [fontChoice, setFontChoice] = useState<FontChoice>(() => loadFontChoice());
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();

  // 差定の共有URL(#share=...)を開いた場合、勤行モードへ切り替えて取り込み確認を出す
  useEffect(() => {
    const imported = parseShareHash(window.location.hash);
    if (imported) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setMode("gongyo");
      setPendingImport(imported);
    }
  }, []);

  // 選択中のフォントをCSS変数(--app-font-family)経由でアプリ全体(辞書・勤行両方)に反映する。
  // Webフォントが読み込めない場合に備え、既存のシステムフォント列を後段に残す。
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-family",
      `${fontStackFor(fontChoice)}, ${FALLBACK_FONT_STACK}`,
    );
  }, [fontChoice]);

  function handleFontChange(next: FontChoice) {
    setFontChoice(next);
    saveFontChoice(next);
  }

  return (
    <div className={mode === "gongyo" ? "shell shell-gongyo" : "shell"}>
      <div className="prototype-notice">
        これは開発中のプロトタイプです。収録内容はダミーデータで、浄土宗大辞典の内容ではありません。浄土宗の公式アプリではありません。
      </div>
      {updateAvailable && (
        <div className="update-banner">
          <span>アプリの更新があります。</span>
          <button type="button" onClick={applyUpdate}>
            再読み込み
          </button>
        </div>
      )}
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
      <div className="font-choice-row">
        <select
          className="font-choice-select"
          value={fontChoice}
          onChange={(event) => handleFontChange(event.target.value as FontChoice)}
          aria-label="フォントを選ぶ"
        >
          {(Object.keys(FONT_LABELS) as FontChoice[]).map((choice) => (
            <option key={choice} value={choice}>
              {FONT_LABELS[choice]}
            </option>
          ))}
        </select>
      </div>
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
