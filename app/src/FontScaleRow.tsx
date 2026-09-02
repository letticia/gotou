import { useEffect, useState } from "react";
import {
  FONT_SCALE_STEPS,
  canDecrease,
  canIncrease,
  loadScaleIndex,
  saveScaleIndex,
} from "./lib/dictFontScale";

// 文字サイズのステッパー(A- / A+)。辞書と御法語の読み物で共用する。
//
// 状態はこの部品が持ち、localStorageと :root の --dict-font-scale を面倒みる。
// 辞書と御法語は同時にマウントされない(タブで入れ替わる)ため、
// それぞれがマウント時にlocalStorageから読み直すだけで値は揃う。
// .app の font-size がこの変数を参照しているので、:root に置けば配下へ継承される
// (--app-font-family と同じやり方)。

export default function FontScaleRow() {
  const [scaleIndex, setScaleIndex] = useState(() => loadScaleIndex());

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--dict-font-scale",
      String(FONT_SCALE_STEPS[scaleIndex]),
    );
  }, [scaleIndex]);

  function decrease() {
    setScaleIndex((prev) => {
      // disabled属性の再描画が間に合わない連続クリックでも配列の範囲外に
      // ならないようclampする(disabledだけに頼らない)
      const next = Math.max(0, prev - 1);
      saveScaleIndex(next);
      return next;
    });
  }

  function increase() {
    setScaleIndex((prev) => {
      const next = Math.min(FONT_SCALE_STEPS.length - 1, prev + 1);
      saveScaleIndex(next);
      return next;
    });
  }

  return (
    <div className="font-scale-row">
      <button
        type="button"
        className="font-scale-button"
        onClick={decrease}
        disabled={!canDecrease(scaleIndex)}
        aria-label="文字を小さく"
      >
        A-
      </button>
      <button
        type="button"
        className="font-scale-button"
        onClick={increase}
        disabled={!canIncrease(scaleIndex)}
        aria-label="文字を大きく"
      >
        A+
      </button>
    </div>
  );
}
