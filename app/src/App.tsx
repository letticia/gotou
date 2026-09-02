import { useEffect, useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";
import GohogoMode from "./GohogoMode";
import FontScaleRow from "./FontScaleRow";
import SettingsScreen from "./SettingsScreen";
import AboutScreen from "./AboutScreen";
import HelpScreen from "./HelpScreen";
import { BookIcon, FlameIcon, GearIcon, ScrollIcon } from "./Icons";
import type { GongyoPreset } from "./lib/gongyo";
import { parseShareHash } from "./lib/presetSharing";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";
import type { FontChoice } from "./lib/fontChoice";
import { fontStackFor, loadFontChoice, saveFontChoice } from "./lib/fontChoice";
import type { GongyoCounterMode } from "./lib/gongyoCounterMode";
import { loadCounterMode, saveCounterMode } from "./lib/gongyoCounterMode";
import type { GohogoHen } from "./lib/gohogoHen";
import { loadGohogoHen, saveGohogoHen } from "./lib/gohogoHen";

type Mode = "search" | "gohogo" | "gongyo";

const MODE_TITLES: Record<Mode, string> = {
  search: "辞書",
  gohogo: "御法語",
  gongyo: "勤行",
};

const FALLBACK_FONT_STACK = 'system-ui, -apple-system, "Hiragino Sans", sans-serif';

export default function App() {
  const [mode, setMode] = useState<Mode>("search");
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingImport, setPendingImport] = useState<GongyoPreset | null>(null);
  // 辞書の「今日の御法語」から御法語タブのその章へ渡すための受け渡し
  // (差定の共有URLで勤行へ飛ばす pendingImport と同じ流儀)
  const [gohogoTarget, setGohogoTarget] = useState<{ hen: GohogoHen; chapter: number } | null>(
    null,
  );
  const [fontChoice, setFontChoice] = useState<FontChoice>(() => loadFontChoice());
  // GongyoMode自身はマウント時にloadCounterMode()を直接読むため、ここでの状態は
  // 設定画面へ値を渡し・変更を保存する橋渡し役のみ(GongyoModeへは渡さない)
  const [counterMode, setCounterMode] = useState<GongyoCounterMode>(() => loadCounterMode());
  // 篇の選択も同様。GongyoModeは再マウント時にloadGohogoHen()を直接読む
  const [gohogoHen, setGohogoHen] = useState<GohogoHen>(() => loadGohogoHen());
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

  function handleCounterModeChange(next: GongyoCounterMode) {
    setCounterMode(next);
    saveCounterMode(next);
  }

  function handleGohogoHenChange(next: GohogoHen) {
    setGohogoHen(next);
    saveGohogoHen(next);
  }

  function handleOpenGohogo(hen: GohogoHen, chapter: number) {
    setGohogoTarget({ hen, chapter });
    setMode("gohogo");
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
        showHelp ? (
          <HelpScreen onClose={() => setShowHelp(false)} />
        ) : showAbout ? (
          <AboutScreen onClose={() => setShowAbout(false)} />
        ) : (
          <SettingsScreen
            fontChoice={fontChoice}
            onFontChange={handleFontChange}
            counterMode={counterMode}
            onCounterModeChange={handleCounterModeChange}
            gohogoHen={gohogoHen}
            onGohogoHenChange={handleGohogoHenChange}
            onClose={() => setShowSettings(false)}
            onOpenHelp={() => setShowHelp(true)}
            onOpenAbout={() => setShowAbout(true)}
          />
        )
      ) : (
        <>
          {!immersive && (
            <header className="nav-bar">
              <h1 className="nav-bar-title">{MODE_TITLES[mode]}</h1>
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
          {mode === "search" && <SearchMode onOpenGohogo={handleOpenGohogo} />}
          {mode === "gohogo" && (
            <GohogoMode
              initialTarget={gohogoTarget}
              onTargetHandled={() => setGohogoTarget(null)}
              fontScaleRow={<FontScaleRow />}
            />
          )}
          {mode === "gongyo" && (
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
            className={mode === "gohogo" ? "tab-bar-item active" : "tab-bar-item"}
            onClick={() => setMode("gohogo")}
            aria-current={mode === "gohogo" ? "page" : undefined}
          >
            <ScrollIcon />
            <span>御法語</span>
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
