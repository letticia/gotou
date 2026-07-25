import { useState } from "react";
import type { GongyoPreset, GongyoUnit } from "./lib/gongyo";
import { reorderItems, setItemCounter, toggleItemEnabled } from "./lib/userPresets";

interface PresetEditorProps {
  preset: GongyoPreset;
  unitsById: Map<string, GongyoUnit>;
  onSave: (preset: GongyoPreset) => void;
  onCancel: () => void;
}

export default function PresetEditor({ preset, unitsById, onSave, onCancel }: PresetEditorProps) {
  const [name, setName] = useState(preset.name);
  const [items, setItems] = useState(preset.items);

  function move(index: number, direction: -1 | 1) {
    setItems((prev) => reorderItems(prev, index, index + direction));
  }

  function toggle(index: number) {
    setItems((prev) => toggleItemEnabled(prev, index));
  }

  function changeCounter(index: number, delta: number) {
    setItems((prev) => {
      const current = prev[index].counter;
      if (current === undefined) {
        return delta > 0 ? setItemCounter(prev, index, 1) : prev;
      }
      const next = current + delta;
      return setItemCounter(prev, index, next > 0 ? next : undefined);
    });
  }

  function handleSave() {
    onSave({ ...preset, name, items });
  }

  return (
    <div className="preset-editor">
      <div className="preset-picker-header">
        <button type="button" className="gongyo-back" onClick={onCancel}>
          ← キャンセル
        </button>
        <h2>差定を編集</h2>
      </div>

      <input
        type="text"
        className="preset-name-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="差定の名前"
      />

      <ul className="preset-editor-list">
        {items.map((item, index) => {
          const unit = unitsById.get(item.unit);
          const enabled = item.enabled !== false;
          return (
            <li
              key={index}
              className={enabled ? "preset-editor-item" : "preset-editor-item disabled"}
            >
              <div className="preset-editor-reorder">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="上へ"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="下へ"
                >
                  ↓
                </button>
              </div>
              <span className="preset-editor-title">{unit?.title ?? item.unit}</span>
              <div className="preset-editor-counter">
                <button type="button" onClick={() => changeCounter(index, -1)} aria-label="回数を減らす">
                  −
                </button>
                <span>{item.counter ?? "なし"}</span>
                <button type="button" onClick={() => changeCounter(index, 1)} aria-label="回数を増やす">
                  ＋
                </button>
              </div>
              <button
                type="button"
                className="preset-editor-toggle"
                onClick={() => toggle(index)}
              >
                {enabled ? "オン" : "オフ"}
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="preset-save" onClick={handleSave}>
        保存
      </button>
    </div>
  );
}
