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
import json
import shutil
import subprocess
import xml.sax.saxutils as saxutils

from wikitext import (
    extract_yomi_and_clean_headword,
    sanitize_xml_string,
    clean_wikitext,
    build_title_id_map,
)

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

    title_to_id_map = build_title_id_map(articles)
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
