import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { GongyoPreset } from "./lib/gongyo";
import { buildShareUrl, isValidGongyoPreset } from "./lib/presetSharing";

interface PresetPickerProps {
  builtinPresets: GongyoPreset[];
  userPresets: GongyoPreset[];
  onStart: (id: string) => void;
  onDuplicateEdit: (preset: GongyoPreset) => void;
  onEditUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onImportPreset: (preset: GongyoPreset) => void;
  onClose: () => void;
}

export default function PresetPicker({
  builtinPresets,
  userPresets,
  onStart,
  onDuplicateEdit,
  onEditUser,
  onDeleteUser,
  onImportPreset,
  onClose,
}: PresetPickerProps) {
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  function handleDelete(preset: GongyoPreset) {
    if (window.confirm(`「${preset.name}」を削除しますか?`)) {
      onDeleteUser(preset.id);
    }
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(importText);
      if (!isValidGongyoPreset(parsed)) {
        setImportError("差定のJSONとして読み取れませんでした。");
        return;
      }
      onImportPreset(parsed);
      setImportText("");
      setImportError(null);
    } catch {
      setImportError("JSONの形式が正しくありません。");
    }
  }

  function renderPresetItem(preset: GongyoPreset, actions: React.ReactNode) {
    const isSharing = sharingId === preset.id;
    return (
      <li key={preset.id} className="preset-list-item-wrapper">
        <div className="preset-list-item">
          <span className="preset-name">{preset.name}</span>
          <div className="preset-actions">
            {actions}
            <button type="button" onClick={() => setSharingId(isSharing ? null : preset.id)}>
              共有
            </button>
          </div>
        </div>
        {isSharing && <SharePanel preset={preset} onClose={() => setSharingId(null)} />}
      </li>
    );
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
            {userPresets.map((preset) =>
              renderPresetItem(
                preset,
                <>
                  <button type="button" onClick={() => onStart(preset.id)}>
                    はじめる
                  </button>
                  <button type="button" onClick={() => onEditUser(preset.id)}>
                    編集
                  </button>
                  <button
                    type="button"
                    className="preset-delete"
                    onClick={() => handleDelete(preset)}
                  >
                    削除
                  </button>
                </>,
              ),
            )}
          </ul>
        </section>
      )}

      <section className="preset-section">
        <h3>雛形</h3>
        <ul className="preset-list">
          {builtinPresets.map((preset) =>
            renderPresetItem(
              preset,
              <>
                <button type="button" onClick={() => onStart(preset.id)}>
                  はじめる
                </button>
                <button type="button" onClick={() => onDuplicateEdit(preset)}>
                  複製して編集
                </button>
              </>,
            ),
          )}
        </ul>
      </section>

      <section className="preset-section">
        <h3>JSONから読み込む</h3>
        <textarea
          className="preset-import-textarea"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportError(null);
          }}
          placeholder="共有されたJSONをここに貼り付け"
          rows={4}
        />
        {importError && <p className="preset-import-error">{importError}</p>}
        <button type="button" className="preset-import-button" onClick={handleImport}>
          読み込む
        </button>
      </section>
    </div>
  );
}

interface SharePanelProps {
  preset: GongyoPreset;
  onClose: () => void;
}

function SharePanel({ preset, onClose }: SharePanelProps) {
  const [copied, setCopied] = useState<"url" | "json" | null>(null);
  const url = buildShareUrl(preset);
  const json = JSON.stringify(preset, null, 2);

  function copy(text: string, field: "url" | "json") {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
      })
      .catch(() => {
        // クリップボード権限が無い等の場合は静かに諦める(URL/JSONはこの画面に表示済み)
      });
  }

  return (
    <div className="share-panel">
      <QRCodeSVG value={url} size={180} />
      <p className="share-url">{url}</p>
      <div className="share-actions">
        <button type="button" onClick={() => copy(url, "url")}>
          {copied === "url" ? "コピーしました" : "URLをコピー"}
        </button>
        <button type="button" onClick={() => copy(json, "json")}>
          {copied === "json" ? "コピーしました" : "JSONをコピー"}
        </button>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
