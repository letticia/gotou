/**
 * おつとめの中断位置。Androidの戻るジェスチャの暴発などでアプリが終了しても、
 * 読み手が自分の意思で元の位置へ戻れるようにするための保存。
 *
 * 位置はページ番号ではなく「差定の何番目の項目か(itemIndex)」+「その項目の
 * 何ページ目か(pageOffset)」で持つ。ページ構成は縦横の切り替え・カウンターの
 * 数え方・項目のオン/オフで変わるため、絶対ページ番号では復元できない。
 * itemIndexを使う理由は同じunitが差定に複数回現れるため(日常勤行式の十念は4回)。
 */

const STORAGE_KEY = "gotou:gongyo-progress";

export interface GongyoProgress {
  presetId: string;
  itemIndex: number;
  /** その項目の先頭ページから何ページ目か(0始まり) */
  pageOffset: number;
  /** カウントダウン方式のときの残り回数。簡易表示ではnull */
  counterRemaining: number | null;
  /** 保存時刻(Date.now()) */
  savedAt: number;
}

/** 中断位置を「続きから」として提案する有効期限。
 * おつとめは長くても1時間程度で、翌朝のおつとめに前日の続きを勧めるのは
 * 作法として不自然なため、半日で提案をやめる。 */
export const PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function isProgress(value: unknown): value is GongyoProgress {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.presetId === "string" &&
    typeof v.itemIndex === "number" &&
    Number.isInteger(v.itemIndex) &&
    v.itemIndex >= 0 &&
    typeof v.pageOffset === "number" &&
    Number.isInteger(v.pageOffset) &&
    v.pageOffset >= 0 &&
    (v.counterRemaining === null || typeof v.counterRemaining === "number") &&
    typeof v.savedAt === "number"
  );
}

/** localStorageから中断位置を読む(未保存・壊れた値・非対応環境ではnull) */
export function loadProgress(): GongyoProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProgress(progress: GongyoProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(読誦自体は続けられる)
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上
  }
}

/**
 * 扉に「続きから」を出す価値がある中断位置かどうか。
 * 別の差定のもの・先頭のまま中断したもの・古すぎるものは提案しない。
 *
 * 端末の時計が巻き戻って保存時刻が未来に見える場合は期限切れとは見なさない。
 * 正当な中断位置を拒むほうが、古い位置を提案してしまうより困るため。
 */
export function isResumable(
  progress: GongyoProgress | null,
  presetId: string,
  now: number,
): boolean {
  if (!progress) return false;
  if (progress.presetId !== presetId) return false;
  if (progress.itemIndex === 0 && progress.pageOffset === 0) return false;
  return now - progress.savedAt <= PROGRESS_MAX_AGE_MS;
}
