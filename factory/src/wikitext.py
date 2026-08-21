#!/usr/bin/env python3
"""
wikitext.py
浄土宗大辞典 (MediaWiki) のwikitextをHTMLへ変換する共通ロジック。
build_apple_dict.py (.Dictionary出力) と build_sqlite.py (SQLite出力) の両方から使う。
"""

import re
import xml.sax.saxutils as saxutils


# --- 典拠リンク(docs/tenkyo-spec.md A-1) ---------------------------------
# 大辞典のwikitextには、浄土宗全書テキストDB(浄全DB)とSAT大正蔵への外部リンクが
# 既に埋め込まれている(A-0調査で浄全DB 2,486件・SAT 1,477件を確認)。これらを
# 通常の外部リンクと区別できるよう、typo安全な単純部分一致で判定して
# tenkyo-link クラスを付ける。判定条件・出力は
# app/src/lib/wikitextConvert.ts の同名処理と厳密に一致させること。
TENKYO_URL_MARKERS = ("jozensearch", "21dzk.l.u-tokyo.ac.jp")


def is_tenkyo_url(url):
    """典拠DB(浄全DB・SAT)へのURLかどうか"""
    low = url.lower()
    return any(marker in low for marker in TENKYO_URL_MARKERS)


def normalize_tenkyo_url(url):
    """典拠DBは両サイトともhttpsで配信されているため http:// を https:// へ引き上げる。

    大辞典側の記述は http:// のままだが、アプリ自体がhttpsで配信されるため、
    典拠へ渡る導線だけでも安全な経路にしておく。判定済みの2ホストにのみ適用し、
    未検証のホストは書き換えない。
    """
    if is_tenkyo_url(url) and url.lower().startswith("http://"):
        return "https://" + url[len("http://"):]
    return url


def external_link_html(url, label=None):
    """外部リンクの<a>を組み立てる。labelを省略するとURL自体を表示に使う。"""
    url = normalize_tenkyo_url(url.strip())
    if label is None:
        label = url
    css_class = "external-link tenkyo-link" if is_tenkyo_url(url) else "external-link"
    return f'<a class="{css_class}" href={saxutils.quoteattr(url)}>{saxutils.escape(label)}</a>'


def sanitize_xml_string(text):
    """XMLで未定義の制御文字や生の&記号を適切にエスケープ"""
    if not text:
        return ""
    text = re.sub(r'&(?!(?:[a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);)', '&amp;', text)
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', text)
    return text

def normalize_title_for_lookup(title):
    """タイトル文字列から全角スペース・アンダースコア・重複スペースを半角スペース1個に正規化"""
    if not title:
        return ""
    t = title.replace("　", " ").replace("_", " ")
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def extract_yomi_and_clean_headword(title, wikitext):
    """先頭行の見出しから読み（ふりがな）を抽出"""
    yomi = ""
    headword = title

    if wikitext:
        first_line = wikitext.strip().split("\n")[0]
        m = re.match(r'^=([^／\/=]+)[／\/]([^=]+)=$', first_line.strip())
        if m:
            yomi = m.group(1).strip()
            headword = m.group(2).strip()

    if not yomi:
        yomi = title

    return headword, yomi

def parse_cell(cell_str):
    """MediaWikiのセル文字列 '| 属性 | コンテンツ' を解析して (tag_attributes, content) を返す"""
    cell_str = cell_str.strip()
    if "|" in cell_str and not cell_str.startswith("[["):
        parts = cell_str.split("|", 1)
        attr_part = parts[0].strip()
        content_part = parts[1].strip()
        if re.search(r'(rowspan|colspan|style|align|valign|class)\s*=\s*', attr_part, re.IGNORECASE):
            return attr_part, content_part
    return "", cell_str

