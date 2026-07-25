import type { GongyoPreset } from "./lib/gongyo";

interface PresetPickerProps {
  builtinPresets: GongyoPreset[];
  userPresets: GongyoPreset[];
  onStart: (id: string) => void;
  onDuplicateEdit: (preset: GongyoPreset) => void;
  onEditUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onClose: () => void;
}

export default function PresetPicker({
  builtinPresets,
  userPresets,
  onStart,
  onDuplicateEdit,
  onEditUser,
  onDeleteUser,
  onClose,
}: PresetPickerProps) {
  function handleDelete(preset: GongyoPreset) {
    if (window.confirm(`「${preset.name}」を削除しますか?`)) {
      onDeleteUser(preset.id);
    }
  }

  return (
    <div className="preset-picker">
      <div className="preset-picker-header">
        <button type="button" className="gongyo-back" onClick={onClose}>
          ← 戻る
        </button>
        <h2>差定を選ぶ</h2>
      </div>

      {userPresets.length > 0 && (
        <section className="preset-section">
          <h3>マイ差定</h3>
          <ul className="preset-list">
            {userPresets.map((preset) => (
              <li key={preset.id} className="preset-list-item">
                <span className="preset-name">{preset.name}</span>
                <div className="preset-actions">
                  <button type="button" onClick={() => onStart(preset.id)}>
                    はじめる
                  </button>
                  <button type="button" onClick={() => onEditUser(preset.id)}>
                    編集
                  </button>
                  <button type="button" className="preset-delete" onClick={() => handleDelete(preset)}>
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="preset-section">
        <h3>雛形</h3>
        <ul className="preset-list">
          {builtinPresets.map((preset) => (
            <li key={preset.id} className="preset-list-item">
              <span className="preset-name">{preset.name}</span>
              <div className="preset-actions">
                <button type="button" onClick={() => onStart(preset.id)}>
                  はじめる
                </button>
                <button type="button" onClick={() => onDuplicateEdit(preset)}>
                  複製して編集
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
