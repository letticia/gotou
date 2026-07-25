#!/usr/bin/env python3
"""
fetch_articles.py
浄土宗大辞典 (MediaWiki) の全記事データを取得しローカルJSONにキャッシュします。
途中保存機能付き。
"""

import os
import json
import time
import sys
import requests

API_URL = "https://jodoshuzensho.jp/daijiten/api.php"
FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(FACTORY_DIR, "cache")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "articles.json")

HEADERS = {
    "User-Agent": "JodoDictFetcher/1.0 (macOS Dictionary Generator)"
}

def log(msg):
    print(msg, flush=True)

def fetch_all_page_titles():
    """標準名前空間 (ns=0) の全ページタイトルとPage IDを取得"""
    pages = []
    apcontinue = None

    log("=== 全ページタイトルの取得開始 ===")
    while True:
        params = {
            "action": "query",
            "list": "allpages",
            "apnamespace": "0",
            "aplimit": "max",
            "format": "json"
        }
        if apcontinue:
            params["apcontinue"] = apcontinue

        resp = requests.get(API_URL, params=params, headers=HEADERS, verify=False)
        data = resp.json()

        fetched = data.get("query", {}).get("allpages", [])
        pages.extend(fetched)
        log(f"取得済みタイトル数: {len(pages)}")

        if "continue" in data and "apcontinue" in data["continue"]:
            apcontinue = data["continue"]["apcontinue"]
            time.sleep(0.1)
        else:
            break

    log(f"全タイトル取得完了: 総数 {len(pages)} 件")
    return pages

def fetch_articles_detail(pages):
    """各ページのWikitextをバッチ取得"""
    log("=== 各記事詳細データの取得開始 ===")

    existing_articles = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_articles = {str(a["pageid"]): a for a in data}
                log(f"既存キャッシュ読み込み: {len(existing_articles)} 件")
        except Exception as e:
            log(f"キャッシュ読み込みエラー: {e}")

    articles_map = existing_articles
    batch_size = 50

    # 未取得の pageid をリストアップ
    target_pages = [p for p in pages if str(p["pageid"]) not in articles_map]
    log(f"新規取得対象: {len(target_pages)} 件 / 全 {len(pages)} 件")

    page_ids = [str(p["pageid"]) for p in target_pages]

    for i in range(0, len(page_ids), batch_size):
        batch_ids = page_ids[i:i + batch_size]
        params = {
            "action": "query",
            "pageids": "|".join(batch_ids),
            "prop": "revisions",
            "rvprop": "content",
            "format": "json"
        }

        try:
            resp = requests.get(API_URL, params=params, headers=HEADERS, verify=False)
            data = resp.json()
            query_pages = data.get("query", {}).get("pages", {})

            for pid, pdata in query_pages.items():
                title = pdata.get("title", "")
                revs = pdata.get("revisions", [])
                content = revs[0].get("*", "") if revs else ""

                articles_map[str(pid)] = {
                    "pageid": pid,
                    "title": title,
                    "wikitext": content
                }
        except Exception as e:
            log(f"バッチ取得エラー ({i}~{i+batch_size}): {e}")

        log(f"進捗: {len(articles_map)} / {len(pages)} 件")

        # 100件（2バッチ）ごとにディスクに保存
        if i % 100 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(list(articles_map.values()), f, ensure_ascii=False, indent=2)

        time.sleep(0.05)

    final_list = list(articles_map.values())
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)

    log(f"全詳細データ取得完了: {len(final_list)} 件")
    return final_list

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    requests.packages.urllib3.disable_warnings()

    pages = fetch_all_page_titles()
    articles = fetch_articles_detail(pages)

    log(f"=== 完了: {OUTPUT_FILE} に {len(articles)} 件保存しました ===")

if __name__ == "__main__":
    main()
