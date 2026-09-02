"""
gohogo_parse.py
知恩院「御法語」の章ページHTMLから、篇・章番号・章題・読み・本文を取り出す。

ネットワークには一切触れない(取得は fetch_gohogo.py の役目)。
この分離のおかげで、抽出ロジックを何度書き直しても再取得は起きない。

■ 取り出さないもの

  現代語訳(<h3 id="gendai"> 以降の <dl class="gendai">)は2010年刊行物由来の
  現代の著作物なので抽出しない。本文は <div class="genbun"> だけを見る。
  現代語訳はその外側にあるため、genbun に限定するだけで確実に除外できる。

  サイト掲載の一文要約(<p class="lead">)も shared/ には入れない。校閲用の
  対照表(factory/output/)を作るときだけ site_summary として使う。

■ ページの作り(実物で確認した形)

  <article class="okotoba-post">
    <div class="okotoba-header ...">
      <div class="label">後篇</div>
      <div class="chap"><span>第一章</span></div>
      <h2 class="ttl"><a ...><ruby>難易二道<rt>なんいにどう</rt></ruby></a></h2>
      <div class="txt">
        <p class="lead">…サイト掲載の要約…</p>
        <p class="source">（浄土宗略抄）</p>
      </div>
    </div>
    <h3 class="conttl"><span>御法語</span></h3>
    <div class="genbun">
      <p>…本文(<ruby>漢字<rt>よみ</rt></ruby> 混じり)…</p>
    </div>
    <h3 id="gendai" class="conttl"><span>現代語訳</span></h3>   ← ここから先は見ない
    <dl class="gendai">…</dl>
  </article>
"""

import re

from bs4 import BeautifulSoup

from gohogo_fixups import apply_missing_ruby, strip_dropped_notes

HEN_BY_LABEL = {"前篇": "zenpen", "後篇": "kohen", "前編": "zenpen", "後編": "kohen"}
HEN_LABELS = {"zenpen": "前篇", "kohen": "後篇"}

# 句の切れ目に使う文字。読点でも切るのは、1句60字の上限に収めるため。
CLAUSE_END_CHARS = "。、！？"

# 縦書きで1句が占めてよい最大字数。
#
# 御法語は全句にルビが付く。ルビ付きの行は app/src/index.css の
# .gongyo-line-has-ruby によって「常に1列」に固定されている(本文とルビが
# 別々に折り返すと対応が崩れるため)。つまり折り返せないので、1句は
# **1列に収まる長さ**でなければ画面の下端をはみ出す。
#
# 従って上限は VERTICAL_MAX_CHARS_PER_LINE(60字=20字×3列)ではなく、
# 1列に入る字数 VERTICAL_CHARS_PER_COLUMN(20字。320〜375px幅での実測16〜19字に
# 由来する)に合わせる。60字にすると375px幅でも下端がはみ出すことを確認済み。
#
# なお gongyo.ts の splitLongBodyItems はルビ付きの句を分割しないので、
# 分けるならここで分けきっておく必要がある(表記と読みの対応を保てるのは
# トークン列を持っているこちら側だけ)。
MAX_CLAUSE_CHARS = 20

_KANJI_DIGITS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
                 "六": 6, "七": 7, "八": 8, "九": 9}


class ParseError(Exception):
    pass


def kanji_to_int(text):
    """「三十一」→31。章番号(1〜31)の範囲だけを想定する"""
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


def tokenize_ruby(element):
    """段落を (表記, 読み) の並びにほどく。

    <ruby>漢字<rt>よみ</rt></ruby> は ("漢字", "よみ")、
    ルビの無い地の文は ("という", None) になる。
    <a class="tooltip"> のような装飾要素は素通りして中身だけを見る。
    """
    tokens = []

    def walk(node):
        for child in node.children:
            name = getattr(child, "name", None)
            if name is None:
                text = str(child)
                if text:
                    tokens.append((text, None))
            elif name == "ruby":
                rt = child.find("rt")
                reading = rt.get_text().strip() if rt else ""
                base = "".join(
                    str(c) for c in child.children
                    if getattr(c, "name", None) not in ("rt", "rp")
                )
                base = re.sub(r"<[^>]+>", "", base).strip()
                if base:
                    tokens.append((base, reading or None))
            elif name in ("rt", "rp"):
                continue
            else:
                walk(child)

    walk(element)
    # 改行由来の空白を潰す(本文中の全角スペースは意味があるので触らない)。
    # あわせて、読誦の対象でない書誌の注記をここで落とす(gohogo_fixups.py)。
    cleaned = []
    for text, reading in tokens:
        text = re.sub(r"[ \t\r\n]+", "", text)
        if reading is None:
            text = strip_dropped_notes(text)
        if text:
            cleaned.append((text, reading))
    return cleaned


def split_tokens_at_punctuation(tokens):
    """ルビの無いトークンを句読点の直後で割り、句の切れ目を作れるようにする。
    ルビ付きトークンは1文字のかたまりとして扱う(読みとの対応を崩さないため)。"""
    out = []
    for text, reading in tokens:
        if reading is not None:
            out.append((text, reading))
            continue
        buf = ""
        for ch in text:
            buf += ch
            if ch in CLAUSE_END_CHARS:
                out.append((buf, None))
                buf = ""
        if buf:
            out.append((buf, None))
    return out


