#!/usr/bin/env python3
"""
build_apple_dict.py
articles.json (全9,197件) を読み込み、
Apple Standard Dictionary XML (JodoDaijiten.xml), Info.plist, Dictionary.css を生成し、
DDK (build_dict.sh) を用いて 浄土宗大辞典.dictionary バンドルをコンパイル・ビルドします。

機能強化:
1. 無限ループバグ完全修正: 閉じ]]不一致時の pos 進捗を保証しプロセスのハングアップを防止
2. 画像末尾の余存角括弧]完全消去: 画像タグ直後に浮遊している不要な閉じ括弧 ] も自動吸収・除去
3. セクション見出し(一, 二...)の辞書機能遮断: pointer-events: none と <span class="no-dict-link"> によるmacOS辞書アプリ自動ジャンプの完全ブロック
4. ネスト画像構文パーサー: [[File:...[[...]]...]] の括弧ネストを階層カウントして完全抽出
5. 内部リンク正規化: 全角スペース　, アンダースコア _, 半角スペース の相互正規化対応
6. 外部リンク: [http://... テキスト] や 【資料】内の生URL をクリック可能なウェブリンク (<a href="http://...">) に自動変換
7. MediaWiki 表組み記法 ({|class="wikitable" ... |}) の高度パース変換 (rowspan, colspan対応)
8. ローカル画像完全埋め込み (全249枚の解説写真をOtherResourcesへ同期し<img src="...">表示)
"""

import os
import re
import json
import shutil
import subprocess
import xml.sax.saxutils as saxutils

# factory/ 配下に完結させる。生成物・キャッシュは output/ と cache/ (どちらも.gitignore済み)。
FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(FACTORY_DIR, "cache")
OUTPUT_DIR = os.path.join(FACTORY_DIR, "output")

DATA_FILE = os.path.join(CACHE_DIR, "articles.json")
IMAGE_DIR = os.path.join(CACHE_DIR, "images")
BUILD_DIR = os.path.join(OUTPUT_DIR, "build")
OTHER_RESOURCES_DIR = os.path.join(BUILD_DIR, "OtherResources")

# DDK (Dictionary Development Kit) は Apple Inc. の著作物のためリポジトリに含めない。
# 環境変数 DDK_BIN で build_dict.sh を指すか、factory/tools/ 配下 (.gitignore済み) に展開する。
DDK_BIN = os.environ.get(
    "DDK_BIN",
    os.path.join(FACTORY_DIR, "tools", "DDK", "Dictionary-Development-Kit-master", "bin", "build_dict.sh"),
)
INSTALL_DIR = os.path.expanduser("~/Library/Dictionaries")

DICT_TITLE = "浄土宗大辞典"
DICT_ID = "jp.jodoshuzensho.daijiten"

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

        for line in lines:
            if line == "|}" or line.startswith("|}"):
                break
            if line.startswith("|-"):
                if current_row:
                    rows.append(current_row)
                    current_row = []
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
        for row in rows:
            table_html.append('  <tr>')
            for tag, attr, content in row:
                attr_str = f" {attr}" if attr else ""
                table_html.append(f'    <{tag}{attr_str}>{content}</{tag}>')
            table_html.append('  </tr>')
        table_html.append('</table>')

        return "\n".join(table_html)

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

def clean_wikitext(text, title_to_id_map):
    """Wikitextの全各種記法をHTMLに完全変換"""
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
    def replace_heading(m):
        eq = m.group(1)
        title_content = m.group(2).strip()
        title_content = re.sub(r'<[^>]+>', '', title_content).strip()
        level = len(eq)
        tag = f"h{min(level, 4)}"
        return f'<{tag} class="dict-section-heading"><span class="no-dict-link">{title_content}</span></{tag}>'

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
    text = re.sub(r'^\s*----\s*$', '<hr class="section-divider"/>', text, flags=re.MULTILINE)

    # 8. 外部リンク [http://... 表示テキスト]
    def replace_ext_link_text(m):
        url = m.group(1).strip()
        label = m.group(2).strip()
        label = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]+)\]\]', r'\1', label)
        label = label.replace('[', '').replace(']', '')
        url_esc = saxutils.quoteattr(url)
        label_esc = saxutils.escape(label)
        return f'<a class="external-link" href={url_esc}>{label_esc}</a>'

    text = re.sub(r'\[(https?://[^\s\]]+)\s+([^\]]+)\]', replace_ext_link_text, text)

    # 9. 外部リンク [http://...]
    def replace_ext_link_bare(m):
        url = m.group(1).strip()
        url_esc = saxutils.quoteattr(url)
        label_esc = saxutils.escape(url)
        return f'<a class="external-link" href={url_esc}>{label_esc}</a>'

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
        else:
            href = f"x-dictionary:r:{saxutils.escape(target)}"

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
                url = m.group(0).strip()
                url_esc = saxutils.quoteattr(url)
                label_esc = saxutils.escape(url)
                return f'<a class="external-link" href={url_esc}>{label_esc}</a>'
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

