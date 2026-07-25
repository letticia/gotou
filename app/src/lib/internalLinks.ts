// factory/src/wikitext.py が生成する内部リンクのhref形式:
// 解決できた場合   x-dictionary:r:entry_{id}
// リンク切れの場合  x-dictionary:r:{タイトル}(entry_で始まらない)
const RESOLVED_HREF_RE = /^x-dictionary:r:entry_(\d+)$/;

/** 内部リンクのhrefから遷移先のentries.idを取り出す。リンク切れならnull。 */
export function parseInternalLinkTarget(href: string): number | null {
  const m = href.match(RESOLVED_HREF_RE);
  return m ? Number(m[1]) : null;
}
