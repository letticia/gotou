import articlesData from "../fixtures/articles.json";
import { normalizeSearchInput } from "./variants";

interface RawArticle {
  pageid: string;
  title: string;
  wikitext: string;
}

export interface DummyEntry {
  id: number;
  title: string;
  reading: string;
  searchKey: string;
  body: string;
}

// factory/src/wikitext.py の extract_yomi_and_clean_headword と同じ、
// ドキュメント化された「先頭行 `=よみ／見出し=`」規約をTS側で簡易抽出するだけで、
// factoryのwikitext→HTML変換ロジックそのものは持ち込まない(本格変換はfactoryの責務)。
const YOMI_LINE_RE = /^=([^／/=]+)[／/]([^=]+)=$/;

function extractHeadwordAndReading(
  title: string,
  wikitext: string,
): { headword: string; reading: string } {
  const firstLine = wikitext.trim().split("\n")[0]?.trim() ?? "";
  const m = firstLine.match(YOMI_LINE_RE);
  if (m) {
    return { reading: m[1].trim(), headword: m[2].trim() };
  }
  return { headword: title, reading: title };
}

/** factory/tests/fixtures/articles.json (自作ダミー) をプロトタイプ用の形に整える */
export function loadDummyEntries(): DummyEntry[] {
  const articles = articlesData as RawArticle[];
  return articles.map((art) => {
    const { headword, reading } = extractHeadwordAndReading(art.title, art.wikitext);
    return {
      id: Number(art.pageid),
      title: headword,
      reading,
      searchKey: normalizeSearchInput(headword),
      body: art.wikitext,
    };
  });
}
