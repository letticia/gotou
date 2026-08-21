import { describe, expect, it } from "vitest";
import {
  buildTitleIdMap,
  cleanWikitext,
  extractYomiAndCleanHeadword,
  normalizeTitleForLookup,
} from "./wikitextConvert";
import type { RawArticle } from "./wikitextConvert";

describe("normalizeTitleForLookup", () => {
  it("collapses full-width spaces, underscores, and repeated spaces into single half-width spaces", () => {
    expect(normalizeTitleForLookup("阿弥陀　仏_如来  経")).toBe("阿弥陀 仏 如来 経");
  });

  it("returns an empty string for falsy input", () => {
    expect(normalizeTitleForLookup("")).toBe("");
  });
});

describe("extractYomiAndCleanHeadword", () => {
  it("extracts yomi/headword from a leading '=よみ／見出し=' line", () => {
    const result = extractYomiAndCleanHeadword("阿弥陀仏", "=あみだぶつ／阿弥陀仏=\n本文...");
    expect(result).toEqual({ headword: "阿弥陀仏", yomi: "あみだぶつ" });
  });

  it("falls back to the title as yomi when there is no yomi line", () => {
    const result = extractYomiAndCleanHeadword("阿弥陀仏", "本文だけで先頭行に=よみ=が無い");
    expect(result).toEqual({ headword: "阿弥陀仏", yomi: "阿弥陀仏" });
  });
});

