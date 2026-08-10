import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPages,
  firstPageIndexOfItem,
  loadGongyoPresets,
  loadGongyoUnits,
  resolveDisplayRuby,
  sizeTierFor,
  verticalColumnCount,
  verticalMaxLineLength,
} from "./lib/gongyo";
import type { GongyoPage, GongyoPageLine, GongyoPreset } from "./lib/gongyo";
import { loadCounterMode } from "./lib/gongyoCounterMode";
import { loadOrientation, saveOrientation, toggleOrientation } from "./lib/gongyoOrientation";
import { advance, goBack, initState } from "./lib/gongyoNav";
import type { GongyoNavState } from "./lib/gongyoNav";
import {
  deleteUserPreset,
  duplicatePreset,
  generateUserPresetId,
  loadLastPresetId,
  loadUserPresets,
  saveLastPresetId,
  saveUserPreset,
} from "./lib/userPresets";
import PresetEditor from "./PresetEditor";
import PresetPicker from "./PresetPicker";

// 選択UIが無い頃からの既定値。ユーザーが一度も選んだことが無ければこれを使う。
const DEFAULT_PRESET_ID = "nichijo-gongyo-sanbujo";

// Screen Wake Lock API: 対応ブラウザでのみ有効。取得に失敗しても機能に支障はないため無視する。
// 回転ロックはFullscreen API依存で環境により不安定なため今回はスコープ外。
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    navigator.wakeLock
      .request("screen")
      .then((s) => {
        if (cancelled) {
          s.release();
        } else {
          sentinel = s;
        }
      })
      .catch(() => {
        // 非対応・拒否時は静かに諦める
      });

    return () => {
      cancelled = true;
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}

type View =
  | { name: "reciting" }
  | { name: "picker" }
  | { name: "editor"; preset: GongyoPreset }
  | { name: "import"; preset: GongyoPreset };

interface GongyoModeProps {
  pendingImport?: GongyoPreset | null;
  onImportHandled?: () => void;
  /** 読誦中(=画面全体を経本にすべき状態)かどうかをAppに伝える */
  onImmersiveChange?: (immersive: boolean) => void;
}

