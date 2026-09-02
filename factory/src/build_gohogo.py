#!/usr/bin/env python3
"""
build_gohogo.py
factory/cache/gohogo/ の章ページHTMLを読み、shared/gohogo/{zenpen,kohen}.json を作る。

ネットワークには触れない。取得は fetch_gohogo.py の役目(開発者が手元で実行する)。

■ 書き出さないもの

  - 現代語訳。gohogo_parse.py が本文(div.genbun)しか見ないので構造上入らない。
  - サイト掲載の一文要約。parse_chapter は site_summary として返すが、
    ここでは書き出すフィールドを明示的に列挙しているので shared/ には出ない。
    (summary フィールド自体、いまは持たせていない。shared/gohogo/README.md 参照)

■ 使い方

  python3 factory/src/build_gohogo.py            # 62章そろっていないと中止
  python3 factory/src/build_gohogo.py --check     # 検証だけ。ファイルは書かない
"""

import argparse
import json
import os
import sys

from gohogo_parse import HEN_LABELS, MAX_CLAUSE_CHARS, ParseError, parse_chapter

FACTORY_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR = os.path.dirname(FACTORY_DIR)
CACHE_DIR = os.path.join(FACTORY_DIR, "cache", "gohogo")
OUT_DIR = os.path.join(REPO_DIR, "shared", "gohogo")

INDEX_URL = "https://www.chion-in.or.jp/okotoba/"
CHAPTERS_PER_HEN = 31
SCHEMA_VERSION = 1

_DIGITS = "〇一二三四五六七八九"


def log(msg):
    print(msg, flush=True)


def int_to_kanji(n):
    """1→「一」、30→「三十」、31→「三十一」(章番号の範囲だけを想定)"""
    if n < 10:
        return _DIGITS[n]
    tens, ones = divmod(n, 10)
    head = ("" if tens == 1 else _DIGITS[tens]) + "十"
    return head + (_DIGITS[ones] if ones else "")


def build_source(chapter, fetched_ym):
    """出典表記。どこまでがPDで、どこから未検証かが読んで分かるようにする。

    底本名(例「浄土宗略抄」)はページの <p class="source"> から取る。法然上人遺文の
    どれからの抜粋かが分かるため出典に含める。
    読み仮名と章題の表記は現代の編集物である可能性があり、底本と突き合わせた
    確認が済んでいないので「読みは要点検」を必ず残す。
    """
    hen_label = HEN_LABELS[chapter["hen"]]
    chap = int_to_kanji(chapter["chapter"])
    genbun = chapter.get("genbunSource")
    origin = f"法然上人遺文({genbun})" if genbun else "法然上人遺文"
    return {
        "name": (
            f"『元祖大師御法語』{hen_label}第{chap}章「{chapter['title']}」。"
            f"本文は{origin}からの抜粋(著作権保護期間満了)。"
            f"本文・読み仮名・章題は知恩院公式サイト「御法語」より取得({fetched_ym}取得)。"
            f"読みは要点検"
        ),
        "url": chapter["url"],
        "license": "PD",
    }


def to_output_chapter(chapter, fetched_ym):
    """shared/ に書き出す形にする。**ここに列挙したフィールドしか出さない**。
    site_summary(サイト掲載の要約)を取りこぼしで書き出さないための関門。"""
    return {
        "chapter": chapter["chapter"],
        "title": chapter["title"],
        "titleReading": chapter["titleReading"],
        "body": [{"text": c["text"], "ruby": c["ruby"]} for c in chapter["body"]],
        "source": build_source(chapter, fetched_ym),
    }


def has_kanji(text):
    return any("㐀" <= ch <= "鿿" for ch in text)


