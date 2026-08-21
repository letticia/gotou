"""典拠機能 A-0 調査: wikitext中の『浄土宗全書』出典表記の実態を集計する。

docs/tenkyo-spec.md の A-0 に対応する使い捨ての調査スクリプト。
factory/cache/articles.json(既存キャッシュ)だけを読み、結果はstdoutにのみ出力する。
新規のネットワークアクセスは一切行わない。

掟(factory/CLAUDE.md・ルートCLAUDE.md):
- 実データ(大辞典由来の本文)を cache/・output/ 以外に書き出さない。
  このスクリプトはファイルを一切書き出さない(stdoutのみ)。
- 集計結果をdocsへ転記する際は、本文を引用せず「パターンの形」と統計だけを残す。

使い方: python3 factory/scripts/investigate_tenkyo.py
"""

import json
import random
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "cache" / "articles.json"

# 出典表記の初期候補(docs/tenkyo-spec.md A-0 の正規表現案)
SERIES = r"(?:浄土宗全書|淨土宗全書|続浄土宗全書|續淨土宗全書|浄全|淨全|続浄|續浄|續淨|法伝全|法然上人伝全集)"
KANJI_NUM = r"[〇一二三四五六七八九十百千]"
NUM = rf"(?:{KANJI_NUM}|[0-9０-９])"
SEP = r"[・･·．.,、,]"
DAN = r"[上中下]"

MAIN_RE = re.compile(rf"({SERIES})\s*({NUM}{{1,4}})\s*({SEP})\s*({NUM}{{1,6}})\s*({DAN})?")

# 叢書名だけが現れる箇所(取りこぼしパターン発見用)
MENTION_RE = re.compile(SERIES)

# 既存の外部リンク・テンプレート
EXT_LINK_RE = re.compile(r"\[(https?://[^\s\]]+)([^\]]*)\]")
TEMPLATE_RE = re.compile(r"\{\{([^}|]+)")

KNOWN_HOSTS = {
    "jozensearch": "浄全DB(jozensearch)",
    "jodoshuzensho": "jodoshuzensho.jp",
    "21dzk": "SAT(21dzk)",
    "sat.ecs": "SAT",
    "tripitaka": "SAT/Tripitaka",
}

# 狙い撃ちサンプル(宗典・祖師関係。表記ゆれの上限を見るための系統)
TARGETED_TITLES = [
    "選択本願念仏集", "一枚起請文", "一紙小消息", "往生要集", "観無量寿経",
    "無量寿経", "阿弥陀経", "法然", "善導", "源信", "聖光", "良忠",
    "授手印", "徹選択集", "五重相伝", "法事讃", "観念法門", "往生礼讃",
    "散善義", "玄義分", "序分義", "定善義", "選択集", "浄土宗略抄",
    "黒谷上人語灯録", "和語灯録", "漢語灯録", "拾遺和語灯録", "四十八巻伝",
    "勅修御伝", "醍醐本", "西方指南抄", "念仏往生要義抄", "登山状",
]


def numeral_kind(s: str) -> str:
    """数字表記の種別を返す(値そのものではなく『形』の分類)。"""
    if re.fullmatch(r"[0-9]+", s):
        return "算用(半角)"
    if re.fullmatch(r"[０-９]+", s):
        return "算用(全角)"
    if re.search(r"[十百千]", s):
        # 十五 / 百 / 千五百二十 のような命数式
        return "漢数字(命数式)"
    if re.fullmatch(rf"{KANJI_NUM}+", s):
        return "漢数字(位取り)"
    return "混在/その他"


def sep_name(ch: str) -> str:
    try:
        return f"{ch!r} U+{ord(ch):04X} {unicodedata.name(ch)}"
    except ValueError:
        return f"{ch!r} U+{ord(ch):04X}"


