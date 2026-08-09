// タブバー・ナビゲーションバー用のアイコン。
// 外部アイコンライブラリは使わない(app/CLAUDE.mdの「Web標準から外れる実装・
// プラグイン前提の機能を避ける」方針と、オフラインファーストのため)。
// currentColorで描くので、選択状態の色付けはCSS側のcolorだけで済む。

interface IconProps {
  className?: string;
}

const COMMON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** 辞書タブ: 開いた本 */
export function BookIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className}>
      <path d="M12 6.6C10.4 5.1 8.4 4.6 4 4.6v12.8c4.4 0 6.4.5 8 2 1.6-1.5 3.6-2 8-2V4.6c-4.4 0-6.4.5-8 2z" />
      <path d="M12 6.6v12.8" />
    </svg>
  );
}

/** 勤行タブ: 灯明の炎(アプリ名「語灯」とアイコンの炎に呼応させる) */
export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className}>
      <path d="M12 2.8c.7 2.5 2 3.7 3.3 5.1 1.4 1.5 2.7 3.2 2.7 5.6a6 6 0 0 1-12 0c0-1.7.7-3.1 1.7-4.3.4.9 1 1.5 1.9 1.8C9.1 8.5 10.1 5.5 12 2.8z" />
    </svg>
  );
}

/** 設定 */
export function GearIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 14.7a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-2.7-1.2l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 2.7 1.2l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

/** 戻る(iOSのナビゲーションバーに倣った左向きのシェブロン) */
export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} strokeWidth={2} className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
