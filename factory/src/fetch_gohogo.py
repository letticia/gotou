#!/usr/bin/env python3
"""
fetch_gohogo.py
知恩院公式サイト「御法語」の各章ページを取得し、生HTMLを factory/cache/gohogo/ に保存する。

このスクリプトは「取得」だけを行う。HTMLの解析とJSONへの変換は build_gohogo.py が
キャッシュを読んで行う(ネットワークに触れない)。取得と解析を分けているのは、
解析ロジックを何度書き直しても再取得が発生しないようにするため。

■ 実行する前に読んでください

  知恩院の robots.txt は User-agent: * の全面禁止こそ置いていませんが、
  GPTBot / ClaudeBot / Google-Extended / Bytespider / PerplexityBot /
  Amazonbot / CCBot を名指しで拒否しています。つまり先方は
  「AIによる巡回はお断り」という意思を明示しています。

  そのため、このスクリプトは開発者自身が自分の手元で実行するためのものです。
  AIエージェントに実行させないでください。

  取得してよい範囲・してはいけない範囲は shared/gohogo/README.md を参照。
  現代語訳は保存対象ですらありません(cache のHTMLには含まれますが、
  build_gohogo.py は抽出せず、shared/ にも output/ にも書き出しません)。

■ 使い方

  # 1. まず目次だけ取得して、章ページへのリンクの形を確かめる
  python3 factory/src/fetch_gohogo.py --index-only

  # 2. リンクの拾い方が正しいか、取得せずに確認する
  python3 factory/src/fetch_gohogo.py --dry-run

  # 3. 1章だけ取得して抽出の下見をする
  python3 factory/src/fetch_gohogo.py --limit 1

  # 4. 問題なければ全62章(1リクエストにつき既定1.5秒あける)
  python3 factory/src/fetch_gohogo.py
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.robotparser
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

INDEX_URL = "https://www.chion-in.or.jp/okotoba/"

# User-Agent は ASCII のみ(非ASCIIを入れるとヘッダのエンコードで失敗する)。
# 素性と連絡先を隠さず名乗る。AI用クローラの名前を騙らないこと。
UA_TOKEN = "GotouGohogoFetcher"
USER_AGENT = f"{UA_TOKEN}/1.0 (+https://github.com/letticia/gotou; personal, low-volume)"

FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(FACTORY_DIR, "cache", "gohogo")

# 掟(factory/CLAUDE.md): 1リクエスト/秒以下。既定は余裕を見て1.5秒あけ、
# それより短い値は受け付けない。
MIN_INTERVAL_SEC = 1.0
DEFAULT_INTERVAL_SEC = 1.5

HEN_LABELS = {"zenpen": "前篇", "kohen": "後篇"}

# 「第三十章」「三十一」等の漢数字を数に直すための表(章番号は1〜31)
_KANJI_DIGITS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
                 "六": 6, "七": 7, "八": 8, "九": 9}


def log(msg):
    print(msg, flush=True)


def kanji_to_int(text):
    """「三十一」→31。1〜31の範囲だけを想定した簡易変換(範囲外・解釈不能はNone)"""
    text = text.strip()
    if not text:
        return None
    if text.isdigit():
        value = int(text)
        return value if 1 <= value <= 31 else None
    total = 0
    if "十" in text:
        tens, _, ones = text.partition("十")
        total += _KANJI_DIGITS.get(tens, 1) if tens else 1
        total *= 10
        if ones:
            digit = _KANJI_DIGITS.get(ones)
            if digit is None:
                return None
            total += digit
    else:
        digit = _KANJI_DIGITS.get(text)
        if digit is None:
            return None
        total = digit
    return total if 1 <= total <= 31 else None


class LinkCollector(HTMLParser):
    """<a href> と、その中のテキストを拾う。目次の構造が分からない段階では
    まず全リンクを書き出して人間が確かめる(URLパターンを推測で決め打ちしない)。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self._depth = 0
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        if self._depth:
            self._depth += 1
            return
        href = dict(attrs).get("href")
        if href:
            self._depth = 1
            self._href = href
            self._text = []

    def handle_data(self, data):
        if self._depth:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag != "a" or not self._depth:
            return
        self._depth -= 1
        if self._depth == 0:
            text = re.sub(r"\s+", " ", "".join(self._text)).strip()
            self.links.append({"href": self._href, "text": text})
            self._href = None
            self._text = []


