#!/usr/bin/env python3
"""
build_sqlite.py
articles.json (全9,197件) を読み込み、shared/schema.sql に従うSQLite (gotou.sqlite3) を生成します。
"""

import os
import re
import json
import html
import sqlite3
import argparse
import unicodedata

from wikitext import extract_yomi_and_clean_headword, clean_wikitext, build_title_id_map

FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(FACTORY_DIR)
CACHE_DIR = os.path.join(FACTORY_DIR, "cache")
OUTPUT_DIR = os.path.join(FACTORY_DIR, "output")
FIXTURES_FILE = os.path.join(FACTORY_DIR, "tests", "fixtures", "articles.json")

DATA_FILE = os.path.join(CACHE_DIR, "articles.json")
SCHEMA_FILE = os.path.join(REPO_DIR, "shared", "schema.sql")
VARIANTS_FILE = os.path.join(REPO_DIR, "shared", "variants.json")

DB_FILE = os.path.join(OUTPUT_DIR, "gotou.sqlite3")
PENDING_READINGS_FILE = os.path.join(OUTPUT_DIR, "pending_readings.txt")
BROKEN_LINKS_FILE = os.path.join(OUTPUT_DIR, "broken_links.txt")

YOMI_LINE_RE = re.compile(r'^=([^／/=]+)[／/]([^=]+)=$')
TAG_RE = re.compile(r'<[^>]+>')


def load_variants_map():
    """shared/variants.json の異体字マップを読み込む(正規化ロジックをfactory内に直書きしない)"""
    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("map", {})

def make_search_key_normalizer(variants_map):
    def normalize_search_key(text):
        if not text:
            return ""
        text = unicodedata.normalize("NFKC", text)
        return "".join(variants_map.get(ch, ch) for ch in text)
    return normalize_search_key

def html_to_text(html_fragment):
    """body_htmlからタグを除去し、entries_fts (body_text) 用のプレーンテキストを作る"""
    if not html_fragment:
        return ""
    text = TAG_RE.sub(" ", html_fragment)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def has_yomi_line(wikitext):
    """先頭行が `=よみ／見出し=` パターンを持つか(読みの取得元として信頼できるか)"""
    if not wikitext or not wikitext.strip():
        return False
    first_line = wikitext.strip().split("\n")[0].strip()
    return bool(YOMI_LINE_RE.match(first_line))

def create_schema(conn):
    """shared/schema.sql をそのまま実行する(スキーマの唯一の正はshared/、Python側で二重定義しない)"""
    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)

def target_id_from_entry_id(entry_id_str):
    """wikitext.clean_wikitextのlink_sinkが渡す 'entry_{pageid}' からpageid(int)を取り出す"""
    return int(entry_id_str.split("_", 1)[1])

def generate_database(articles, db_path, pending_readings_path=None, broken_links_path=None):
    """articlesリストからshared/schema.sql準拠のSQLiteをdb_pathに生成し、統計情報のdictを返す"""
    variants_map = load_variants_map()
    normalize_search_key = make_search_key_normalizer(variants_map)

    title_to_id_map = build_title_id_map(articles)

    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    create_schema(conn)
    cur = conn.cursor()

    pending_readings = []
    broken_links = []
    all_links = set()
    entries_count = 0
    missing_reading_count = 0

    for art in articles:
        pageid = art.get("pageid", "")
        title = art.get("title", "").strip()
        wikitext = art.get("wikitext", "")

        if not title or not pageid:
            continue

        entry_id = int(pageid)
        headword, yomi = extract_yomi_and_clean_headword(title, wikitext)

        if has_yomi_line(wikitext):
            reading = yomi
        else:
            reading = None
            missing_reading_count += 1
            pending_readings.append(f"{entry_id}\t{title}")

        search_key = normalize_search_key(headword)

        found_link_targets = []
        found_broken_targets = []

        def link_sink(target_entry_id, _sink=found_link_targets):
            _sink.append(target_id_from_entry_id(target_entry_id))

        def broken_link_sink(target_title, _sink=found_broken_targets):
            _sink.append(target_title)

        body_html = clean_wikitext(
            wikitext, title_to_id_map,
            link_sink=link_sink, broken_link_sink=broken_link_sink,
        )
        body_text = html_to_text(body_html)

        cur.execute(
            "INSERT INTO entries (id, title, reading, search_key, body_html) VALUES (?, ?, ?, ?, ?)",
            (entry_id, headword, reading, search_key, body_html),
        )
        cur.execute(
            "INSERT INTO entries_fts (rowid, title, body_text) VALUES (?, ?, ?)",
            (entry_id, headword, body_text),
        )

        for target_id in found_link_targets:
            all_links.add((entry_id, target_id))
        for target_title in found_broken_targets:
            broken_links.append(f"{entry_id}\t{title}\t{target_title}")

        entries_count += 1

    cur.executemany(
        "INSERT INTO links (from_id, to_id) VALUES (?, ?)",
        sorted(all_links),
    )

    conn.commit()
    conn.close()

    if pending_readings_path:
        with open(pending_readings_path, "w", encoding="utf-8") as f:
            f.write("\n".join(pending_readings) + ("\n" if pending_readings else ""))
    if broken_links_path:
        with open(broken_links_path, "w", encoding="utf-8") as f:
            f.write("\n".join(broken_links) + ("\n" if broken_links else ""))

    return {
        "entries_count": entries_count,
        "missing_reading_count": missing_reading_count,
        "links_count": len(all_links),
        "broken_links_count": len(broken_links),
        "title_to_id_map_size": len(title_to_id_map),
    }

def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", choices=["cache", "fixtures"], default="cache",
        help="cache: factory/cache/articles.json (実データ、既定値) / "
             "fixtures: factory/tests/fixtures/articles.json (自作ダミー)",
    )
    parser.add_argument(
        "--output", default=None,
        help=f"出力するSQLiteファイルのパス (既定値: {DB_FILE})",
    )
    return parser.parse_args()

def main():
    args = parse_args()
    data_file = FIXTURES_FILE if args.source == "fixtures" else DATA_FILE
    db_file = args.output or DB_FILE

    os.makedirs(os.path.dirname(db_file) or ".", exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"記事データの読み込み: {data_file}")
    with open(data_file, "r", encoding="utf-8") as f:
        articles = json.load(f)
    print(f"総記事数: {len(articles)} 件")

    stats = generate_database(
        articles, db_file,
        pending_readings_path=PENDING_READINGS_FILE,
        broken_links_path=BROKEN_LINKS_FILE,
    )

    print(f"タイトルIDマップ登録数: {stats['title_to_id_map_size']} 件")
    print(f"=== 完了: {db_file} ===")
    print(f"entries: {stats['entries_count']} 件")
    print(f"reading欠落 (保留リスト): {stats['missing_reading_count']} 件 -> {PENDING_READINGS_FILE}")
    print(f"links: {stats['links_count']} 件")
    print(f"リンク切れ: {stats['broken_links_count']} 件 -> {BROKEN_LINKS_FILE}")

if __name__ == "__main__":
    main()