def convert_mediawiki_tables(text):
    """{| ... |} 形式の MediaWiki 表組み記法を HTML <table> に高度パース変換"""
    def replace_table(match):
        raw_table = match.group(1).strip()
        lines = [line.strip() for line in raw_table.split("\n") if line.strip()]

        if not lines or not lines[0].startswith("{|"):
            return ""

        lines = lines[1:]  # {| 行を除去

        rows = []
        current_row = []
        caption = ""

        for line in lines:
            if line == "|}" or line.startswith("|}"):
                break
            if line.startswith("|-"):
                if current_row:
                    rows.append(current_row)
                    current_row = []
                continue
            # |+ キャプション行(データセルとして誤解釈されないよう最優先で判定する)
            if line.startswith("|+"):
                caption = line[2:].strip()
                continue

            if line.startswith("!"):
                cells = line[1:].split("!!")
                for c in cells:
                    attr, content = parse_cell(c)
                    current_row.append(("th", attr, content))
            elif line.startswith("|"):
                cells = line[1:].split("||")
                for c in cells:
                    attr, content = parse_cell(c)
                    current_row.append(("td", attr, content))

        if current_row:
            rows.append(current_row)

        if not rows:
            return ""

        table_html = ['<table class="wikitable">']
        if caption:
            table_html.append(f'  <caption>{caption}</caption>')
        for row in rows:
            table_html.append('  <tr>')
            for tag, attr, content in row:
                attr_str = f" {attr}" if attr else ""
                table_html.append(f'    <{tag}{attr_str}>{content}</{tag}>')
            table_html.append('  </tr>')
        table_html.append('</table>')

        # 前後に空行を強制する: 直前直後に空行が無いwikitext(=有効だが一般的な書き方)でも
        # 独立した段落として扱われるようにするため。空行が無いと、後段の段落化処理が
        # 表全体を地の文と同じ1段落とみなし、表内部の改行まですべて<br/>に変換してしまう。
        return "\n\n" + "\n".join(table_html) + "\n\n"

    return re.sub(r'(\{\|.*?\|\})', replace_table, text, flags=re.DOTALL)

def convert_lists(lines):
    """箇条書き (* や #) を <ul><li> / <ol><li> に変換"""
    result = []
    in_ul = False
    in_ol = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("* "):
            if in_ol:
                result.append("</ol>")
                in_ol = False
            if not in_ul:
                result.append("<ul>")
                in_ul = True
            result.append(f"<li>{stripped[2:].strip()}</li>")
        elif stripped.startswith("# "):
            if in_ul:
                result.append("</ul>")
                in_ul = False
            if not in_ol:
                result.append("<ol>")
                in_ol = True
            result.append(f"<li>{stripped[2:].strip()}</li>")
        else:
            if in_ul:
                result.append("</ul>")
                in_ul = False
            if in_ol:
                result.append("</ol>")
                in_ol = False
            result.append(line)

    if in_ul:
        result.append("</ul>")
    if in_ol:
        result.append("</ol>")

    return result

def convert_nested_image_markups(text):
    """括弧の階層深さ(depth)を正確に計測し、[[File:...[[...]]...]] 全体を完全抽出してHTML画像タグへ変換。無限ループ防止を強化"""
    pos = 0
    while True:
        m = re.search(r'\[\[(?:File|ファイル|画像):', text[pos:], re.IGNORECASE)
        if not m:
            break

        start_idx = pos + m.start()
        depth = 0
        end_idx = -1

        for i in range(start_idx, len(text)):
            if text[i:i+2] == '[[':
                depth += 1
            elif text[i:i+2] == ']]':
                depth -= 1
                if depth == 0:
                    end_idx = i + 2
                    break

        # 閉じ ]] が見つからなかった場合、または正しく更新されなかった場合、インデックスを強制進行して無限ループを防止
        if end_idx <= start_idx:
            pos = start_idx + 2
            continue

        # 画像構文の直後にある浮遊した閉じ角括弧 ']' を自動一括クリア
        while end_idx < len(text) and text[end_idx] == ']':
            end_idx += 1

        full_img_tag = text[start_idx:end_idx]

        inner_content = full_img_tag[2:-2].strip()
        parts = inner_content.split('|')

        raw_filename = parts[0].strip()
        raw_filename = re.sub(r'^(File|ファイル|画像):', '', raw_filename, flags=re.IGNORECASE).strip()
        filename = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', raw_filename)
        filename = filename.replace('[', '').replace(']', '').strip()

        caption = ""
        for p in reversed(parts[1:]):
            p_strip = p.strip()
            if not re.match(r'^(thumb|left|right|center|upright\s*=|\d+px)', p_strip, re.IGNORECASE):
                caption = p_strip
                break

        if caption:
            while '[[' in caption and ']]' in caption:
                caption = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', caption)
            caption = caption.replace('[', '').replace(']', '').strip()

        escaped_fn = saxutils.escape(filename)
        caption_html = f'<p class="dict-image-caption">{saxutils.escape(caption)}</p>' if caption else ''

        html_replacement = f'<div class="dict-image-container"><img src="{escaped_fn}" class="dict-image" alt="{escaped_fn}"/>{caption_html}</div>'

        text = text[:start_idx] + html_replacement + text[end_idx:]
        pos = start_idx + len(html_replacement)

    return text

