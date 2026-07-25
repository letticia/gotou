import { normalizeSearchInput } from "./variants";

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "link"; label: string; targetId: number | null };

const YOMI_LINE_RE = /^=([^／/=]+)[／/]([^=]+)=$/;
const LINK_RE = /\[\[([^\]]+)\]\]/g;
const BOLD_RE = /'''(.+?)'''/g;
const ITALIC_RE = /''(.+?)''/g;

function stripYomiLine(wikitext: string): string {
  const lines = wikitext.trim().split("\n");
  if (lines.length > 0 && YOMI_LINE_RE.test(lines[0].trim())) {
    return lines.slice(1).join("\n");
  }
  return wikitext.trim();
}

function resolveTarget(target: string, titleToId: Map<string, number>): number | null {
  return titleToId.get(target) ?? titleToId.get(normalizeSearchInput(target)) ?? null;
}

function parseEmphasis(text: string): Segment[] {
  // 太字を先に切り出し、残ったプレーンテキスト断片ごとに斜体を切り出す。
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(BOLD_RE)) {
    const [full, inner] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(...parseItalic(text.slice(lastIndex, index)));
    }
    segments.push({ kind: "bold", text: inner });
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) {
    segments.push(...parseItalic(text.slice(lastIndex)));
  }
  return segments;
}

function parseItalic(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(ITALIC_RE)) {
    const [full, inner] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, index) });
    }
    segments.push({ kind: "italic", text: inner });
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return segments;
}

function parseParagraph(text: string, titleToId: Map<string, number>): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [full, content] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(...parseEmphasis(text.slice(lastIndex, index)));
    }
    const [rawTarget, rawLabel] = content.includes("|") ? content.split("|", 2) : [content, content];
    const target = rawTarget.trim();
    const label = rawLabel.trim();
    segments.push({ kind: "link", label, targetId: resolveTarget(target, titleToId) });
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) {
    segments.push(...parseEmphasis(text.slice(lastIndex)));
  }
  return segments;
}

/**
 * 生wikitextを段落ごとのSegment配列に変換する(プロトタイプ用の最小整形)。
 * 対応: 先頭よみ行の除去・段落分割・内部リンク・太字・斜体のみ。
 * 表・画像・外部リンク・見出し・水平線・箇条書きの記法は変換せずプレーンテキストのまま残す
 * (本格変換はfactory側body_htmlの責務。詳細はdocs/handoff.md参照)。
 */
export function parseBody(wikitext: string, titleToId: Map<string, number>): Segment[][] {
  const body = stripYomiLine(wikitext);
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((paragraph) => parseParagraph(paragraph, titleToId));
}
