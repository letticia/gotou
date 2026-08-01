// factory/src/wikitext.py のTypeScript移植。
// 浄土宗大辞典 (MediaWiki) のwikitextをHTMLへ変換する共通ロジック。
// アプリが自分で取得・変換する経路(dictionaryAcquisition.ts)で使う。
// href形式(x-dictionary:r:entry_{id} / リンク切れはx-dictionary:r:{タイトル})は
// internalLinks.tsのparseInternalLinkTargetと厳密に一致させること。

export interface RawArticle {
  pageid: string;
  title: string;
  wikitext: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function quoteAttr(text: string): string {
  return `"${escapeHtml(text).replace(/"/g, "&quot;")}"`;
}

/** XMLで未定義の制御文字や生の&記号を適切にエスケープ */
export function sanitizeXmlString(text: string): string {
  if (!text) return "";
  text = text.replace(/&(?!(?:[a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, "&amp;");
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "");
  return text;
}

/** タイトル文字列から全角スペース・アンダースコア・重複スペースを半角スペース1個に正規化 */
export function normalizeTitleForLookup(title: string): string {
  if (!title) return "";
  let t = title.replace(/　/g, " ").replace(/_/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/** 先頭行の見出しから読み(ふりがな)を抽出 */
export function extractYomiAndCleanHeadword(
  title: string,
  wikitext: string,
): { headword: string; yomi: string } {
  let yomi = "";
  let headword = title;

  if (wikitext) {
    const firstLine = wikitext.trim().split("\n")[0];
    const m = firstLine.trim().match(/^=([^／/=]+)[／/]([^=]+)=$/);
    if (m) {
      yomi = m[1].trim();
      headword = m[2].trim();
    }
  }

  if (!yomi) yomi = title;

  return { headword, yomi };
}

/** MediaWikiのセル文字列 '| 属性 | コンテンツ' を解析して [tagAttributes, content] を返す */
function parseCell(cellStr: string): [string, string] {
  cellStr = cellStr.trim();
  if (cellStr.includes("|") && !cellStr.startsWith("[[")) {
    const idx = cellStr.indexOf("|");
    const attrPart = cellStr.slice(0, idx).trim();
    const contentPart = cellStr.slice(idx + 1).trim();
    if (/(rowspan|colspan|style|align|valign|class)\s*=\s*/i.test(attrPart)) {
      return [attrPart, contentPart];
    }
  }
  return ["", cellStr];
}

/** {| ... |} 形式の MediaWiki 表組み記法を HTML <table> に高度パース変換 */
export function convertMediawikiTables(text: string): string {
  return text.replace(/(\{\|[\s\S]*?\|\})/g, (_match, rawTableGroup: string) => {
    const rawTable = rawTableGroup.trim();
    let lines = rawTable
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0 || !lines[0].startsWith("{|")) return "";

    lines = lines.slice(1);

    type Cell = [string, string, string]; // [tag, attr, content]
    const rows: Cell[][] = [];
    let currentRow: Cell[] = [];
    let caption = "";

    for (const line of lines) {
      if (line === "|}" || line.startsWith("|}")) break;
      if (line.startsWith("|-")) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [];
        }
        continue;
      }
      // |+ キャプション行(データセルとして誤解釈されないよう最優先で判定する)
      if (line.startsWith("|+")) {
        caption = line.slice(2).trim();
        continue;
      }

      if (line.startsWith("!")) {
        const cells = line.slice(1).split("!!");
        for (const c of cells) {
          const [attr, content] = parseCell(c);
          currentRow.push(["th", attr, content]);
        }
      } else if (line.startsWith("|")) {
        const cells = line.slice(1).split("||");
        for (const c of cells) {
          const [attr, content] = parseCell(c);
          currentRow.push(["td", attr, content]);
        }
      }
    }

    if (currentRow.length > 0) rows.push(currentRow);
    if (rows.length === 0) return "";

    const tableHtml = ['<table class="wikitable">'];
    if (caption) {
      tableHtml.push(`  <caption>${caption}</caption>`);
    }
    for (const row of rows) {
      tableHtml.push("  <tr>");
      for (const [tag, attr, content] of row) {
        const attrStr = attr ? ` ${attr}` : "";
        tableHtml.push(`    <${tag}${attrStr}>${content}</${tag}>`);
      }
      tableHtml.push("  </tr>");
    }
    tableHtml.push("</table>");

    // 前後に空行を強制する: 直前直後に空行が無いwikitext(=有効だが一般的な書き方)でも
    // 独立した段落として扱われるようにするため。空行が無いと、後段の段落化処理が
    // 表全体を地の文と同じ1段落とみなし、表内部の改行まですべて<br/>に変換してしまう。
    return `\n\n${tableHtml.join("\n")}\n\n`;
  });
}

/** 箇条書き (* や #) を <ul><li> / <ol><li> に変換 */
export function convertLists(lines: string[]): string[] {
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith("* ")) {
      if (inOl) {
        result.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        result.push("<ul>");
        inUl = true;
      }
      result.push(`<li>${stripped.slice(2).trim()}</li>`);
    } else if (stripped.startsWith("# ")) {
      if (inUl) {
        result.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        result.push("<ol>");
        inOl = true;
      }
      result.push(`<li>${stripped.slice(2).trim()}</li>`);
    } else {
      if (inUl) {
        result.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        result.push("</ol>");
        inOl = false;
      }
      result.push(line);
    }
  }

