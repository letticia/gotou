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
          ← 戻る
        </button>
        <h2>設定</h2>
      </div>
      <div className="settings-item">
        <label htmlFor="settings-font-choice">フォント</label>
        <select
          id="settings-font-choice"
          className="font-choice-select"
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
    </div>
  );
}