def validate_hen(hen, chapters, require_full=True):
    """1篇ぶんの検証。問題の一覧(文字列)を返す。空なら合格。"""
    problems = []
    numbers = [c["chapter"] for c in chapters]

    duplicates = sorted({n for n in numbers if numbers.count(n) > 1})
    if duplicates:
        problems.append(f"{HEN_LABELS[hen]}: 章番号が重複 {duplicates}")
    if require_full:
        missing = [n for n in range(1, CHAPTERS_PER_HEN + 1) if n not in numbers]
        if missing:
            problems.append(f"{HEN_LABELS[hen]}: 章が足りません {missing}")
    out_of_range = [n for n in numbers if not 1 <= n <= CHAPTERS_PER_HEN]
    if out_of_range:
        problems.append(f"{HEN_LABELS[hen]}: 章番号が範囲外 {out_of_range}")

    for ch in chapters:
        where = f"{HEN_LABELS[hen]}第{ch['chapter']}章"
        for field in ("title", "titleReading"):
            if not ch.get(field):
                problems.append(f"{where}: {field} が空です")
        if not ch.get("source", {}).get("url"):
            problems.append(f"{where}: source.url が空です")
        if has_kanji(ch.get("titleReading", "")):
            problems.append(f"{where}: titleReading に漢字が残っています")
        body = ch.get("body") or []
        if not body:
            problems.append(f"{where}: 本文が空です")
        for i, clause in enumerate(body, 1):
            text, ruby = clause.get("text", ""), clause.get("ruby", "")
            if not text:
                problems.append(f"{where} 第{i}句: text が空です")
            if not ruby:
                problems.append(f"{where} 第{i}句: ruby が空です")
            if has_kanji(ruby):
                problems.append(f"{where} 第{i}句: ruby に漢字が残っています: {ruby}")
            if len(text) > MAX_CLAUSE_CHARS:
                problems.append(
                    f"{where} 第{i}句: {len(text)}字。{MAX_CLAUSE_CHARS}字を超えています"
                )
    return problems


def load_manifest(cache_dir):
    path = os.path.join(cache_dir, "fetch-manifest.json")
    if not os.path.exists(path):
        raise SystemExit(
            f"{path} がありません。先に fetch_gohogo.py を実行してください"
            "(取得は開発者が手元で行うこと)。"
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache-dir", default=CACHE_DIR, help="章ページHTMLの置き場")
    ap.add_argument("--out-dir", default=OUT_DIR, help="JSONの書き出し先")
    ap.add_argument("--check", action="store_true", help="検証だけ行い、書き出さない")
    ap.add_argument("--allow-partial", action="store_true",
                    help="62章そろっていなくても続ける(下見用)")
    args = ap.parse_args()

    manifest = load_manifest(args.cache_dir)
    fetched_ym = str(manifest.get("fetchedAt", ""))[:7] or "取得年月不明"

    by_hen = {"zenpen": [], "kohen": []}
    for entry in manifest["chapters"]:
        path = os.path.join(args.cache_dir, entry["file"])
        if not os.path.exists(path):
            log(f"! {entry['file']} がありません。飛ばします")
            continue
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        try:
            chapter = parse_chapter(html)
        except ParseError as exc:
            log(f"! {entry['file']}: 抽出に失敗しました: {exc}")
            continue
        # 目録の篇・章番号とページの記載が食い違っていないか確かめる
        if (chapter["hen"], chapter["chapter"]) != (entry["hen"], entry["chapter"]):
            log(f"! {entry['file']}: 目録と中身が食い違っています "
                f"(目録 {entry['hen']}{entry['chapter']} / 中身 "
                f"{chapter['hen']}{chapter['chapter']})")
            continue
        chapter["url"] = entry["url"]
        by_hen[chapter["hen"]].append(chapter)

    require_full = not args.allow_partial
    problems = []
    outputs = {}
    for hen in ("zenpen", "kohen"):
        chapters = sorted(by_hen[hen], key=lambda c: c["chapter"])
        out_chapters = [to_output_chapter(c, fetched_ym) for c in chapters]
        problems.extend(validate_hen(hen, out_chapters, require_full))
        outputs[hen] = {
            "version": SCHEMA_VERSION,
            "hen": hen,
            "henLabel": HEN_LABELS[hen],
            "chapters": out_chapters,
        }
        total = sum(len(c["body"]) for c in out_chapters)
        longest = max((len(cl["text"]) for c in out_chapters for cl in c["body"]),
                      default=0)
        log(f"{HEN_LABELS[hen]}: {len(out_chapters)}章 / 全{total}句 / 最長{longest}字")

    if problems:
        log("\n--- 検証で見つかった問題 ---")
        for p in problems:
            log(f"  {p}")
        log(f"{len(problems)} 件。書き出しは行いません。")
        return 1

    log("\n検証: 問題なし")
    if args.check:
        log("--check のため書き出しません。")
        return 0

    os.makedirs(args.out_dir, exist_ok=True)
    for hen, data in outputs.items():
        path = os.path.join(args.out_dir, f"{hen}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        log(f"書き出し: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
