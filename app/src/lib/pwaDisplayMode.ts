/** PWAとしてホーム画面等にインストールされ、standaloneモードで起動しているかどうかを判定する。
 * Android/デスクトップChrome等は`display-mode`メディアクエリで、iOS Safariの
 * ホーム画面起動は`navigator.standalone`でしか判定できないため両方見る。 */
export function isStandalonePwa(win: Window = window): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const standaloneMedia = win.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return standaloneMedia || nav.standalone === true;
}
