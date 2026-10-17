import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { GongyoPreset } from "./lib/gongyo";
import { buildShareUrl } from "./lib/presetSharing";
import { extractSharedPreset } from "./lib/presetDistribution";
import { groupBuiltinPresets } from "./lib/presetGroups";

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

  // 共有リンク(…#share=…)とJSONのどちらも受け付ける。iPhoneではブラウザで
  // 受け取った差定がホーム画面のアプリに引き継がれないので、リンクを貼り直す経路になる
  function handleImport() {
    const result = extractSharedPreset(importText);
    if (!result.preset) {
      setImportError(result.error);
      return;
    }
    onImportPreset(result.preset);
    setImportText("");
    setImportError(null);
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

  const groups = groupBuiltinPresets(builtinPresets, import.meta.env.DEV);

  function renderBuiltinSection(title: string, note: string, presets: GongyoPreset[]) {
    if (presets.length === 0) return null;
    return (
      <section className="preset-section">
        <h3>{title}</h3>
        <p className="preset-section-note">{note}</p>
        <ul className="preset-list">
          {presets.map((preset) =>
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
      {/* 差定は僧侶の言葉なので、言葉は残しつつ何を選ぶ画面かを一行で添える */}
      <p className="preset-picker-lead">おつとめの順序(差定)を選びます。</p>

      {userPresets.length > 0 && (
        <section className="preset-section">
          <h3>マイ差定</h3>
          <p className="preset-section-note">自分で整えた差定です。</p>
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

      {renderBuiltinSection(
        "雛形",
        "あらかじめ用意された差定です。複製すると自分用に整えられます。",
        groups.general,
      )}
      {/* 棚経などは僧侶が檀家宅で読むもの。檀信徒が最初に目にしないよう下に分ける */}
      {renderBuiltinSection(
        "僧侶向け",
        "棚経など、僧侶が檀家宅で読むものです。",
        groups.priest,
      )}
      {/* 動作確認用。本番のビルドでは空になり、見出しごと出ない */}
      {renderBuiltinSection("開発用", "動作確認用です(本番では表示されません)。", groups.dev)}

      <section className="preset-section">
        <h3>リンク・JSONから読み込む</h3>
        <p className="preset-section-note">
          お寺などから届いた差定のリンクやJSONを貼り付けてください。
        </p>
        <textarea
          className="preset-import-textarea"
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportError(null);
          }}
          placeholder="共有されたリンクまたはJSONをここに貼り付け"
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
      {!preset.from && (
        <p className="share-hint">
          {"お寺から配る場合は、編集で「配布元」にお寺の名前を入れておくと、"
            + "受け取った方に表示されます。"}
        </p>
      )}
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