def analyze(articles, label, out):
    """記事群を走査し、出典表記の形を集計する。"""
    series_c = Counter()
    vol_kind_c = Counter()
    page_kind_c = Counter()
    sep_c = Counter()
    dan_c = Counter()
    shape_c = Counter()
    samples_by_shape = {}
    hit_articles = 0
    total_matches = 0

    # 範囲・列挙・括弧などの周辺形
    range_c = Counter()
    bracket_c = Counter()

    for art in articles:
        wt = art.get("wikitext") or ""
        found = list(MAIN_RE.finditer(wt))
        if found:
            hit_articles += 1
        for m in found:
            total_matches += 1
            series, vol, sep, page, dan = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
            series_c[series] += 1
            vk, pk = numeral_kind(vol), numeral_kind(page)
            vol_kind_c[vk] += 1
            page_kind_c[pk] += 1
            sep_c[sep] += 1
            dan_c[dan or "(段なし)"] += 1

            shape = f"{series} + 巻[{vk}] + {sep!r} + 頁[{pk}] + 段[{dan or 'なし'}]"
            shape_c[shape] += 1
            samples_by_shape.setdefault(shape, [])
            if len(samples_by_shape[shape]) < 3:
                samples_by_shape[shape].append(m.group(0))

            # 直後の文字を見て範囲・列挙の有無を判定
            tail = wt[m.end():m.end() + 3]
            if tail[:1] in "〜～-−–—ー":
                range_c["範囲(〜等が続く)"] += 1
            elif tail[:1] in "・,、,":
                range_c["列挙(区切りが続く)"] += 1
            else:
                range_c["単独"] += 1

            head = wt[max(0, m.start() - 1):m.start()]
            if head in "（(【〔「":
                bracket_c["直前が開き括弧"] += 1
            else:
                bracket_c["括弧なし"] += 1

    p = out
    p(f"\n{'=' * 70}")
    p(f"【{label}】記事数 {len(articles)} 件")
    p(f"{'=' * 70}")
    p(f"出典表記を含む記事: {hit_articles} 件 ({hit_articles / len(articles) * 100:.1f}%)")
    p(f"出典表記の総出現数: {total_matches} 件")
    if total_matches == 0:
        return

    p(f"\n-- 叢書名 --")
    for k, v in series_c.most_common():
        p(f"  {v:>7} {k}")
    p(f"\n-- 巻の数字表記 --")
    for k, v in vol_kind_c.most_common():
        p(f"  {v:>7} {k}")
    p(f"\n-- 頁の数字表記 --")
    for k, v in page_kind_c.most_common():
        p(f"  {v:>7} {k}")
    p(f"\n-- 区切り文字 --")
    for k, v in sep_c.most_common():
        p(f"  {v:>7} {sep_name(k)}")
    p(f"\n-- 段 --")
    for k, v in dan_c.most_common():
        p(f"  {v:>7} {k}")
    p(f"\n-- 直後の形(範囲・列挙) --")
    for k, v in range_c.most_common():
        p(f"  {v:>7} {k}")
    p(f"\n-- 直前の括弧 --")
    for k, v in bracket_c.most_common():
        p(f"  {v:>7} {k}")

    p(f"\n-- パターンの組み合わせ(上位20) --")
    for shape, v in shape_c.most_common(20):
        p(f"  {v:>7} {shape}")
        p(f"          実例: {' / '.join(samples_by_shape[shape])}")


def analyze_mentions(articles, out):
    """MAIN_REにマッチしない『浄全』等の出現を、周辺の形だけ分類する(取りこぼし発見)。"""
    p = out
    missed_shapes = Counter()
    missed_samples = {}
    total_mentions = 0
    matched_spans = 0

    for art in articles:
        wt = art.get("wikitext") or ""
        spans = [(m.start(), m.end()) for m in MAIN_RE.finditer(wt)]
        for m in MENTION_RE.finditer(wt):
            total_mentions += 1
            if any(s <= m.start() < e for s, e in spans):
                matched_spans += 1
                continue
            # マッチしなかった箇所: 直後8文字の『形』だけを分類する
            tail = wt[m.end():m.end() + 8]
            shape = []
            for ch in tail:
                if re.match(r"[0-9０-９]", ch):
                    shape.append("D")
                elif re.match(KANJI_NUM, ch):
                    shape.append("K")
                elif ch in "上中下":
                    shape.append("d")
                elif ch in "・･·．.,、,":
                    shape.append("s")
                elif ch.isspace():
                    shape.append("_")
                else:
                    shape.append("x")
            sig = "".join(shape)
            missed_shapes[sig] += 1
            missed_samples.setdefault(sig, [])
            if len(missed_samples[sig]) < 2:
                missed_samples[sig].append(m.group(0) + tail)

    p(f"\n{'=' * 70}")
    p("【取りこぼし調査】叢書名の出現のうち、出典表記パターンに乗らなかったもの")
    p(f"{'=' * 70}")
    p(f"叢書名の総出現: {total_mentions} 件 / うちパターン内: {matched_spans} 件 "
      f"/ 取りこぼし: {total_mentions - matched_spans} 件")
    p("凡例: D=算用数字 K=漢数字 d=段(上中下) s=区切り _=空白 x=その他")
    p("\n-- 直後8文字の形(上位25) --")
    for sig, v in missed_shapes.most_common(25):
        p(f"  {v:>7} [{sig}]  実例: {' / '.join(repr(s) for s in missed_samples[sig])}")


