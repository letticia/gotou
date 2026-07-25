import { useEffect, useMemo, useState } from "react";
import { buildPages, loadGongyoPresets, loadGongyoUnits } from "./lib/gongyo";
import { advance, goBack, initState } from "./lib/gongyoNav";
import type { GongyoNavState } from "./lib/gongyoNav";

// 骨組みのため、プリセットは固定で1つだけ表示する(ホーム画面からの選択UIはスコープ外)。
const PRESET_ID = "junen-only";

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

export default function GongyoMode() {
  const unitsById = useMemo(() => loadGongyoUnits(), []);
  const presetsById = useMemo(() => loadGongyoPresets(), []);
  const preset = presetsById.get(PRESET_ID) ?? null;
  const pages = useMemo(() => (preset ? buildPages(preset, unitsById) : []), [preset, unitsById]);

  const [nav, setNav] = useState<GongyoNavState>(() => initState(pages));

  useWakeLock(pages.length > 0);

  if (!preset || pages.length === 0) {
    return (
      <div className="gongyo">
        <p className="gongyo-error">差定を読み込めませんでした。</p>
      </div>
    );
  }

  const page = pages[nav.pageIndex];
  const isFinished = nav.pageIndex === pages.length - 1 && (nav.counterRemaining ?? 0) === 0;

  function handleTap() {
    setNav((prev) => advance(prev, pages));
  }

  function handleBack(event: React.MouseEvent) {
    event.stopPropagation();
    setNav((prev) => goBack(prev, pages));
  }

  return (
    <div className="gongyo" onClick={handleTap}>
      <div className="gongyo-header">
        {nav.pageIndex > 0 && (
          <button type="button" className="gongyo-back" onClick={handleBack}>
            ← 前へ
          </button>
        )}
        <span className="gongyo-position">
          {nav.pageIndex + 1} / {pages.length}
        </span>
      </div>
      <div className="gongyo-body">
        {page.ruby && <p className="gongyo-ruby">{page.ruby}</p>}
        <p className="gongyo-text">{page.text}</p>
        {nav.counterRemaining !== null && (
          <p className="gongyo-counter">{nav.counterRemaining}</p>
        )}
        {isFinished && <p className="gongyo-finished">おつとめ、終わりです</p>}
      </div>
    </div>
  );
}
