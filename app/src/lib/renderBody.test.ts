import { describe, expect, it } from "vitest";
import { parseBody } from "./renderBody";

describe("parseBody", () => {
  it("strips the leading `=よみ／見出し=` line", () => {
    const paragraphs = parseBody("=よみ／タイトル=\n本文です。", new Map());
    expect(paragraphs).toEqual([[{ kind: "text", text: "本文です。" }]]);
  });

  it("splits paragraphs on blank lines", () => {
    const paragraphs = parseBody("=よみ／タイトル=\n段落一。\n\n段落二。", new Map());
    expect(paragraphs).toEqual([
      [{ kind: "text", text: "段落一。" }],
      [{ kind: "text", text: "段落二。" }],
    ]);
  });

  it("resolves a known internal link", () => {
    const titleToId = new Map([["リンク先", 42]]);
    const paragraphs = parseBody("=よみ／タイトル=\n[[リンク先]]を参照。", titleToId);
    expect(paragraphs[0]).toEqual([
      { kind: "link", label: "リンク先", targetId: 42 },
      { kind: "text", text: "を参照。" },
    ]);
  });

  it("supports piped link labels", () => {
    const titleToId = new Map([["リンク先", 42]]);
    const paragraphs = parseBody("=よみ／タイトル=\n[[リンク先|表示名]]を参照。", titleToId);
    expect(paragraphs[0][0]).toEqual({ kind: "link", label: "表示名", targetId: 42 });
  });

  it("marks an unresolved internal link as broken (targetId: null)", () => {
    const paragraphs = parseBody("=よみ／タイトル=\n[[存在しない項目]]を参照。", new Map());
    expect(paragraphs[0][0]).toEqual({ kind: "link", label: "存在しない項目", targetId: null });
  });

  it("resolves a link via normalized (variant-kanji) title", () => {
    const titleToId = new Map([["仏教大学", 7]]);
    const paragraphs = parseBody("=よみ／タイトル=\n[[佛教大学]]について。", titleToId);
    expect(paragraphs[0][0]).toEqual({ kind: "link", label: "佛教大学", targetId: 7 });
  });

  it("converts bold and italic markup", () => {
    const paragraphs = parseBody("=よみ／タイトル=\n'''太字'''と''斜体''。", new Map());
    expect(paragraphs[0]).toEqual([
      { kind: "bold", text: "太字" },
      { kind: "text", text: "と" },
      { kind: "italic", text: "斜体" },
      { kind: "text", text: "。" },
    ]);
  });
});