def collect_links(html, base_url):
    parser = LinkCollector()
    parser.feed(html)
    seen = set()
    links = []
    for link in parser.links:
        url = urljoin(base_url, link["href"]).split("#")[0]
        if url in seen:
            continue
        seen.add(url)
        links.append({"url": url, "text": link["text"]})
    return links


# 目次の実物(factory/cache/gohogo/index.html)を確認して分かった形:
#   前篇 第n章 -> https://www.chion-in.or.jp/okotoba/f{nn}/
#   後篇 第n章 -> https://www.chion-in.or.jp/okotoba/s{nn}/
# 同じ階層にある first/ ・ goei/ ・ end/ (序・御詠・結)は章ではないので拾わない。
CHAPTER_PATH_RE = re.compile(r"/okotoba/([fs])(\d{1,2})/?$")
HEN_BY_PREFIX = {"f": "zenpen", "s": "kohen"}


def classify_chapter_link(link):
    """目次のリンク1件が章ページなら {hen, chapter} を返す。違えばNone。

    URLの形を第一の手がかりにする(目次を実際に取得して確かめた形)。
    URLが変わっていた場合に備え、リンクの文言からも読み取れるようにしてある。
    どちらでも篇と章番号がそろわないものは章とみなさない。
    62件そろわなければ呼び出し側が取得前に中断する。
    """
    url = link["url"]
    text = link["text"]

    m = CHAPTER_PATH_RE.search(urlparse(url).path)
    if m:
        chapter = kanji_to_int(m.group(2))
        if chapter is not None:
            return {"hen": HEN_BY_PREFIX[m.group(1)], "chapter": chapter}

    # URLの形が変わったとき用の予備。文言から篇と章番号の両方が読めた場合のみ。
    haystack = f"{text} {url}"
    if "前篇" in haystack or "zenpen" in url:
        hen = "zenpen"
    elif "後篇" in haystack or "後編" in haystack or "kohen" in url:
        hen = "kohen"
    else:
        return None
    m = re.search(r"第\s*([一二三四五六七八九十\d]+)\s*章", text)
    if not m:
        return None
    chapter = kanji_to_int(m.group(1))
    return {"hen": hen, "chapter": chapter} if chapter is not None else None


