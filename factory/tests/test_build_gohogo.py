"""shared/gohogo/*.json を組み立てる側のテスト。

実データは使わない。tests/fixtures/gohogo/ の自作ダミー章と、
手で組んだ辞書だけを使う。
"""

import json
import os

import pytest

from build_gohogo import (
    build_source,
    int_to_kanji,
    main,
    to_output_chapter,
    validate_hen,
)
from gohogo_parse import MAX_CLAUSE_CHARS, parse_chapter


def paragraphs_of(*clause_token_lists):
    """検証用に、句のトークン列から paragraphs の形を組み立てる"""
    return [{"clauses": [{"tokens": tokens} for tokens in clause_token_lists]}]

FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "gohogo")


def sample_chapter(**overrides):
    base = {
        "chapter": 1,
        "title": "試験章題",
        "titleReading": "しけんしょうだい",
        "paragraphs": paragraphs_of([["ただ"], ["念仏", "ねんぶつ"], ["すべし。"]]),
        "source": {"name": "ダミー", "url": "https://example.invalid/f01/", "license": "PD"},
    }
    base.update(overrides)
    return base


class TestIntToKanji:
    @pytest.mark.parametrize("n,expected", [
        (1, "一"), (9, "九"), (10, "十"), (11, "十一"),
        (20, "二十"), (21, "二十一"), (30, "三十"), (31, "三十一"),
    ])
    def test_chapter_numbers(self, n, expected):
        assert int_to_kanji(n) == expected


class TestBuildSource:
    def test_names_the_underlying_text_and_keeps_the_caveat(self):
        parsed = parse_chapter(open(os.path.join(FIXTURES_DIR, "zenpen-01.html"),
                                    encoding="utf-8").read())
        parsed["url"] = "https://example.invalid/f01/"
        source = build_source(parsed, "2026-09")
        assert "『元祖大師御法語』前篇第一章「試験章題」" in source["name"]
        assert "法然上人遺文(ダミー底本)からの抜粋" in source["name"]
        assert "2026-09取得" in source["name"]
        # 読みが未検証であることは必ず残す
        assert "読みは要点検" in source["name"]
        assert source["license"] == "PD"
        assert source["url"] == "https://example.invalid/f01/"

    def test_falls_back_when_the_page_names_no_underlying_text(self):
        chapter = {"hen": "kohen", "chapter": 30, "title": "章題",
                   "genbunSource": "", "url": "https://example.invalid/s30/"}
        assert "法然上人遺文からの抜粋" in build_source(chapter, "2026-09")["name"]


class TestToOutputChapter:
    def test_does_not_leak_the_site_summary(self):
        # parse_chapter は site_summary を返すが、shared/ に出してはいけない
        parsed = parse_chapter(open(os.path.join(FIXTURES_DIR, "zenpen-01.html"),
                                    encoding="utf-8").read())
        parsed["url"] = "https://example.invalid/f01/"
        assert parsed["site_summary"]
        out = to_output_chapter(parsed, "2026-09")
        assert set(out) == {"chapter", "title", "titleReading", "paragraphs", "source"}
        assert parsed["site_summary"] not in json.dumps(out, ensure_ascii=False)

    def test_body_keeps_only_the_tokens(self):
        parsed = parse_chapter(open(os.path.join(FIXTURES_DIR, "zenpen-02.html"),
                                    encoding="utf-8").read())
        parsed["url"] = "https://example.invalid/f02/"
        out = to_output_chapter(parsed, "2026-09")
        for para in out["paragraphs"]:
            assert set(para) == {"clauses"}
            for clause in para["clauses"]:
                assert set(clause) == {"tokens"}
                for token in clause["tokens"]:
                    assert 1 <= len(token) <= 2


