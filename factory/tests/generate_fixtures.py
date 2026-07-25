#!/usr/bin/env python3
"""
generate_fixtures.py
factory/tests/fixtures/articles.json に、大辞典由来のデータを一切含まない
完全な自作ダミー項目(100件)を決定論的に生成する。

生成される項目はwikitextのパース対象パターン(内部リンク・画像・表組み・箇条書き・
強調・外部リンク・水平線・見出し・異体字・読み欠落)を一通り網羅する。
乱数を使わないため、再実行しても毎回同一のファイルが生成される。
"""

import os
import json

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
FIXTURES_DIR = os.path.join(TESTS_DIR, "fixtures")
OUTPUT_FILE = os.path.join(FIXTURES_DIR, "articles.json")

TOTAL = 100

# 見出し語に shared/variants.json の異体字を含めたい項目(search_key正規化のテスト用)
# 値は (よみ, 見出し語)
VARIANT_TITLES = {
    5: ("ぶっきょうだみー", "佛教ダミー005"),
    15: ("みろくだみー", "彌勒ダミー015"),
    25: ("きょうてんだみー", "經典ダミー025"),
    35: ("じょうどだみー", "淨土ダミー035"),
}

# 先頭行が `=よみ／見出し=` パターンを持たない項目(reading欠落パスのテスト用)
NO_YOMI_INDEXES = {20, 40, 60, 80, 100}

# 存在しないタイトルへのリンクを含む項目(broken_links検出パスのテスト用)
BROKEN_LINK_INDEXES = {10, 30, 50}


def title_for(i):
    if i in VARIANT_TITLES:
        return VARIANT_TITLES[i][1]
    return f"ダミー項目{i:03d}"

def yomi_for(i):
    if i in VARIANT_TITLES:
        return VARIANT_TITLES[i][0]
    return f"だみーこうもく{i:03d}"

def build_wikitext(i, titles):
    title = title_for(i)
    yomi = yomi_for(i)

    lines = []
    if i in NO_YOMI_INDEXES:
        lines.append(f"={title}=")
    else:
        lines.append(f"={yomi}／{title}=")

    prev_i = i - 1 if i > 1 else TOTAL
    next_i = i + 1 if i < TOTAL else 1
    prev_title = titles[prev_i - 1]
    next_title = titles[next_i - 1]

    body_parts = [f"これは{title}のダミー本文です。[[{prev_title}]]と[[{next_title}]]に関連する。"]

    if i in BROKEN_LINK_INDEXES:
        body_parts.append("関連: [[存在しない項目999]]。")

    if i % 3 == 0:
        body_parts.append(f"'''{title}の太字'''と''{title}の斜体''。")

    if i % 4 == 0:
        body_parts.append(f"[[File:dummy{i:03d}.jpg|thumb|キャプション{i:03d}]]")

    if i % 5 == 0:
        body_parts.append("* 箇条書き一\n* 箇条書き二")

    if i % 6 == 0:
        body_parts.append("# 番号付き一\n# 番号付き二")

    if i % 8 == 0:
        body_parts.append(f"[http://example.com/dummy{i:03d} ダミーリンク{i:03d}]")

    if i % 9 == 0:
        body_parts.append(f"http://example.com/bare{i:03d}")

    if i % 10 == 0:
        body_parts.append(
            '{|class="wikitable"\n'
            "! 見出し1 !! 見出し2\n"
            "|-\n"
            f"| セル{i:03d}A || セル{i:03d}B\n"
            "|}"
        )

    if i % 11 == 0:
        body_parts.append("----")

    if i % 13 == 0:
        body_parts.append(f"== {title}の概要 ==\nここに概要を記す。")

    lines.append("\n".join(body_parts))
    return "\n".join(lines)

def main():
    titles = [title_for(i) for i in range(1, TOTAL + 1)]

    articles = []
    for i in range(1, TOTAL + 1):
        articles.append({
            "pageid": str(i),
            "title": title_for(i),
            "wikitext": build_wikitext(i, titles),
        })

    os.makedirs(FIXTURES_DIR, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print(f"生成完了: {OUTPUT_FILE} ({len(articles)}件)")

if __name__ == "__main__":
    main()
