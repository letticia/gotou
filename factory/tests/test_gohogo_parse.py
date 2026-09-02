"""御法語の抽出ロジックのテスト。

実データは使わない(掟: テスト・CIで実データを使わない)。
tests/fixtures/gohogo/ の自作ダミー章だけを読む。ダミーは知恩院のページと
同じマークアップの形にしてあるが、中身の文言はすべてこちらで作ったもの。
"""

import os

import pytest

from gohogo_parse import (
    MAX_CLAUSE_CHARS,
    ParseError,
    build_clauses,
    kanji_to_int,
    parse_chapter,
    tokenize_ruby,
)

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "gohogo")


def load(name):
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return f.read()


class TestKanjiToInt:
    @pytest.mark.parametrize("text,expected", [
        ("一", 1), ("九", 9), ("十", 10), ("十一", 11),
        ("二十", 20), ("三十", 30), ("三十一", 31), ("30", 30),
    ])
    def test_valid(self, text, expected):
        assert kanji_to_int(text) == expected

    @pytest.mark.parametrize("text", ["", "三十二", "百", "章", "0"])
    def test_out_of_range_or_unreadable(self, text):
        assert kanji_to_int(text) is None


class TestParseChapter:
    def test_reads_hen_chapter_title_and_reading(self):
        ch = parse_chapter(load("zenpen-01.html"))
        assert ch["hen"] == "zenpen"
        assert ch["henLabel"] == "前篇"
        assert ch["chapter"] == 1
        assert ch["title"] == "試験章題"
        assert ch["titleReading"] == "しけんしょうだい"

    def test_reads_two_digit_chapter_of_kohen(self):
        ch = parse_chapter(load("kohen-30.html"))
        assert ch["hen"] == "kohen"
        assert ch["chapter"] == 30

    def test_keeps_the_underlying_text_name(self):
        ch = parse_chapter(load("zenpen-01.html"))
        assert ch["genbunSource"] == "ダミー底本"

    def test_body_pairs_text_with_a_kana_reading(self):
        ch = parse_chapter(load("zenpen-01.html"))
        assert ch["body"][0]["text"] == "試験のための文なり。二つ目の句なり。"
        assert ch["body"][0]["ruby"] == "しけんのためのぶんなり。ふたつめのくなり。"

    def test_each_paragraph_starts_a_new_clause(self):
        ch = parse_chapter(load("kohen-30.html"))
        assert len(ch["body"]) == 2
        assert ch["body"][0]["text"].startswith("後篇の")
        assert ch["body"][1]["text"].startswith("二段落目")

    def test_does_not_take_the_modern_translation(self):
        # 現代語訳は2010年刊行物由来。抽出したら掟違反になる
        ch = parse_chapter(load("zenpen-01.html"))
        joined = "".join(b["text"] for b in ch["body"])
        assert "現代語訳" not in joined
        assert "抽出されてはいけません" not in joined

    def test_exposes_the_site_summary_separately(self):
        # shared/ には書き出さないが、校閲用の対照表には要る
        ch = parse_chapter(load("zenpen-01.html"))
        assert ch["site_summary"] == "ダミーの要約文である。"
        assert "summary" not in ch

    def test_rejects_a_page_that_is_not_a_chapter(self):
        with pytest.raises(ParseError):
            parse_chapter("<html><body><p>目次</p></body></html>")


class TestClauseSplitting:
    def test_long_paragraph_is_split_within_the_limit(self):
        ch = parse_chapter(load("zenpen-02.html"))
        assert len(ch["body"]) > 1
        for clause in ch["body"]:
            assert len(clause["text"]) <= MAX_CLAUSE_CHARS

    def test_split_never_breaks_a_ruby_word(self):
        # 表記と読みの対応が崩れていないこと。「甲乙丙」が割れていれば
        # そのぶん読みの「こうおつへい」も崩れる
        ch = parse_chapter(load("zenpen-02.html"))
        for clause in ch["body"]:
            assert clause["text"].count("甲乙丙") == clause["ruby"].count("こうおつへい")

    def test_reading_is_kana_only(self):
        for name in ("zenpen-01.html", "zenpen-02.html", "kohen-30.html"):
            ch = parse_chapter(load(name))
            for clause in ch["body"]:
                for ch_ in clause["ruby"]:
                    assert not ("一" <= ch_ <= "鿿"), (
                        f"{name}: 読みに漢字が残っている: {clause['ruby']}"
                    )

    def test_no_empty_clause(self):
        ch = parse_chapter(load("zenpen-02.html"))
        assert all(clause["text"] for clause in ch["body"])
        assert all(clause["ruby"] for clause in ch["body"])

    def test_build_clauses_keeps_plain_text_without_ruby(self):
        tokens = [("ただ", None), ("念仏", "ねんぶつ"), ("すべし。", None)]
        assert build_clauses(tokens) == [
            {"text": "ただ念仏すべし。", "ruby": "ただねんぶつすべし。"}
        ]

    def test_tokenize_ruby_ignores_decorative_wrappers(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            '<p><a class="tooltip" href="#"><ruby>本願<rt>ほんがん</rt></ruby></a>を頼め。</p>',
            "html.parser",
        )
        assert tokenize_ruby(soup.find("p")) == [("本願", "ほんがん"), ("を頼め。", None)]
