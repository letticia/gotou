// 記事本文中の外部リンク(典拠リンクを含む)を、アプリの外へ安全に開くための補助。
// wikitextConvert.ts が付与する .external-link / .tenkyo-link に対応する。
// 仕様: docs/tenkyo-spec.md A-2

const NOTICE_KEY = "gotou:external-link-notice";

/**
 * 既知の外部サイトの表示名。確認ダイアログで「どこへ渡るのか」を明示するために使う。
 * markerの判定条件は wikitextConvert.ts の TENKYO_URL_MARKERS と揃えてある
 * (あちらはクラス付与、こちらは表示名の解決と目的が違うため、意図的に別実装)。
 */
const KNOWN_SITES: ReadonlyArray<{ marker: string; name: string }> = [
  { marker: "jozensearch", name: "浄土宗全書テキストデータベース" },
  { marker: "21dzk.l.u-tokyo.ac.jp", name: "SAT大正新脩大藏經テキストデータベース" },
];

/** 既知の典拠DBなら正式名称を、それ以外はnullを返す。 */
export function describeExternalSite(href: string): string | null {
  const low = href.toLowerCase();
  for (const site of KNOWN_SITES) {
    if (low.includes(site.marker)) return site.name;
  }
  return null;
}

/** 初回タップ時の確認ダイアログの文面。 */
export function externalLinkConfirmMessage(href: string): string {
  const name = describeExternalSite(href);
  const where = name ? `外部サイト『${name}』` : "外部サイト";
  return `${where}をブラウザの新しいタブで開きます。よろしいですか?`;
}

/**
 * 外部サイトの内容をアプリ内(iframe)に表示する場合の確認文面。
 * 新しいタブで開く場合と区別する: 見た目はアプリ内でも、読み込んでいるのは
 * 外部サイトそのものであることを利用者に伝える必要がある。
 */
export function externalEmbedConfirmMessage(href: string): string {
  const name = describeExternalSite(href);
  const what = name ? `外部サイト『${name}』` : "外部サイト";
  return `${what}の内容をアプリ内に表示します。読み込むのは外部サイトのページそのものです。よろしいですか?`;
}

/** 確認ダイアログを既に見せたか。localStorageが使えない場合は毎回見せる(安全側)。 */
export function hasSeenExternalLinkNotice(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markExternalLinkNoticeSeen(): void {
  try {
    localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // プライベートブラウズ等で書き込めない場合は諦める(次回も確認が出るだけ)
  }
}