def clean_wikitext(text, title_to_id_map, link_sink=None, broken_link_sink=None):
    """Wikitextの全各種記法をHTMLに完全変換

    link_sink: 内部リンクが解決される (target_entry_id が見つかる) たびに
    link_sink(target_entry_id) を呼ぶオプションのコールバック。呼び出し側は
    これを使ってlinksテーブルなどの外部データ構造にリンクを収集できる。
    broken_link_sink: 内部リンクの参照先が title_to_id_map に見つからなかったとき、
    broken_link_sink(target_title) を呼ぶオプションのコールバック。
    """
    if not text:
        return ""

    lines = text.strip().split("\n")
    if lines and lines[0].startswith("=") and lines[0].endswith("="):
        lines = lines[1:]
    text = "\n".join(lines)

    # 1. 魔法単語・HTMLコメントの除去
    text = re.sub(r'__NOTOC__|__TOC__|__NOEDITSECTION__', '', text)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)

    # 2. テンプレート {{...}} の除去
    text = re.sub(r'\{\{.*?\}\}', '', text, flags=re.DOTALL)

    # 3. 生の & 記号や制御文字を事前にサニタイズ
    text = sanitize_xml_string(text)

    # 4. 画像・ファイル参照 ([[File:...]]) を括弧ネスト完全計測＆末尾]自動吸収で安全変換
    text = convert_nested_image_markups(text)

    # 5. 表組み {| ... |} の高度変換
    text = convert_mediawiki_tables(text)

    # 6. セクション見出し (== 見出し == -> <h2 class="dict-section-heading"><span class="no-dict-link">見出し</span></h2>)
    # 前後に空行を強制し、直前直後に空行が無いwikitextでも独立した段落として
    # 扱われるようにする(表・水平線と同じ理由。詳細はconvert_mediawiki_tables参照)
    def replace_heading(m):
        eq = m.group(1)
        title_content = m.group(2).strip()
        title_content = re.sub(r'<[^>]+>', '', title_content).strip()
        level = len(eq)
        tag = f"h{min(level, 4)}"
        return f'\n\n<{tag} class="dict-section-heading"><span class="no-dict-link">{title_content}</span></{tag}>\n\n'

    text = re.sub(r'^(={2,4})\s*(.*?)\s*\1$', replace_heading, text, flags=re.MULTILINE)

    # 見出しブロック <h2>...</h2> をリンク変換から保護
    heading_placeholders = {}
    def protect_headings(m):
        idx = len(heading_placeholders)
        ph = f"___HEADING_PROTECTED_{idx}___"
        heading_placeholders[ph] = m.group(0)
        return ph

    text = re.sub(r'<h[2-4]\b[^>]*>.*?</h[2-4]>', protect_headings, text, flags=re.DOTALL)

    # 7. 水平線 (----) -> <hr class="section-divider"/>
    # 前後に空行を強制する(表・見出しと同じ理由)
    text = re.sub(r'^\s*----\s*$', '\n\n<hr class="section-divider"/>\n\n', text, flags=re.MULTILINE)

    # 8. 外部リンク [http://... 表示テキスト]
    def replace_ext_link_text(m):
        url = m.group(1).strip()
        label = m.group(2).strip()
        label = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', label)
        label = label.replace('[', '').replace(']', '')
        return external_link_html(url, label)

    text = re.sub(r'\[(https?://[^\s\]]+)\s+([^\]]+)\]', replace_ext_link_text, text)

    # 9. 外部リンク [http://...]
    def replace_ext_link_bare(m):
        return external_link_html(m.group(1))

    text = re.sub(r'\[(https?://[^\s\]]+)\]', replace_ext_link_bare, text)

    # 10. 内部リンク [[タイトル|表示テキスト]]
    def replace_int_link(m):
        content = m.group(1)
        if "|" in content:
            target, label = content.split("|", 1)
        else:
            target, label = content, content
        target = target.strip()
        label = label.strip()

        norm_target = normalize_title_for_lookup(target)
        target_entry_id = (
            title_to_id_map.get(target) or
            title_to_id_map.get(norm_target) or
            title_to_id_map.get(norm_target.replace(" ", ""))
        )

        if target_entry_id:
            href = f"x-dictionary:r:{target_entry_id}"
            if link_sink is not None:
                link_sink(target_entry_id)
        else:
            href = f"x-dictionary:r:{saxutils.escape(target)}"
            if broken_link_sink is not None:
                broken_link_sink(target)

        href_esc = saxutils.quoteattr(href)
        label_esc = saxutils.escape(label)
        return f'<a class="internal-link" href={href_esc}>{label_esc}</a>'

    text = re.sub(r'\[\[(.*?)\]\]', replace_int_link, text)

    # 見出し保護を解除
    for ph, original_html in heading_placeholders.items():
        text = text.replace(ph, original_html)

    # 11. 生の URL (既存の <a> タグ外にあるもの) を安全に自動リンク化
    tokens = re.split(r'(<a\s+[^>]*>.*?</a>)', text, flags=re.DOTALL)
    new_tokens = []
    for token in tokens:
        if token.startswith('<a'):
            new_tokens.append(token)
        else:
            def replace_raw_url(m):
                return external_link_html(m.group(0))
            token = re.sub(r'https?://[^\s<>\)\]"\'`　-〿぀-ゟ゠-ヿ一-龯]+', replace_raw_url, token)
            new_tokens.append(token)
    text = "".join(new_tokens)

    # 12. 強調 '''bold''' -> <b>bold</b>, 斜体 ''italic'' -> <i>italic</i>
    text = re.sub(r"'''(.*?)'''", r'<b>\1</b>', text)
    text = re.sub(r"''(.*?)''", r'<i>\1</i>', text)

    # 13. 箇条書き (* / #) のパース
    lines = text.split("\n")
    lines = convert_lists(lines)
    text = "\n".join(lines)

    # 14. 段落化 (HTMLブロックタグ周辺を保護しつつ段落生成)
    paragraphs = text.split("\n\n")
    formatted_p = []
    for p in paragraphs:
        p_clean = p.strip()
        if any(p_clean.startswith(tag) for tag in ["<table", "<h2", "<h3", "<h4", "<hr", "<ul", "<ol", "<div"]):
            formatted_p.append(p_clean)
        else:
            p_clean = p_clean.replace("\n", "<br/>")
            if p_clean:
                formatted_p.append(f"<p>{p_clean}</p>")

    return "".join(formatted_p)

def build_title_id_map(articles):
    """記事リストから「タイトル(原題/正規化/見出し語)→entry_id」の逆引きマップを構築する"""
    title_to_id_map = {}
    for art in articles:
        pageid = art.get("pageid", "")
        title = art.get("title", "").strip()
        wikitext = art.get("wikitext", "")
        if title and pageid:
            entry_id = f"entry_{pageid}"
            title_to_id_map[title] = entry_id
            norm_t = normalize_title_for_lookup(title)
            title_to_id_map[norm_t] = entry_id

            headword, yomi = extract_yomi_and_clean_headword(title, wikitext)
            if headword:
                title_to_id_map[headword] = entry_id
                norm_h = normalize_title_for_lookup(headword)
                title_to_id_map[norm_h] = entry_id

    return title_to_id_map