def check_robots(session, url):
    """robots.txt を読み、このUAで取得してよいか確かめる。
    内容もそのまま表示して、実行者が先方の意思を目で確認できるようにする。"""
    robots_url = urljoin(url, "/robots.txt")
    parser = urllib.robotparser.RobotFileParser()
    try:
        resp = session.get(robots_url, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        log(f"robots.txt を読めませんでした({exc})。安全側に倒して中止します。")
        return False

    log(f"--- {robots_url} ---")
    log(resp.text.strip())
    log("--- ここまで ---")
    parser.parse(resp.text.splitlines())
    allowed = parser.can_fetch(UA_TOKEN, url)
    if not allowed:
        log(f"robots.txt が {UA_TOKEN} による {url} の取得を許可していません。中止します。")
    return allowed


class Throttle:
    def __init__(self, interval):
        self.interval = max(interval, MIN_INTERVAL_SEC)
        self._last = 0.0

    def wait(self):
        elapsed = time.monotonic() - self._last
        if elapsed < self.interval:
            time.sleep(self.interval - elapsed)
        self._last = time.monotonic()


def fetch(session, url, path, throttle, refresh):
    """1ページ取得してファイルに保存する。既にあれば取得しない(キャッシュ優先)。"""
    if os.path.exists(path) and not refresh:
        log(f"cached: {os.path.basename(path)}")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    throttle.wait()
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding or resp.encoding
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(resp.text)
    log(f"fetched: {os.path.basename(path)}  <- {url}")
    return resp.text


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--index-only", action="store_true",
                    help="目次だけ取得し、見つかった全リンクを links.json に書き出す")
    ap.add_argument("--dry-run", action="store_true",
                    help="キャッシュ済みの目次から章リンクの判定結果だけを表示する(通信しない)")
    ap.add_argument("--limit", type=int, default=0,
                    help="取得する章数の上限(0で全件)。構造確認は --limit 1 から")
    ap.add_argument("--interval", type=float, default=DEFAULT_INTERVAL_SEC,
                    help=f"リクエスト間隔(秒)。{MIN_INTERVAL_SEC}秒未満は指定できない")
    ap.add_argument("--refresh", action="store_true",
                    help="キャッシュがあっても取り直す")
    args = ap.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    index_path = os.path.join(CACHE_DIR, "index.html")
    links_path = os.path.join(CACHE_DIR, "links.json")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    throttle = Throttle(args.interval)

    # --- 目次 ---
    if args.dry_run:
        if not os.path.exists(index_path):
            log(f"{index_path} がありません。先に --index-only を実行してください。")
            return 1
        with open(index_path, "r", encoding="utf-8") as f:
            index_html = f.read()
    else:
        if not check_robots(session, INDEX_URL):
            return 1
        index_html = fetch(session, INDEX_URL, index_path, throttle, args.refresh)

    links = collect_links(index_html, INDEX_URL)
    with open(links_path, "w", encoding="utf-8") as f:
        json.dump(links, f, ensure_ascii=False, indent=2)
    log(f"目次から {len(links)} 件のリンクを検出 -> {links_path}")

    chapters = []
    for link in links:
        info = classify_chapter_link(link)
        if info:
            chapters.append({**info, "url": link["url"], "text": link["text"]})

    # 同じ章への重複リンク(サムネイルと題名で2本ある等)は1本にまとめる
    unique = {}
    for ch in chapters:
        unique.setdefault((ch["hen"], ch["chapter"]), ch)
    chapters = [unique[k] for k in sorted(unique)]

    log(f"章ページと判定できたリンク: {len(chapters)} 件")
    for hen in ("zenpen", "kohen"):
        found = sorted(c["chapter"] for c in chapters if c["hen"] == hen)
        missing = [n for n in range(1, 32) if n not in found]
        log(f"  {HEN_LABELS[hen]}: {len(found)}章" +
            (f" / 欠番 {missing}" if missing else " (1〜31すべて)"))

    if args.index_only:
        log("目次のみ取得しました。links.json を確認してから次に進んでください。")
        return 0

    if len(chapters) != 62:
        log("")
        log("章ページを62件そろえられませんでした。目次の作りが想定と違います。")
        log(f"{links_path} を確認し、classify_chapter_link() を直してください。")
        log("(誤った条件のまま取得しに行かないよう、ここで中止します)")
        return 1

    if args.dry_run:
        log("--dry-run のためここで終了します。")
        return 0

    # --- 各章 ---
    targets = chapters[: args.limit] if args.limit else chapters
    log(f"\n{len(targets)} 章を取得します(間隔 {throttle.interval} 秒)")
    manifest = []
    for i, ch in enumerate(targets, 1):
        name = f"{ch['hen']}-{ch['chapter']:02d}.html"
        path = os.path.join(CACHE_DIR, name)
        log(f"[{i}/{len(targets)}] {HEN_LABELS[ch['hen']]}第{ch['chapter']}章")
        try:
            fetch(session, ch["url"], path, throttle, args.refresh)
        except requests.RequestException as exc:
            log(f"  取得に失敗しました: {exc}")
            continue
        manifest.append({"hen": ch["hen"], "chapter": ch["chapter"],
                         "url": ch["url"], "file": name})

    manifest_path = os.path.join(CACHE_DIR, "fetch-manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"fetchedAt": time.strftime("%Y-%m-%d"), "indexUrl": INDEX_URL,
                   "chapters": manifest}, f, ensure_ascii=False, indent=2)
    log(f"\n完了: {len(manifest)} 章を {CACHE_DIR} に保存しました")
    log(f"目録: {manifest_path}")
    log("次は build_gohogo.py でJSONに変換します(このスクリプトは解析しません)。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
