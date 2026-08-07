import { useEffect, useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";
import SettingsScreen from "./SettingsScreen";
import type { GongyoPreset } from "./lib/gongyo";
import { parseShareHash } from "./lib/presetSharing";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";
import type { FontChoice } from "./lib/fontChoice";
import { fontStackFor, loadFontChoice, saveFontChoice } from "./lib/fontChoice";

type Mode = "search" | "gongyo";

const FALLBACK_FONT_STACK = 'system-ui, -apple-system, "Hiragino Sans", sans-serif';

export default function App() {
  const [mode, setMode] = useState<Mode>("search");
  const [showSettings, setShowSettings] = useState(false);
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
    <div className={mode === "gongyo" && !showSettings ? "shell shell-gongyo" : "shell"}>
      <div className="prototype-notice">
        これは開発中のプロトタイプです。浄土宗の公式アプリではありません。
      </div>
      {updateAvailable && (
        <div className="update-banner">
          <span>アプリの更新があります。</span>
          <button type="button" onClick={applyUpdate}>
            再読み込み
          </button>
        </div>
      )}
      {showSettings ? (
        <SettingsScreen
          fontChoice={fontChoice}
          onFontChange={handleFontChange}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
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
          <div className="settings-entry-row">
            <button
              type="button"
              className="settings-gear-button"
              onClick={() => setShowSettings(true)}
              aria-label="設定"
            >
              ⚙
            </button>
          </div>
          {mode === "search" ? (
            <SearchMode />
          ) : (
            <GongyoMode
              pendingImport={pendingImport}
              onImportHandled={() => setPendingImport(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