export default function GongyoMode({
  pendingImport,
  onImportHandled,
  onImmersiveChange,
}: GongyoModeProps = {}) {
  const unitsById = useMemo(() => loadGongyoUnits(), []);
  const builtinPresetsById = useMemo(() => loadGongyoPresets(), []);
  const [userPresets, setUserPresets] = useState<GongyoPreset[]>(() => loadUserPresets());
  const [presetId, setPresetId] = useState<string>(() => loadLastPresetId() ?? DEFAULT_PRESET_ID);
  const [view, setView] = useState<View>({ name: "reciting" });
  const [introShown, setIntroShown] = useState(false);
  const [orientation, setOrientation] = useState(() => loadOrientation());
  // 十念・三唱礼の数え方(簡易表示/カウントダウン)。切り替えは設定画面でのみ行う
  // (Appは設定画面表示中GongyoModeをアンマウントするため、再マウント時にここで
  // 読み直すだけで最新の設定が反映される。orientationのようなヘッダートグルは無い)
  const [counterMode] = useState(() => loadCounterMode());

  // 共有URLを開いた直後に取り込み確認画面へ遷移する
  useEffect(() => {
    if (pendingImport) {
      setView({ name: "import", preset: pendingImport });
    }
  }, [pendingImport]);

  // 読誦画面(扉を過ぎた本編)だけが没入表示。扉・差定選択・編集・取り込みは
  // 通常のクロム付き画面のまま(扉から辞書タブへ戻れる必要があるため)。
  const immersive = view.name === "reciting" && introShown;
  useEffect(() => {
    onImmersiveChange?.(immersive);
  }, [immersive, onImmersiveChange]);

  // 勤行モードを抜けるとき(アンマウント時)は必ず没入を解除する。
  // 解除し損ねるとタブバーが出ないまま辞書へ戻れなくなる。
  useEffect(() => {
    return () => onImmersiveChange?.(false);
  }, [onImmersiveChange]);

  const userPresetsById = useMemo(() => {
    const map = new Map<string, GongyoPreset>();
    for (const p of userPresets) map.set(p.id, p);
    return map;
  }, [userPresets]);

  const preset = userPresetsById.get(presetId) ?? builtinPresetsById.get(presetId) ?? null;
  // 縦書きと横書きでは1タップで進む行数が異なるため、向きが変わるとページ構成も変わる
  const pages = useMemo(
    () => (preset ? buildPages(preset, unitsById, orientation, counterMode) : []),
    [preset, unitsById, orientation, counterMode],
  );

  const [nav, setNav] = useState<GongyoNavState>(() => initState(pages));
  // 縦横の切り替え時に、戻り先として覚えておく差定内の位置(向き変更でページ番号が変わるため)
  const restoreItemIndexRef = useRef<number | null>(null);

  // プリセット切り替え時に読書位置をリセットする。
  // ただし向きの切り替えでpagesが作り直された場合は、読誦中の偈文の先頭に留まる。
  useEffect(() => {
    const restoreItemIndex = restoreItemIndexRef.current;
    restoreItemIndexRef.current = null;
    setNav(
      initState(
        pages,
        restoreItemIndex === null ? 0 : firstPageIndexOfItem(pages, restoreItemIndex),
      ),
    );
  }, [pages]);

  useWakeLock(view.name === "reciting" && pages.length > 0);

  function handleStart(id: string) {
    setPresetId(id);
    saveLastPresetId(id);
    setIntroShown(false);
    setView({ name: "reciting" });
  }

  function handleDuplicateEdit(source: GongyoPreset) {
    const draft = duplicatePreset(source, generateUserPresetId(), `${source.name}(コピー)`);
    setView({ name: "editor", preset: draft });
  }

  function handleEditUser(id: string) {
    const target = userPresetsById.get(id);
    if (target) setView({ name: "editor", preset: target });
  }

  function handleDeleteUser(id: string) {
    deleteUserPreset(id);
    setUserPresets(loadUserPresets());
    if (id === presetId) {
      setPresetId(DEFAULT_PRESET_ID);
      saveLastPresetId(DEFAULT_PRESET_ID);
    }
  }

  function handleSaveEditor(updated: GongyoPreset) {
    saveUserPreset(updated);
    setUserPresets(loadUserPresets());
    setView({ name: "picker" });
  }

  // 送信元のidをそのまま使わず、取り込んだものは自分の差定として新しいidを振る
  function importPreset(incoming: GongyoPreset) {
    saveUserPreset({ ...incoming, id: generateUserPresetId() });
    setUserPresets(loadUserPresets());
  }

  function handleImportFromJson(incoming: GongyoPreset) {
    importPreset(incoming);
  }

  function handleConfirmImport(incoming: GongyoPreset) {
    importPreset(incoming);
    onImportHandled?.();
    setView({ name: "picker" });
  }

  function handleDeclineImport() {
    onImportHandled?.();
    setView({ name: "reciting" });
  }

  if (view.name === "picker") {
    return (
      <PresetPicker
        builtinPresets={Array.from(builtinPresetsById.values())}
        userPresets={userPresets}
        onStart={handleStart}
        onDuplicateEdit={handleDuplicateEdit}
        onEditUser={handleEditUser}
        onDeleteUser={handleDeleteUser}
        onImportPreset={handleImportFromJson}
        onClose={() => setView({ name: "reciting" })}
      />
    );
  }

  if (view.name === "import") {
    const importPages = buildPages(view.preset, unitsById);
    const includedUnitTitles = Array.from(
      new Set(
        view.preset.items
          .map((item) => unitsById.get(item.unit)?.title)
          .filter((title): title is string => Boolean(title)),
      ),
    );
    return (
      <div className="preset-picker">
        <div className="preset-picker-header">
          <h2>差定を受け取りました</h2>
        </div>
        <p className="preset-name">{view.preset.name}</p>
        <p className="preset-import-summary">
          {includedUnitTitles.length}種類のunit・全{importPages.length}ページ
        </p>
        <ul className="preset-list">
          {includedUnitTitles.map((title) => (
            <li key={title} className="preset-list-item">
              <span className="preset-name">{title}</span>
            </li>
          ))}
        </ul>
        <div className="preset-actions">
          <button type="button" className="preset-save" onClick={() => handleConfirmImport(view.preset)}>
            追加する
          </button>
          <button type="button" className="gongyo-back" onClick={handleDeclineImport}>
            追加しない
          </button>
        </div>
      </div>
    );
  }

  if (view.name === "editor") {
    return (
      <PresetEditor
        preset={view.preset}
        unitsById={unitsById}
        onSave={handleSaveEditor}
        onCancel={() => setView({ name: "picker" })}
      />
    );
  }

  if (!preset || pages.length === 0) {
    return (
      <div className="gongyo">
        <p className="gongyo-error">差定を読み込めませんでした。</p>
        <button type="button" className="gongyo-back" onClick={() => setView({ name: "picker" })}>
          差定を選ぶ
        </button>
      </div>
    );
  }

  function handleOpenPicker(event: React.MouseEvent) {
    event.stopPropagation();
    setView({ name: "picker" });
  }

  // ページ送りのタップ(gongyo全体のonClick)と混ざらないよう伝播を止める
  function handleToggleOrientation(event: React.MouseEvent) {
    event.stopPropagation();
    // 向きが変わると1タップで進む行数が変わりページ番号がずれるため、
    // 読誦中の偈文を覚えておき、切り替え後はその先頭から続けられるようにする
    restoreItemIndexRef.current = pages[nav.pageIndex]?.itemIndex ?? null;
    const next = toggleOrientation(orientation);
    setOrientation(next);
    saveOrientation(next);
  }

  if (!introShown) {
    // 扉(導入画面)は差定名だけを表示する経本の表紙のようなもののため、
    // 縦/横トグルの対象にせず常に縦書き・中央表示にする(#6)。
    // 本文と同じ.gongyo-line/.gongyo-textの構造に乗せることで、
    // 字送り・中央揃えのロジックをそのまま再利用する。
    const introLines: GongyoPageLine[] = [{ text: preset.name }];
    return (
      <div className="gongyo gongyo-vertical gongyo-intro" onClick={() => setIntroShown(true)}>
        <div className="gongyo-header">
          <button type="button" className="gongyo-preset-select" onClick={handleOpenPicker}>
            差定を選ぶ
          </button>
        </div>
        <div className="gongyo-body">
          <div
            className="gongyo-lines"
            style={
              {
                "--gongyo-columns": verticalColumnCount(introLines),
                "--gongyo-max-chars": Math.ceil(verticalMaxLineLength(introLines)),
              } as React.CSSProperties
            }
          >
            <div className="gongyo-line-group">
              <div className="gongyo-line">
                <p className="gongyo-text">{preset.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 向き切り替え直後は、新しいpagesが確定した後の再描画1回だけ、まだ古い向きの
  // nav.pageIndexが残っている(navを打ち直すuseEffectはこの描画の後にしか走らない)。
  // ページ数が向きによって大きく変わるunit(阿弥陀如来根本陀羅尼・一枚起請文等)では
  // 添字が新しいpagesの範囲外になり得るため、その1回の描画だけ安全にクランプする。
  const page = pages[Math.min(nav.pageIndex, pages.length - 1)];
  const isFinished = nav.pageIndex === pages.length - 1 && (nav.counterRemaining ?? 0) === 0;
  // 横書きは字数から決めた段階クラスで、縦書きは列数と必要字数をCSSへ渡して
  // min()に実寸から決めさせる(端末幅ごとの閾値調整が要らなくなる)
  const isVertical = orientation === "vertical";
  const linesClassName = isVertical
    ? "gongyo-lines"
    : `gongyo-lines gongyo-lines-size-${sizeTierFor(page)}`;
  const linesStyle = isVertical
    ? ({
        "--gongyo-columns": page.verticalColumns ?? verticalColumnCount(page.lines),
        "--gongyo-max-chars": Math.ceil(page.verticalMaxChars ?? verticalMaxLineLength(page.lines)),
      } as React.CSSProperties)
    : undefined;
  // カウンター(十念等の残り回数)が出る回は本文の領域がそのぶん狭くなる。
  // 縦書きの字送りは空き高さから決まるので、有無をCSSへ知らせる。
  const rootClassName = [
    "gongyo",
    `gongyo-${orientation}`,
    nav.counterRemaining !== null && "gongyo-has-counter",
  ]
    .filter(Boolean)
    .join(" ");

  function handleTap() {
    // 最終ページまで読み終えた後のタップはこれ以上進めず行き止まりになるため、
    // 差定選択へ導く(選択画面はタブバーが出るので辞書へも移動しやすい)
    if (isFinished) {
      setView({ name: "picker" });
      return;
    }
    setNav((prev) => advance(prev, pages));
  }

  function handleBack(event: React.MouseEvent) {
    event.stopPropagation();
    setNav((prev) => goBack(prev, pages));
  }

  // エコー行(前ページ最終行の薄い表示)は経本の続きの目印として右端寄りに留め、
  // 実際に読む本文だけを.gongyo-line-groupでまとめて中央揃えの対象にする(縦書き)。
  function renderLine(line: GongyoPageLine, absoluteIndex: number) {
    const ruby = absoluteIndex === 0 ? resolveDisplayRuby(page, nav.counterRemaining) : line.ruby;
    const className = ["gongyo-line", line.dimmed && "gongyo-line-dimmed", ruby && "gongyo-line-has-ruby"]
      .filter(Boolean)
      .join(" ");
    return (
      <div key={absoluteIndex} className={className}>
        {ruby && <p className="gongyo-ruby">{ruby}</p>}
        <p className="gongyo-text">{line.text}</p>
      </div>
    );
  }

  const hasEcho = page.lines[0]?.dimmed === true;
  const echoLine = hasEcho ? page.lines[0] : undefined;
  const bodyLines = hasEcho ? page.lines.slice(1) : page.lines;

  return (
    <div className={rootClassName} onClick={handleTap}>
      <div className="gongyo-header">
        {nav.pageIndex > 0 && (
          <button type="button" className="gongyo-back" onClick={handleBack}>
            ← 前へ
          </button>
        )}
        <button
          type="button"
          className="gongyo-orientation-toggle"
          onClick={handleToggleOrientation}
          aria-label={orientation === "vertical" ? "横書きに切り替え" : "縦書きに切り替え"}
        >
          {orientation === "vertical" ? "横書き" : "縦書き"}
        </button>
        <button type="button" className="gongyo-preset-select" onClick={handleOpenPicker}>
          差定を選ぶ
        </button>
        <span className="gongyo-position">
          {nav.pageIndex + 1} / {pages.length}
        </span>
      </div>
      <div className="gongyo-labels">
        <span className="gongyo-preset-name">{preset.name}</span>
        <span className="gongyo-unit-title">{page.unitTitle}</span>
      </div>
      <div className="gongyo-body">
        {/* key=pageIndexで各ページを別要素として強制的に作り直す。paginated unit(誦経等)は
            ページごとの行数が同じことが多く、renderLineのkey(0,1,2...)だけでは
            Reactが既存のDOMノードを使い回してテキストだけ差し替える形になる。
            iPhone Safariはこの「同一要素内でのテキスト差し替え」を、縦書き
            (writing-mode: vertical-rl)+ネストしたflexという構成では正しく再描画
            しないことがあり、ページ送り後も画面下部に前のページの残像が残る
            不具合が報告された。要素ごと作り直せばSafariが必ず新規に描画するため
            この種の再描画漏れを避けられる。 */}
        <div key={nav.pageIndex} className={linesClassName} style={linesStyle}>
          {hasEcho ? (
            <>
              {renderLine(echoLine!, 0)}
              <div className="gongyo-line-group">
                {bodyLines.map((line, i) => renderLine(line, i + 1))}
              </div>
            </>
          ) : (
            bodyLines.map((line, i) => renderLine(line, i))
          )}
        </div>
        {nav.counterRemaining !== null && (
          <p className="gongyo-counter">{nav.counterRemaining}</p>
        )}
        {isFinished && <p className="gongyo-finished">おつとめ、終わりです</p>}
      </div>
    </div>
  );
}