def analyze_links(articles, out):
    """既存の外部リンク・テンプレートに浄全DB/SATリンクが埋まっているかを調べる。"""
    p = out
    host_c = Counter()
    template_c = Counter()
    ext_total = 0
    link_samples = {}

    for art in articles:
        wt = art.get("wikitext") or ""
        for m in EXT_LINK_RE.finditer(wt):
            ext_total += 1
            url = m.group(1).lower()
            for key, label in KNOWN_HOSTS.items():
                if key in url:
                    host_c[label] += 1
                    link_samples.setdefault(label, [])
                    if len(link_samples[label]) < 3:
                        link_samples[label].append(m.group(1))
        for m in TEMPLATE_RE.finditer(wt):
            template_c[m.group(1).strip()] += 1

    p(f"\n{'=' * 70}")
    p("【既存リンク調査】wikitext中の外部リンク・テンプレート")
    p(f"{'=' * 70}")
    p(f"外部リンク [http...] の総数: {ext_total} 件")
    if host_c:
        p("\n-- 浄全DB/SAT等へのリンク --")
        for k, v in host_c.most_common():
            p(f"  {v:>7} {k}")
            for s in link_samples[k]:
                p(f"          {s}")
    else:
        p("\n  ★ 浄全DB(jozensearch)・SAT等へのリンクは wikitext 中に存在しない")

    p(f"\n-- テンプレート {{{{...}}}} の使用(上位20) --")
    if template_c:
        for k, v in template_c.most_common(20):
            p(f"  {v:>7} {{{{{k}}}}}")
    else:
        p("  (テンプレートの使用なし)")


def main():
    if not CACHE.exists():
        sys.exit(f"キャッシュが見つかりません: {CACHE}")

    articles = json.loads(CACHE.read_text(encoding="utf-8"))
    out = print

    out(f"調査対象: {CACHE} ({len(articles)} 件)")
    out("※ 新規のネットワークアクセスは行っていません(既存キャッシュのみ)")

    # 系統a: 狙い撃ち(表記ゆれの上限を見る)
    by_title = {a["title"]: a for a in articles}
    targeted = []
    for t in TARGETED_TITLES:
        if t in by_title:
            targeted.append(by_title[t])
    # 完全一致で足りない分は部分一致で補充
    if len(targeted) < 30:
        seen = {a["title"] for a in targeted}
        for t in TARGETED_TITLES:
            if len(targeted) >= 30:
                break
            for a in articles:
                if t in a["title"] and a["title"] not in seen:
                    targeted.append(a)
                    seen.add(a["title"])
                    break
    targeted = targeted[:30]

    # 系統b: 無作為(カバレッジを見る。seed固定で再現可能)
    rng = random.Random(20260816)
    random_sample = rng.sample(articles, 30)

    analyze(targeted, "系統a: 狙い撃ち30件(宗典・祖師関係)", out)
    analyze(random_sample, "系統b: 無作為30件(seed=20260816)", out)
    analyze(articles, "全件走査(キャッシュ全記事)", out)
    analyze_mentions(articles, out)
    analyze_links(articles, out)


if __name__ == "__main__":
    main()