class TestValidateHen:
    def test_a_full_hen_passes(self):
        chapters = [sample_chapter(chapter=n) for n in range(1, 32)]
        assert validate_hen("zenpen", chapters) == []

    def test_reports_missing_chapters(self):
        chapters = [sample_chapter(chapter=n) for n in range(1, 31)]
        problems = validate_hen("zenpen", chapters)
        assert any("章が足りません" in p and "31" in p for p in problems)

    def test_reports_duplicate_chapters(self):
        chapters = [sample_chapter(chapter=n) for n in range(1, 32)]
        chapters.append(sample_chapter(chapter=5))
        assert any("重複" in p for p in validate_hen("zenpen", chapters))

    def test_reports_a_chapter_number_out_of_range(self):
        problems = validate_hen("zenpen", [sample_chapter(chapter=32)],
                                require_full=False)
        assert any("範囲外" in p for p in problems)

    def test_reports_kanji_left_in_a_reading(self):
        problems = validate_hen("zenpen", [sample_chapter(titleReading="試験しょうだい")],
                                require_full=False)
        assert any("titleReading に漢字" in p for p in problems)

    def test_reports_kanji_left_in_a_clause_reading(self):
        # 読みを持たないトークンの表記に漢字が残っていると、導出した読みにも残る
        bad = sample_chapter(paragraphs=paragraphs_of([["ただ念仏すべし。"]]))
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("読みに漢字" in p for p in problems)

    def test_reports_an_empty_body(self):
        problems = validate_hen("zenpen", [sample_chapter(paragraphs=[])],
                                require_full=False)
        assert any("本文が空" in p for p in problems)

    def test_reports_an_empty_clause(self):
        bad = sample_chapter(paragraphs=paragraphs_of([]))
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("tokens が空" in p for p in problems)

    def test_reports_a_token_with_no_surface(self):
        bad = sample_chapter(paragraphs=paragraphs_of([["", "よみ"]]))
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("表記が空のトークン" in p for p in problems)

    def test_reports_a_malformed_token(self):
        bad = sample_chapter(paragraphs=paragraphs_of([["あ", "い", "う"]]))
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("トークンの形" in p for p in problems)

    def test_reports_a_clause_over_the_limit(self):
        long_text = "あ" * (MAX_CLAUSE_CHARS + 1)
        bad = sample_chapter(paragraphs=paragraphs_of([[long_text]]))
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("字を超えています" in p for p in problems)

    def test_reports_a_missing_source_url(self):
        bad = sample_chapter(source={"name": "x", "url": "", "license": "PD"})
        problems = validate_hen("zenpen", [bad], require_full=False)
        assert any("source.url が空" in p for p in problems)


class TestEndToEnd:
    def test_builds_json_from_the_dummy_fixtures(self, tmp_path, monkeypatch, capsys):
        """ダミー3章から実際にJSONを書き出せること。
        --allow-partial は62章そろっていない下見用の経路。"""
        cache = tmp_path / "cache"
        cache.mkdir()
        manifest = {"fetchedAt": "2026-09-03",
                    "indexUrl": "https://example.invalid/okotoba/", "chapters": []}
        for name, hen, chapter in [("zenpen-01.html", "zenpen", 1),
                                   ("zenpen-02.html", "zenpen", 2),
                                   ("kohen-30.html", "kohen", 30)]:
            (cache / name).write_text(
                open(os.path.join(FIXTURES_DIR, name), encoding="utf-8").read(),
                encoding="utf-8")
            manifest["chapters"].append({"hen": hen, "chapter": chapter,
                                         "url": f"https://example.invalid/{name}",
                                         "file": name})
        (cache / "fetch-manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False), encoding="utf-8")

        out = tmp_path / "out"
        monkeypatch.setattr("sys.argv", [
            "build_gohogo.py", "--cache-dir", str(cache), "--out-dir", str(out),
            "--allow-partial",
        ])
        assert main() == 0

        data = json.loads((out / "zenpen.json").read_text(encoding="utf-8"))
        assert data["version"] == 1
        assert data["hen"] == "zenpen" and data["henLabel"] == "前篇"
        assert [c["chapter"] for c in data["chapters"]] == [1, 2]
        assert data["chapters"][0]["title"] == "試験章題"
        assert data["chapters"][0]["paragraphs"][0]["clauses"][0]["tokens"][0] == [
            "試験", "しけん",
        ]
        # サイト掲載の要約がどこにも混ざっていないこと
        assert "ダミーの要約文である。" not in (out / "zenpen.json").read_text(encoding="utf-8")
        # 現代語訳も混ざっていないこと
        assert "現代語訳" not in (out / "zenpen.json").read_text(encoding="utf-8")

    def test_refuses_to_write_when_chapters_are_missing(self, tmp_path, monkeypatch):
        cache = tmp_path / "cache"
        cache.mkdir()
        (cache / "zenpen-01.html").write_text(
            open(os.path.join(FIXTURES_DIR, "zenpen-01.html"), encoding="utf-8").read(),
            encoding="utf-8")
        (cache / "fetch-manifest.json").write_text(json.dumps({
            "fetchedAt": "2026-09-03", "chapters": [
                {"hen": "zenpen", "chapter": 1,
                 "url": "https://example.invalid/f01/", "file": "zenpen-01.html"}]},
            ensure_ascii=False), encoding="utf-8")
        out = tmp_path / "out"
        monkeypatch.setattr("sys.argv", [
            "build_gohogo.py", "--cache-dir", str(cache), "--out-dir", str(out)])
        assert main() == 1
        assert not out.exists()
