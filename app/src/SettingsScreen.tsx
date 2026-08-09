import { ChevronLeftIcon } from "./Icons";
import type { FontChoice } from "./lib/fontChoice";
import { FONT_LABELS } from "./lib/fontChoice";

interface SettingsScreenProps {
  fontChoice: FontChoice;
  onFontChange: (choice: FontChoice) => void;
  onClose: () => void;
}

export default function SettingsScreen({ fontChoice, onFontChange, onClose }: SettingsScreenProps) {
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
      </section>
      <p className="settings-footnote">
        辞書と勤行の本文に使う書体です。文字の大きさは辞書の画面で変えられます。
      </p>
    </div>
  );
}