def prepare_other_resources():
    """全249枚の画像を BUILD_DIR/OtherResources に同期"""
    os.makedirs(OTHER_RESOURCES_DIR, exist_ok=True)
    if os.path.exists(IMAGE_DIR):
        print(f"画像リソースをコピー中: {IMAGE_DIR} -> {OTHER_RESOURCES_DIR}")
        for img_name in os.listdir(IMAGE_DIR):
            src = os.path.join(IMAGE_DIR, img_name)
            dst = os.path.join(OTHER_RESOURCES_DIR, img_name)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
        print(f"リソースコピー完了: {len(os.listdir(OTHER_RESOURCES_DIR))} 件")

def generate_xml_and_files():
    """XML, Info.plist, CSS を作成"""
    os.makedirs(BUILD_DIR, exist_ok=True)
    prepare_other_resources()

    print(f"記事データの読み込み: {DATA_FILE}")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        articles = json.load(f)

    print(f"総記事数: {len(articles)} 件")

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

    print(f"タイトルIDマップ登録数: {len(title_to_id_map)} 件")

    xml_entries = []

    for art in articles:
        pageid = art.get("pageid", "")
        title = art.get("title", "").strip()
        wikitext = art.get("wikitext", "")

        if not title:
            continue

        headword, yomi = extract_yomi_and_clean_headword(title, wikitext)
        content_html = clean_wikitext(wikitext, title_to_id_map)

        entry_id = f"entry_{pageid}"
        escaped_title = saxutils.escape(headword)
        escaped_yomi = saxutils.escape(yomi)

        escaped_title = sanitize_xml_string(escaped_title)
        escaped_yomi = sanitize_xml_string(escaped_yomi)
        escaped_orig_title = sanitize_xml_string(saxutils.escape(title))

        indexes = [
            f'<d:index d:value="{escaped_title}"/>',
            f'<d:index d:value="{escaped_yomi}" d:title="{escaped_title}" d:yomi="{escaped_yomi}"/>'
        ]
        if escaped_orig_title != escaped_title:
            indexes.append(f'<d:index d:value="{escaped_orig_title}"/>')

        indexes_str = "\n    ".join(indexes)

        entry_xml = f'''  <d:entry id="{entry_id}" d:title="{escaped_title}">
    {indexes_str}
    <div class="headword">
      <h1>{escaped_title}</h1>
      <span class="yomi">{escaped_yomi}</span>
    </div>
    <div class="content">
      {content_html}
    </div>
  </d:entry>'''
        xml_entries.append(entry_xml)

    xml_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<d:dictionary xmlns="http://www.w3.org/1999/xhtml" xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.dtd">
{chr(10).join(xml_entries)}
</d:dictionary>'''

    xml_path = os.path.join(BUILD_DIR, "JodoDaijiten.xml")
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
    print(f"XML生成完了: {xml_path} (サイズ: {len(xml_content)/1024/1024:.2f} MB)")

    css_content = '''@charset "UTF-8";
@namespace d url("http://www.apple.com/DTDs/DictionaryService-1.0.dtd");

div.headword {
    border-bottom: 2px solid #8b0000;
    margin-bottom: 12px;
    padding-bottom: 4px;
}

div.headword h1 {
    font-size: 1.6em;
    font-weight: bold;
    color: #2c3e50;
    display: inline-block;
    margin: 0 10px 0 0;
}

div.headword span.yomi {
    font-size: 1.0em;
    color: #7f8c8d;
    font-weight: normal;
}

div.content {
    font-size: 1.0em;
    line-height: 1.6;
    color: #1a252f;
}

div.content p {
    margin-bottom: 0.8em;
}

h2.dict-section-heading {
    font-size: 1.25em;
    color: #8b0000;
    border-bottom: 1px solid #d5dbdb;
    padding-bottom: 2px;
    margin-top: 16px;
    margin-bottom: 8px;
    pointer-events: none !important;
    cursor: default !important;
}

h3.dict-section-heading {
    font-size: 1.1em;
    color: #34495e;
    margin-top: 12px;
    margin-bottom: 6px;
    pointer-events: none !important;
    cursor: default !important;
}

