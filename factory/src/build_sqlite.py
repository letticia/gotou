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
import unicodedata

from wikitext import extract_yomi_and_clean_headword, clean_wikitext, build_title_id_map

FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(FACTORY_DIR)
CACHE_DIR = os.path.join(FACTORY_DIR, "cache")
OUTPUT_DIR = os.path.join(FACTORY_DIR, "output")

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

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    variants_map = load_variants_map()
    normalize_search_key = make_search_key_normalizer(variants_map)

    print(f"記事データの読み込み: {DATA_FILE}")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        articles = json.load(f)
    print(f"総記事数: {len(articles)} 件")

    title_to_id_map = build_title_id_map(articles)
    print(f"タイトルIDマップ登録数: {len(title_to_id_map)} 件")

    conn = sqlite3.connect(DB_FILE)
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

    with open(PENDING_READINGS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(pending_readings) + ("\n" if pending_readings else ""))
    with open(BROKEN_LINKS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(broken_links) + ("\n" if broken_links else ""))

    print(f"=== 完了: {DB_FILE} ===")
    print(f"entries: {entries_count} 件")
    print(f"reading欠落 (保留リスト): {missing_reading_count} 件 -> {PENDING_READINGS_FILE}")
    print(f"links: {len(all_links)} 件")
    print(f"リンク切れ: {len(broken_links)} 件 -> {BROKEN_LINKS_FILE}")

if __name__ == "__main__":
    main()