def token_to_json(text, reading):
    """トークンをJSONに書き出す形にする。[表記] か [表記, 読み] の2通り。

    ルビの無い語は読みを持たない(表記がそのまま読みになる)。ただし知恩院の
    ページでルビが落ちている語だけは gohogo_fixups の表で補い、読み付きにする。
    """
    if reading is not None:
        return [text, reading]
    supplied = apply_missing_ruby(text)
    return [text] if supplied == text else [text, supplied]


def clause_text(clause):
    """句の表記(トークンの表記を連ねたもの)"""
    return "".join(token[0] for token in clause["tokens"])


def clause_ruby(clause):
    """句の読み(ルビのある語は読みに、無い語は表記のまま)"""
    return "".join(token[1] if len(token) > 1 else token[0] for token in clause["tokens"])


def build_clauses(tokens, max_chars=MAX_CLAUSE_CHARS):
    """トークン列を句にまとめる。句は {"tokens": [[表記(, 読み)], ...]}。

    句読点の直後で区切るのを基本とし、それでも max_chars を超える場合は
    超える手前のトークン境界で切る。ルビ付きトークンの途中では切らないので、
    表記と読みの対応は必ず保たれる。

    表記と読みを1本の文字列に潰さずトークン列のまま残すのは、読み物画面で
    語ごとに <ruby> を振るため(勤行用の text/ruby はアプリ側で導出する)。
    """
    pieces = split_tokens_at_punctuation(tokens)
    clauses = []
    current = []

    def flush():
        if not current:
            return
        clauses.append({"tokens": [token_to_json(t, r) for t, r in current]})
        current.clear()

    for text, reading in pieces:
        length = sum(len(t) for t, _ in current)
        if current and length + len(text) > max_chars:
            flush()
        current.append((text, reading))
        if text and text[-1] in CLAUSE_END_CHARS:
            if sum(len(t) for t, _ in current) >= max_chars // 2:
                flush()
    flush()

    # 句読点で切った結果あまりに短い句が続く場合、上限の範囲でまとめ直す
    merged = []
    for clause in clauses:
        if merged and len(clause_text(merged[-1])) + len(clause_text(clause)) <= max_chars:
            merged[-1] = {"tokens": merged[-1]["tokens"] + clause["tokens"]}
        else:
            merged.append(clause)
    return merged


def _text_of(node):
    return re.sub(r"\s+", "", node.get_text()) if node else ""


def parse_chapter(html):
    """章ページのHTMLから1章分の情報を取り出す。

    戻り値の site_summary はサイト掲載の要約。shared/ には入れず、
    校閲用の対照表を作るときだけ使うこと。
    """
    soup = BeautifulSoup(html, "html.parser")
    article = soup.find("article", class_="okotoba-post")
    if article is None:
        raise ParseError("article.okotoba-post が見つかりません")

    header = article.find("div", class_="okotoba-header")
    if header is None:
        raise ParseError("div.okotoba-header が見つかりません")

    label = _text_of(header.find("div", class_="label"))
    hen = HEN_BY_LABEL.get(label)
    if hen is None:
        raise ParseError(f"篇を判別できません: {label!r}")

    chap_text = _text_of(header.find("div", class_="chap"))
    m = re.search(r"第([一二三四五六七八九十\d]+)章", chap_text)
    chapter = kanji_to_int(m.group(1)) if m else None
    if chapter is None:
        raise ParseError(f"章番号を読み取れません: {chap_text!r}")

    ttl = header.find("h2", class_="ttl")
    if ttl is None:
        raise ParseError("h2.ttl が見つかりません")
    title_tokens = tokenize_ruby(ttl)
    title = "".join(t for t, _ in title_tokens)
    title_reading = "".join(r if r is not None else t for t, r in title_tokens)
    if not title or not title_reading:
        raise ParseError("章題または読みが空です")

    # 底本の名(例「（浄土宗略抄）」)。出典表記に使う
    genbun_source = _text_of(header.find("p", class_="source")).strip("（）()")

    # 本文。現代語訳(dl.gendai)は genbun の外にあるので、ここに限定すれば混入しない
    genbun = article.find("div", class_="genbun")
    if genbun is None:
        raise ParseError("div.genbun が見つかりません")
    if article.find("dl", class_="gendai") and genbun.find("dl", class_="gendai"):
        raise ParseError("genbun の内側に現代語訳があります(抽出条件の見直しが必要)")

    # 段落の切れ目を残す。読み物として読むときに要るため
    # (勤行側は段落を跨いで平坦にするだけでよい)。
    paragraphs = []
    for para in genbun.find_all("p", recursive=False):
        tokens = tokenize_ruby(para)
        if not tokens:
            continue
        clauses = build_clauses(tokens)
        if clauses:
            paragraphs.append({"clauses": clauses})
    if not paragraphs:
        raise ParseError("本文が空です")

    return {
        "hen": hen,
        "henLabel": HEN_LABELS[hen],
        "chapter": chapter,
        "title": title,
        "titleReading": title_reading,
        "genbunSource": genbun_source,
        "paragraphs": paragraphs,
        # shared/ には書き出さないこと(校閲用の対照表専用)
        "site_summary": _text_of(header.find("p", class_="lead")),
    }