describe("cleanWikitext", () => {
  const emptyMap = new Map<string, string>();

  it("returns an empty string for empty input", () => {
    expect(cleanWikitext("", emptyMap)).toBe("");
  });

  it("converts bold and italic emphasis, wrapped in a paragraph", () => {
    expect(cleanWikitext("'''太字'''と''斜体''", emptyMap)).toBe(
      "<p><b>太字</b>と<i>斜体</i></p>",
    );
  });

  it("resolves an internal link found in the title map and reports it via linkSink", () => {
    const map = new Map([["阿弥陀仏", "entry_42"]]);
    const linked: string[] = [];
    const html = cleanWikitext("[[阿弥陀仏]]について", map, {
      linkSink: (id) => linked.push(id),
    });
    expect(html).toBe(
      '<p><a class="internal-link" href="x-dictionary:r:entry_42">阿弥陀仏</a>について</p>',
    );
    expect(linked).toEqual(["entry_42"]);
  });

  it("falls back to a title-based href and reports it via brokenLinkSink when unresolved", () => {
    const broken: string[] = [];
    const html = cleanWikitext("[[存在しない項目]]", emptyMap, {
      brokenLinkSink: (title) => broken.push(title),
    });
    expect(html).toBe(
      '<p><a class="internal-link" href="x-dictionary:r:存在しない項目">存在しない項目</a></p>',
    );
    expect(broken).toEqual(["存在しない項目"]);
  });

  it("converts an internal link with a display label", () => {
    const map = new Map([["阿弥陀仏", "entry_1"]]);
    const html = cleanWikitext("[[阿弥陀仏|みだぶつ]]", map);
    expect(html).toBe('<p><a class="internal-link" href="x-dictionary:r:entry_1">みだぶつ</a></p>');
  });

  it("converts an external link with a display label", () => {
    const html = cleanWikitext("[https://example.com 例]", emptyMap);
    expect(html).toBe('<p><a class="external-link" href="https://example.com">例</a></p>');
  });

  it("converts a bare external link", () => {
    const html = cleanWikitext("[https://example.com]", emptyMap);
    expect(html).toBe(
      '<p><a class="external-link" href="https://example.com">https://example.com</a></p>',
    );
  });

  it("auto-links a bare URL and stops before trailing Japanese text", () => {
    const html = cleanWikitext("https://example.com を見よ", emptyMap);
    expect(html).toBe(
      '<p><a class="external-link" href="https://example.com">https://example.com</a> を見よ</p>',
    );
  });

  // --- 典拠リンク(docs/tenkyo-spec.md A-1) ---------------------------------
  // factory/tests/test_wikitext.py の同名ケースと対応させること。
  // URLの形は本物だが、記事本文は一切使わず自作のダミー文で組み立てている。

  it("marks a Jozen DB link as a tenkyo link and upgrades it to https", () => {
    const html = cleanWikitext(
      "[http://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508 浄全九・五〇八上]",
      emptyMap,
    );
    expect(html).toBe(
      '<p><a class="external-link tenkyo-link" href="https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508">浄全九・五〇八上</a></p>',
    );
  });

  it("marks a SAT link as a tenkyo link and upgrades it to https", () => {
    const html = cleanWikitext(
      "[http://21dzk.l.u-tokyo.ac.jp/SAT2018/V51.0861a.html 正蔵五一・八六一上]",
      emptyMap,
    );
    expect(html).toBe(
      '<p><a class="external-link tenkyo-link" href="https://21dzk.l.u-tokyo.ac.jp/SAT2018/V51.0861a.html">正蔵五一・八六一上</a></p>',
    );
  });

  it("leaves a non-tenkyo external link unmarked and does not rewrite its scheme", () => {
    const html = cleanWikitext("[http://example.com/foo 例]", emptyMap);
    expect(html).toBe('<p><a class="external-link" href="http://example.com/foo">例</a></p>');
  });

  it("marks a bare tenkyo link and displays the upgraded URL", () => {
    const html = cleanWikitext(
      "[http://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=Z15_0203]",
      emptyMap,
    );
    expect(html).toBe(
      '<p><a class="external-link tenkyo-link" href="https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=Z15_0203">https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=Z15_0203</a></p>',
    );
  });

  it("marks an auto-linked raw tenkyo URL", () => {
    const html = cleanWikitext(
      "参照 https://21dzk.l.u-tokyo.ac.jp/SAT2018/V39.0586b.html",
      emptyMap,
    );
    expect(html).toContain('class="external-link tenkyo-link"');
  });

  it("converts a bullet list without wrapping it in a paragraph", () => {
    const html = cleanWikitext("* 項目1\n* 項目2", emptyMap);
    expect(html).toBe("<ul>\n<li>項目1</li>\n<li>項目2</li>\n</ul>");
  });

  it("converts a section heading without wrapping it in a paragraph", () => {
    // 先頭行は「=よみ／見出し=」形式のタイトル行とみなされ除去されるため、
    // 実際の記事同様、見出しの前に空行区切りのダミー本文段落を置く
    const html = cleanWikitext("本文\n\n== 見出し ==", emptyMap);
    expect(html).toBe(
      '<p>本文</p><h2 class="dict-section-heading"><span class="no-dict-link">見出し</span></h2>',
    );
  });

  it("converts a MediaWiki table", () => {
    const wikitext = "{|\n! 見出しA !! 見出しB\n|-\n| セルA || セルB\n|}";
    const html = cleanWikitext(wikitext, emptyMap);
    expect(html).toBe(
      '<table class="wikitable">\n' +
        "  <tr>\n" +
        "    <th>見出しA</th>\n" +
        "    <th>見出しB</th>\n" +
        "  </tr>\n" +
        "  <tr>\n" +
        "    <td>セルA</td>\n" +
        "    <td>セルB</td>\n" +
        "  </tr>\n" +
        "</table>",
    );
  });

  it("converts a table caption (|+) instead of misreading it as a data cell", () => {
    const wikitext = "{|\n|+ 表題\n! 見出しA\n|-\n| セルA\n|}";
    const html = cleanWikitext(wikitext, emptyMap);
    expect(html).toBe(
      '<table class="wikitable">\n' +
        "  <caption>表題</caption>\n" +
        "  <tr>\n" +
        "    <th>見出しA</th>\n" +
        "  </tr>\n" +
        "  <tr>\n" +
        "    <td>セルA</td>\n" +
        "  </tr>\n" +
        "</table>",
    );
  });

  it("keeps a table as its own block even when not preceded by a blank line (no stray <br/> from merging with the preceding prose)", () => {
    const wikitext = "本文の続き。\n{|\n! 見出しA\n|-\n| セルA\n|}";
    const html = cleanWikitext(wikitext, emptyMap);
    expect(html).toBe(
      "<p>本文の続き。</p>" +
        '<table class="wikitable">\n' +
        "  <tr>\n" +
        "    <th>見出しA</th>\n" +
        "  </tr>\n" +
        "  <tr>\n" +
        "    <td>セルA</td>\n" +
        "  </tr>\n" +
        "</table>",
    );
  });

  it("keeps a heading as its own block even when not preceded by a blank line", () => {
    const html = cleanWikitext("本文\n== 見出し ==\n続きの本文", emptyMap);
    expect(html).toBe(
      "<p>本文</p>" +
        '<h2 class="dict-section-heading"><span class="no-dict-link">見出し</span></h2>' +
        "<p>続きの本文</p>",
    );
  });

  it("keeps a horizontal rule as its own block even when not preceded by a blank line", () => {
    const html = cleanWikitext("本文\n----\n続きの本文", emptyMap);
    expect(html).toBe(
      '<p>本文</p><hr class="section-divider"/><p>続きの本文</p>',
    );
  });

  it("converts an image reference with a caption, without wrapping it in a paragraph", () => {
    const html = cleanWikitext("[[File:test.jpg|thumb|キャプション]]", emptyMap);
    expect(html).toBe(
      '<div class="dict-image-container"><img src="test.jpg" class="dict-image" alt="test.jpg"/>' +
        '<p class="dict-image-caption">キャプション</p></div>',
    );
  });

  it("strips the leading '=タイトル=' line before conversion", () => {
    const html = cleanWikitext("=あみだぶつ／阿弥陀仏=\n本文です", emptyMap);
    expect(html).toBe("<p>本文です</p>");
  });
});

describe("buildTitleIdMap", () => {
  it("maps the original title, normalized title, headword, and normalized headword to entry_{pageid}", () => {
    const articles: RawArticle[] = [
      {
        pageid: "42",
        title: "阿弥陀　仏",
        wikitext: "=あみだぶつ／阿弥陀仏=\n本文",
      },
    ];
    const map = buildTitleIdMap(articles);
    expect(map.get("阿弥陀　仏")).toBe("entry_42");
    expect(map.get("阿弥陀 仏")).toBe("entry_42");
    expect(map.get("阿弥陀仏")).toBe("entry_42");
  });

  it("skips articles without a title or pageid", () => {
    const articles: RawArticle[] = [{ pageid: "", title: "無効", wikitext: "" }];
    const map = buildTitleIdMap(articles);
    expect(map.size).toBe(0);
  });
});
