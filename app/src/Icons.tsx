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

/** 勤行タブ: 灯明の炎(アプリ名「語灯」とアイコンの炎に呼応させる)。
 *  外側の炎は上端を細く尖らせ、内側にも小さな炎を重ねる。丸い涙滴形だと
 *  小さく描いたときに水滴に見えてしまうため。 */
export function FlameIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} className={className}>
      <path d="M13 2.2c-.3 3-1.7 4.4-3.3 5.9C7.9 9.7 6 11.5 6 14.2a6 6 0 0 0 12 0c0-2.4-1.1-4.1-2.4-5.6-.3.9-.9 1.5-1.7 1.8.6-3.2-.1-6-.9-8.2z" />
      <path d="M12 13.2c1 1.2 1.9 2 1.9 3.2a1.9 1.9 0 0 1-3.8 0c0-1.1.9-1.9 1.9-3.2z" />
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

/** 遷移先があることを示す右向きのシェブロン(設定行の開示インジケータ) */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...COMMON} strokeWidth={2} className={className}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
