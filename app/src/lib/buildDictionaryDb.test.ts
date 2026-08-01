import { describe, expect, it } from "vitest";
import { buildDictionaryDb, htmlToText } from "./buildDictionaryDb";
import { openDatabaseFromBytes } from "./db";
import type { RawArticle } from "./wikitextConvert";

describe("htmlToText", () => {
  it("strips tags, unescapes entities, and collapses whitespace", () => {
    expect(htmlToText('<p>光明&amp;<b>徧照</b>　十方世界</p>')).toBe("光明& 徧照 十方世界");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});

describe("buildDictionaryDb", () => {
  const articles: RawArticle[] = [
    {
      pageid: "1",
      title: "阿弥陀仏",
      wikitext: "=あみだぶつ／阿弥陀仏=\n西方極楽浄土の教主。[[観音菩薩]]を脇侍とする。",
    },
    {
      pageid: "2",
      title: "観音菩薩",
      wikitext: "=かんのんぼさつ／観音菩薩=\n[[阿弥陀仏]]の脇侍。慈悲の菩薩。",
    },
    {
      pageid: "3",
      title: "読み欠落項目",
      wikitext: "先頭行に読み行が無い記事。[[存在しない項目]]へのリンクを含む。",
    },
  ];

  it("builds a queryable SQLite DB (round-trip via openDatabaseFromBytes) with correct stats", async () => {
    const { bytes, stats } = await buildDictionaryDb(articles);

    expect(stats).toEqual({
      entriesCount: 3,
      missingReadingCount: 1,
      linksCount: 2, // 1->2, 2->1 (存在しない項目 は未解決なのでlinksに含まれない)
      brokenLinksCount: 1,
    });

    const db = openDatabaseFromBytes(bytes);
    const opened = await db;
    try {
      const results = opened.searchByPrefix("あみだぶつ");
      expect(results).toEqual([{ id: 1, title: "阿弥陀仏", reading: "あみだぶつ" }]);

      const entry = opened.getEntry(1);
      expect(entry?.title).toBe("阿弥陀仏");
      expect(entry?.bodyHtml).toContain(
        '<a class="internal-link" href="x-dictionary:r:entry_2">観音菩薩</a>',
      );

      const brokenEntry = opened.getEntry(3);
      expect(brokenEntry?.reading).toBeNull();
      expect(brokenEntry?.bodyHtml).toContain(
        '<a class="internal-link" href="x-dictionary:r:存在しない項目">存在しない項目</a>',
      );
    } finally {
      opened.close();
    }
  });

  it("skips articles missing a title or pageid", async () => {
    const { stats } = await buildDictionaryDb([
      { pageid: "", title: "無効", wikitext: "" },
      ...articles,
    ]);
    expect(stats.entriesCount).toBe(3);
  });
});
