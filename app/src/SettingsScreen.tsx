import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import type { GongyoCounterMode } from "./lib/gongyoCounterMode";
import type { GohogoHen } from "./lib/gohogoHen";
import { GOHOGO_HEN_LABELS } from "./lib/gohogoHen";
import type { FontChoice } from "./lib/fontChoice";
import { FONT_LABELS } from "./lib/fontChoice";

interface SettingsScreenProps {
  fontChoice: FontChoice;
  onFontChange: (choice: FontChoice) => void;
  counterMode: GongyoCounterMode;
  onCounterModeChange: (mode: GongyoCounterMode) => void;
  gohogoHen: GohogoHen;
  onGohogoHenChange: (hen: GohogoHen) => void;
  onClose: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
}

export default function SettingsScreen({
  fontChoice,
  onFontChange,
  counterMode,
  onCounterModeChange,
  gohogoHen,
  onGohogoHenChange,
  onClose,
  onOpenHelp,
  onOpenAbout,
}: SettingsScreenProps) {
  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button type="button" className="back-button" onClick={onClose}>
          <ChevronLeftIcon />
          <span>戻る</span>
        </button>
      </div>
      <h2 className="settings-title">設定</h2>

      <section className="settings-group">
        <div className="settings-row">
          <label className="settings-row-label" htmlFor="settings-font-choice">
            フォント
          </label>
          <select
            id="settings-font-choice"
            className="settings-select"
            value={fontChoice}
            onChange={(event) => onFontChange(event.target.value as FontChoice)}
          >
            {(Object.keys(FONT_LABELS) as FontChoice[]).map((choice) => (
              <option key={choice} value={choice}>
                {FONT_LABELS[choice]}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label className="settings-row-label" htmlFor="settings-counter-mode">
            十念・三唱礼の数え方
          </label>
          <select
            id="settings-counter-mode"
            className="settings-select"
            value={counterMode}
            onChange={(event) => onCounterModeChange(event.target.value as GongyoCounterMode)}
          >
            <option value="label">簡易表示(既定)</option>
            <option value="count">回数を数えながら唱える</option>
          </select>
        </div>
        <div className="settings-row">
          <label className="settings-row-label" htmlFor="settings-gohogo-hen">
            日替わり御法語の篇
          </label>
          <select
            id="settings-gohogo-hen"
            className="settings-select"
            value={gohogoHen}
            onChange={(event) => onGohogoHenChange(event.target.value as GohogoHen)}
          >
            {(Object.keys(GOHOGO_HEN_LABELS) as GohogoHen[]).map((hen) => (
              <option key={hen} value={hen}>
                {GOHOGO_HEN_LABELS[hen]}
                {hen === "zenpen" ? "(既定)" : ""}
              </option>
            ))}
          </select>
        </div>
      </section>
      <p className="settings-footnote">
        辞書と勤行の本文に使う書体です。文字の大きさは辞書の画面で変えられます。
        十念・三唱礼は既定では名前を1回示すだけで次へ進みます。回数を数えながら
        唱えたい場合は切り替えてください。
        日替わり御法語は、その日の日付と同じ番号の章を読みます(1日なら第一章)。
        前篇・後篇のどちらから読むかをここで選べます。
      </p>

      <section className="settings-group">
        <button type="button" className="settings-row-button" onClick={onOpenHelp}>
          <span className="settings-row-label">使い方</span>
          <ChevronRightIcon />
        </button>
        <button type="button" className="settings-row-button" onClick={onOpenAbout}>
          <span className="settings-row-label">このアプリについて</span>
          <ChevronRightIcon />
        </button>
      </section>
    </div>
  );
}