  if (inUl) result.push("</ul>");
  if (inOl) result.push("</ol>");

  return result;
}

/** 括弧の階層深さ(depth)を正確に計測し、[[File:...[[...]]...]] 全体を完全抽出してHTML画像タグへ変換 */
export function convertNestedImageMarkups(text: string): string {
  let pos = 0;
  for (;;) {
    const rest = text.slice(pos);
    const m = rest.match(/\[\[(?:File|ファイル|画像):/i);
    if (!m || m.index === undefined) break;

    const startIdx = pos + m.index;
    let depth = 0;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      const two = text.slice(i, i + 2);
      if (two === "[[") {
        depth += 1;
      } else if (two === "]]") {
        depth -= 1;
        if (depth === 0) {
          endIdx = i + 2;
          break;
        }
      }
    }

    if (endIdx <= startIdx) {
      pos = startIdx + 2;
      continue;
    }

    while (endIdx < text.length && text[endIdx] === "]") {
      endIdx += 1;
    }

    const fullImgTag = text.slice(startIdx, endIdx);

    const innerContent = fullImgTag.slice(2, -2).trim();
    const parts = innerContent.split("|");

    let rawFilename = parts[0].trim();
    rawFilename = rawFilename.replace(/^(File|ファイル|画像):/i, "").trim();
    let filename = rawFilename.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
    filename = filename.replace(/\[/g, "").replace(/\]/g, "").trim();

    let caption = "";
    for (const p of parts.slice(1).reverse()) {
      const pStrip = p.trim();
      if (!/^(thumb|left|right|center|upright\s*=|\d+px)/i.test(pStrip)) {
        caption = pStrip;
        break;
      }
    }

    if (caption) {
      while (caption.includes("[[") && caption.includes("]]")) {
        caption = caption.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
      }
      caption = caption.replace(/\[/g, "").replace(/\]/g, "").trim();
    }

    const escapedFn = escapeHtml(filename);
    const captionHtml = caption
      ? `<p class="dict-image-caption">${escapeHtml(caption)}</p>`
      : "";

    const htmlReplacement = `<div class="dict-image-container"><img src="${escapedFn}" class="dict-image" alt="${escapedFn}"/>${captionHtml}</div>`;

    text = text.slice(0, startIdx) + htmlReplacement + text.slice(endIdx);
    pos = startIdx + htmlReplacement.length;
  }

  return text;
}

export interface CleanWikitextOptions {
  /** 内部リンクが解決される(target_entry_idが見つかる)たびに呼ばれる */
  linkSink?: (targetEntryId: string) => void;
  /** 内部リンクの参照先がtitleToIdMapに見つからなかったときに呼ばれる */
  brokenLinkSink?: (targetTitle: string) => void;
}

/** Wikitextの全各種記法をHTMLに完全変換 */
export function cleanWikitext(
  text: string,
  titleToIdMap: Map<string, string>,
  options: CleanWikitextOptions = {},
): string {
  const { linkSink, brokenLinkSink } = options;
  if (!text) return "";

  let lines = text.trim().split("\n");
  if (lines.length > 0 && lines[0].startsWith("=") && lines[0].endsWith("=")) {
    lines = lines.slice(1);
  }
  text = lines.join("\n");

  // 1. 魔法単語・HTMLコメントの除去
  text = text.replace(/__NOTOC__|__TOC__|__NOEDITSECTION__/g, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 2. テンプレート {{...}} の除去
  text = text.replace(/\{\{[\s\S]*?\}\}/g, "");

  // 3. 生の & 記号や制御文字を事前にサニタイズ
  text = sanitizeXmlString(text);

  // 4. 画像・ファイル参照 ([[File:...]]) を括弧ネスト完全計測＆末尾]自動吸収で安全変換
  text = convertNestedImageMarkups(text);

  // 5. 表組み {| ... |} の高度変換
  text = convertMediawikiTables(text);

  // 6. セクション見出し (== 見出し == -> <h2 class="dict-section-heading">...)
  // 前後に空行を強制し、直前直後に空行が無いwikitextでも独立した段落として
  // 扱われるようにする(表・水平線と同じ理由。詳細はconvertMediawikiTables参照)
  text = text.replace(/^(={2,4})\s*(.*?)\s*\1$/gm, (_m, eq: string, titleContent: string) => {
    const cleaned = titleContent.replace(/<[^>]+>/g, "").trim();
    const level = eq.length;
    const tag = `h${Math.min(level, 4)}`;
    return `\n\n<${tag} class="dict-section-heading"><span class="no-dict-link">${cleaned}</span></${tag}>\n\n`;
  });

  // 見出しブロック <h2>...</h2> をリンク変換から保護
  const headingPlaceholders = new Map<string, string>();
  text = text.replace(/<h[2-4]\b[^>]*>[\s\S]*?<\/h[2-4]>/g, (m) => {
    const ph = `___HEADING_PROTECTED_${headingPlaceholders.size}___`;
    headingPlaceholders.set(ph, m);
    return ph;
  });

  // 7. 水平線 (----) -> <hr class="section-divider"/>
  // 前後に空行を強制する(表・見出しと同じ理由)
  text = text.replace(/^\s*----\s*$/gm, '\n\n<hr class="section-divider"/>\n\n');

  // 8. 外部リンク [http://... 表示テキスト]
  text = text.replace(
    /\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,
    (_m, url: string, label: string) => {
      url = url.trim();
      label = label.trim();
      label = label.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1");
      label = label.replace(/\[/g, "").replace(/\]/g, "");
      return `<a class="external-link" href=${quoteAttr(url)}>${escapeHtml(label)}</a>`;
    },
  );

  // 9. 外部リンク [http://...]
  text = text.replace(/\[(https?:\/\/[^\s\]]+)\]/g, (_m, url: string) => {
    url = url.trim();
    return `<a class="external-link" href=${quoteAttr(url)}>${escapeHtml(url)}</a>`;
  });

  // 10. 内部リンク [[タイトル|表示テキスト]]
  text = text.replace(/\[\[(.*?)\]\]/g, (_m, content: string) => {
    let target: string;
    let label: string;
    if (content.includes("|")) {
      const idx = content.indexOf("|");
      target = content.slice(0, idx);
      label = content.slice(idx + 1);
    } else {
      target = content;
      label = content;
    }
    target = target.trim();
    label = label.trim();

    const normTarget = normalizeTitleForLookup(target);
    const targetEntryId =
      titleToIdMap.get(target) ??
      titleToIdMap.get(normTarget) ??
      titleToIdMap.get(normTarget.replace(/ /g, ""));

    let href: string;
    if (targetEntryId) {
      href = `x-dictionary:r:${targetEntryId}`;
      linkSink?.(targetEntryId);
    } else {
      href = `x-dictionary:r:${escapeHtml(target)}`;
      brokenLinkSink?.(target);
    }

    return `<a class="internal-link" href=${quoteAttr(href)}>${escapeHtml(label)}</a>`;
  });

  // 見出し保護を解除
  for (const [ph, originalHtml] of headingPlaceholders) {
    text = text.replace(ph, originalHtml);
  }

  // 11. 生の URL (既存の <a> タグ外にあるもの) を安全に自動リンク化
  const tokens = text.split(/(<a\s+[^>]*>[\s\S]*?<\/a>)/);
  const newTokens = tokens.map((token) => {
    if (token.startsWith("<a")) return token;
    return token.replace(
      /https?:\/\/[^\s<>)\]"'`　-〿぀-ゟ゠-ヿ一-龯]+/g,
      (url) => `<a class="external-link" href=${quoteAttr(url)}>${escapeHtml(url)}</a>`,
    );
  });
  text = newTokens.join("");

  // 12. 強調 '''bold''' -> <b>bold</b>, 斜体 ''italic'' -> <i>italic</i>
  text = text.replace(/'''(.*?)'''/g, "<b>$1</b>");
  text = text.replace(/''(.*?)''/g, "<i>$1</i>");

  // 13. 箇条書き (* / #) のパース
  lines = text.split("\n");
  lines = convertLists(lines);
  text = lines.join("\n");

  // 14. 段落化 (HTMLブロックタグ周辺を保護しつつ段落生成)
  const paragraphs = text.split("\n\n");
  const formattedP: string[] = [];
  const blockTags = ["<table", "<h2", "<h3", "<h4", "<hr", "<ul", "<ol", "<div"];
  for (const p of paragraphs) {
    let pClean = p.trim();
    if (blockTags.some((tag) => pClean.startsWith(tag))) {
      formattedP.push(pClean);
    } else {
      pClean = pClean.replace(/\n/g, "<br/>");
      if (pClean) formattedP.push(`<p>${pClean}</p>`);
    }
  }

  return formattedP.join("");
}

/** 記事リストから「タイトル(原題/正規化/見出し語)→entry_id」の逆引きマップを構築する */
export function buildTitleIdMap(articles: RawArticle[]): Map<string, string> {
  const titleToIdMap = new Map<string, string>();
  for (const art of articles) {
    const pageid = art.pageid ?? "";
    const title = (art.title ?? "").trim();
    const wikitext = art.wikitext ?? "";
    if (title && pageid) {
      const entryId = `entry_${pageid}`;
      titleToIdMap.set(title, entryId);
      const normT = normalizeTitleForLookup(title);
      titleToIdMap.set(normT, entryId);

      const { headword } = extractYomiAndCleanHeadword(title, wikitext);
      if (headword) {
        titleToIdMap.set(headword, entryId);
        const normH = normalizeTitleForLookup(headword);
        titleToIdMap.set(normH, entryId);
      }
    }
  }
  return titleToIdMap;
}
