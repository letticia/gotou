import type { DummyEntry } from "./dummyEntries";
import { parseBody } from "./renderBody";

export interface EntryRowTuple {
  id: number;
  title: string;
  reading: string;
  searchKey: string;
  bodyHtml: string;
}

/**
 * ダミーfixtureからshared/schema.sqlのentries/entries_fts/links行を組み立てる純粋関数。
 * リンク抽出は新規に書かず、既存のparseBody(renderBody.ts)が解決した結果を再利用する
 * (二重実装を避ける)。body_htmlには本物のHTMLではなく生wikitextをそのまま入れる
 * (本格的なHTML変換はfactoryの責務。詳細はdocs/handoff.md参照)。
 *
 * Vite専用構文(?raw等)に依存しないため、ブラウザ側(db.ts)とNode製の
 * scripts/build-dummy-db.mts の両方からimportできる。
 */
export function buildDummyRows(
  entries: DummyEntry[],
  titleToId: Map<string, number>,
): { entryRows: EntryRowTuple[]; linkPairs: [number, number][] } {
  const entryRows: EntryRowTuple[] = [];
  const linkPairs: [number, number][] = [];

  for (const entry of entries) {
    entryRows.push({
      id: entry.id,
      title: entry.title,
      reading: entry.reading,
      searchKey: entry.searchKey,
      bodyHtml: entry.body,
    });

    const segments = parseBody(entry.body, titleToId).flat();
    for (const segment of segments) {
      if (segment.kind === "link" && segment.targetId !== null) {
        linkPairs.push([entry.id, segment.targetId]);
      }
    }
  }

  return { entryRows, linkPairs };
}
