import { useEffect, useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";
import SettingsScreen from "./SettingsScreen";
import { BookIcon, FlameIcon, GearIcon } from "./Icons";
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
  // 勤行の読誦中は画面全体を経本にする(タブバー・ナビバーを隠す)。
  // 「画面下半分どこでもタップでページ送り」(CLAUDE.md)とボトムタブバーは
  // 操作が衝突するため、読誦中だけは必ず隠す。GongyoModeが状態を教えてくれる。
  const [gongyoImmersive, setGongyoImmersive] = useState(false);
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

  const immersive = mode === "gongyo" && gongyoImmersive && !showSettings;
  const showTabBar = !showSettings && !immersive;

  const shellClassName = [
    "shell",
    mode === "gongyo" && !showSettings && "shell-gongyo",
    showSettings && "shell-settings",
    showTabBar && "shell-with-tab-bar",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
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
          {!immersive && (
            <header className="nav-bar">
              <h1 className="nav-bar-title">{mode === "search" ? "辞書" : "勤行"}</h1>
              <button
                type="button"
                className="nav-bar-button"
                onClick={() => setShowSettings(true)}
                aria-label="設定"
              >
                <GearIcon />
              </button>
            </header>
          )}
          {mode === "search" ? (
            <SearchMode />
          ) : (
            <GongyoMode
              pendingImport={pendingImport}
              onImportHandled={() => setPendingImport(null)}
              onImmersiveChange={setGongyoImmersive}
            />
          )}
        </>
      )}
      {showTabBar && (
        <nav className="tab-bar">
          <button
            type="button"
            className={mode === "search" ? "tab-bar-item active" : "tab-bar-item"}
            onClick={() => setMode("search")}
            aria-current={mode === "search" ? "page" : undefined}
          >
            <BookIcon />
            <span>辞書</span>
          </button>
          <button
            type="button"
            className={mode === "gongyo" ? "tab-bar-item active" : "tab-bar-item"}
            onClick={() => setMode("gongyo")}
            aria-current={mode === "gongyo" ? "page" : undefined}
          >
            <FlameIcon />
            <span>勤行</span>
          </button>
        </nav>
      )}
    </div>
  );
}
