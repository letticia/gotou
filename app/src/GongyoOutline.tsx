import { useEffect, useRef } from "react";
import type { GongyoOutlineItem } from "./lib/gongyo";

// 式次第の一覧。読誦中の現在地を確かめ、任意の偈文へ飛ぶための画面。
//
// GongyoModeのviewには載せず、読誦画面に重ねるオーバーレイにしている。
// viewを切り替えるとimmersiveがfalseになってタブバーが出入りし、読誦中に
// 画面が跳ねてしまうため(GongyoMode.tsxのimmersive / App.tsxのshowTabBar)。
//
// 読誦画面は全面がページ送りのタップ領域なので、この中のクリックは
// すべて伝播を止めること。止め損ねるとシートを触るたびにページが進む。

interface GongyoOutlineProps {
  presetName: string;
  outline: GongyoOutlineItem[];
  /** いま読んでいる項目のitemIndex */
  currentItemIndex: number;
  onJump: (itemIndex: number) => void;
  onClose: () => void;
}

export default function GongyoOutline({
  presetName,
  outline,
  currentItemIndex,
  onJump,
  onClose,
}: GongyoOutlineProps) {
  const currentRef = useRef<HTMLLIElement>(null);

  // 日常勤行式で18項目、棚経では24項目あるため、後半にいると開いた時点では
  // 現在地が画面の外にある。開いたら必ず見えるところまで送る。
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, []);

  function stop(event: React.MouseEvent) {
    event.stopPropagation();
  }

  return (
    <div className="gongyo-outline" onClick={(e) => { stop(e); onClose(); }}>
      <div className="gongyo-outline-sheet" onClick={stop} role="dialog" aria-label="式次第">
        <div className="gongyo-outline-header">
          <h2>式次第</h2>
          <button type="button" className="gongyo-outline-close" onClick={(e) => { stop(e); onClose(); }}>
            閉じる
          </button>
        </div>
        <p className="gongyo-outline-preset-name">{presetName}</p>
        <ul className="gongyo-outline-list">
          {outline.map((item) => {
            const isCurrent = item.itemIndex === currentItemIndex;
            const isDone = item.itemIndex < currentItemIndex;
            const className = [
              "gongyo-outline-item",
              isCurrent && "gongyo-outline-item-current",
              isDone && "gongyo-outline-item-done",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={item.itemIndex} ref={isCurrent ? currentRef : undefined} className={className}>
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    onJump(item.itemIndex);
                  }}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="gongyo-outline-ordinal">{item.ordinal}</span>
                  <span className="gongyo-outline-title">{item.unitTitle}</span>
                  {item.counterTotal !== undefined && (
                    <span className="gongyo-outline-counter">×{item.counterTotal}</span>
                  )}
                  {isCurrent && <span className="gongyo-outline-here">いまここ</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