span.no-dict-link {
    pointer-events: none !important;
    cursor: default !important;
    display: inline-block;
    -webkit-user-select: text;
}

hr.section-divider {
    border: 0;
    border-top: 1px dashed #bdc3c7;
    margin: 14px 0;
}

div.dict-image-container {
    margin: 14px 0;
    padding: 10px;
    background-color: #f8f9fa;
    border: 1px solid #e5e7e9;
    border-radius: 6px;
    text-align: center;
}

img.dict-image {
    max-width: 100%;
    max-height: 450px;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    display: block;
    margin: 0 auto;
}

p.dict-image-caption {
    font-size: 0.9em;
    color: #5d6d7e;
    margin-top: 8px;
    margin-bottom: 0;
}

div.content a.internal-link {
    color: #2980b9;
    text-decoration: none;
    font-weight: 500;
}

div.content a.internal-link:hover {
    text-decoration: underline;
    color: #c0392b;
}

div.content a.external-link {
    color: #27ae60;
    text-decoration: underline;
    font-weight: normal;
}

div.content a.external-link:hover {
    color: #1e8449;
}

table.wikitable {
    border-collapse: collapse;
    margin: 14px 0;
    width: 100%;
    font-size: 0.95em;
}

table.wikitable th {
    background-color: #f2f4f4;
    color: #2c3e50;
    font-weight: bold;
    border: 1px solid #bdc3c7;
    padding: 6px 10px;
    text-align: left;
    vertical-align: middle;
}

table.wikitable td {
    border: 1px solid #bdc3c7;
    padding: 6px 10px;
    vertical-align: middle;
}

ul, ol {
    margin-left: 20px;
    margin-bottom: 10px;
}

li {
    margin-bottom: 4px;
}
'''
    css_path = os.path.join(BUILD_DIR, "JodoDaijiten.css")
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(css_content)

    plist_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>Japan</string>
	<key>CFBundleIdentifier</key>
	<string>{DICT_ID}</string>
	<key>CFBundleName</key>
	<string>{DICT_TITLE}</string>
	<key>CFBundleShortVersionString</key>
	<string>2.7</string>
	<key>DDKDictionaryCopyright</key>
	<string>浄土宗大辞典 (浄土宗総合研究所)</string>
	<key>DDKFormatVersion</key>
	<string>1.0</string>
</dict>
</plist>'''
    plist_path = os.path.join(BUILD_DIR, "Info.plist")
    with open(plist_path, "w", encoding="utf-8") as f:
        f.write(plist_content)

    return xml_path, css_path, plist_path

def compile_dictionary(xml_path, css_path, plist_path):
    """build_dict.sh を呼び出してコンパイル"""
    print("=== macOS 辞書バンドル (.dictionary) のコンパイル開始 ===")

    if not os.path.exists(DDK_BIN):
        raise FileNotFoundError(
            f"DDK (build_dict.sh) が見つかりません: {DDK_BIN}\n"
            "Apple Developer の「Additional Tools for Xcode」から Dictionary Development Kit を入手し、\n"
            "factory/tools/DDK/ に展開するか、環境変数 DDK_BIN で build_dict.sh のパスを指定してください。\n"
            "(DDKはApple Inc.の著作物のためこのリポジトリには含めていません)"
        )

    cmd = [
        DDK_BIN,
        DICT_TITLE,
        xml_path,
        css_path,
        plist_path
    ]

    env = os.environ.copy()
    ddk_bin_dir = os.path.dirname(DDK_BIN)
    env["PATH"] = f"{ddk_bin_dir}:{env.get('PATH', '')}"

    res = subprocess.run(cmd, cwd=BUILD_DIR, env=env, capture_output=True)
    stdout_str = res.stdout.decode('utf-8', errors='replace')
    stderr_str = res.stderr.decode('utf-8', errors='replace')

    print("STDOUT:\n", stdout_str[:2000])
    if stderr_str:
        print("STDERR:\n", stderr_str[:2000])

    built_dict_path = os.path.join(BUILD_DIR, "objects", f"{DICT_TITLE}.dictionary")
    if os.path.exists(built_dict_path):
        print(f"=== ビルド成功! {built_dict_path} ===")
        return built_dict_path
    else:
        print("!!! ビルド失敗 !!!")
        return None

def main():
    xml_path, css_path, plist_path = generate_xml_and_files()
    built_path = compile_dictionary(xml_path, css_path, plist_path)

if __name__ == "__main__":
    main()
