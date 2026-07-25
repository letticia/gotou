#!/usr/bin/env python3
"""
fetch_images.py
浄土宗大辞典の全画像 (全249枚) のURL情報をMediaWiki APIから取得し、
ローカルの cache/images/ ディレクトリに一括ダウンロードします。
"""

import os
import json
import time
import urllib.parse
import requests

API_URL = "https://jodoshuzensho.jp/daijiten/api.php"
FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(FACTORY_DIR, "cache", "images")
MAP_FILE = os.path.join(FACTORY_DIR, "cache", "image_map.json")

HEADERS = {
    "User-Agent": "JodoDictFetcher/1.0 (macOS Dictionary Generator)"
}

def log(msg):
    print(msg, flush=True)

def fetch_all_images_info():
    """MediaWiki API から全画像のリストとURLを取得"""
    images = []
    aifrom = None

    log("=== 全画像情報の取得開始 ===")
    while True:
        params = {
            "action": "query",
            "list": "allimages",
            "ailimit": "max",
            "format": "json"
        }
        if aifrom:
            params["aifrom"] = aifrom

        resp = requests.get(API_URL, params=params, headers=HEADERS, verify=False)
        data = resp.json()

        fetched = data.get("query", {}).get("allimages", [])
        images.extend(fetched)
        log(f"取得済み画像数: {len(images)}")

        if "continue" in data and "aifrom" in data["continue"]:
            aifrom = data["continue"]["aifrom"]
            time.sleep(0.1)
        else:
            break

    log(f"全画像情報取得完了: 総数 {len(images)} 件")
    return images

def download_images(images):
    """各画像をローカルに保存"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    image_map = {}

    log("=== 画像ファイルのダウンロード開始 ===")
    for idx, img in enumerate(images, 1):
        name = img.get("name", "")
        url = img.get("url", "")

        if not name or not url:
            continue

        local_path = os.path.join(OUTPUT_DIR, name)
        image_map[name] = {
            "name": name,
            "url": url,
            "local_path": local_path
        }

        if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
            try:
                resp = requests.get(url, headers=HEADERS, verify=False, timeout=15)
                if resp.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(resp.content)
            except Exception as e:
                log(f"ダウンロード失敗 ({name}): {e}")

        if idx % 20 == 0 or idx == len(images):
            log(f"進捗: {idx} / {len(images)} 件")

        time.sleep(0.05)

    with open(MAP_FILE, "w", encoding="utf-8") as f:
        json.dump(image_map, f, ensure_ascii=False, indent=2)

    log(f"=== 完了: {OUTPUT_DIR} に {len(image_map)} 枚の画像を保存しました ===")
    return image_map

def main():
    requests.packages.urllib3.disable_warnings()
    images = fetch_all_images_info()
    download_images(images)

if __name__ == "__main__":
    main()
