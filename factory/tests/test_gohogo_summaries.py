"""一文要約と、サイト掲載の要約との類似チェックのテスト。

類似度の関数は純粋なので実データを使わずに確かめられる。
要約そのもの(SUMMARIES)は、そろっているか・字数に収まっているかという
機械的な観点だけを見る。**内容の当否は人(僧侶)の校閲による。**
"""

import pytest

from gohogo_summaries import (
    MAX_SUMMARY_CHARS,
    MIN_SUMMARY_CHARS,
    SIMILARITY_LIMIT,
    SUMMARIES,
    bigram_dice,
    expected_title,
    get_summary,
    sequence_ratio,
    similarity,
    similarity_report,
)


class TestSummaries:
    def test_covers_every_chapter_of_both_hen(self):
        for hen in ("zenpen", "kohen"):
            for chapter in range(1, 32):
                assert get_summary(hen, chapter), f"{hen} 第{chapter}章 の要約がありません"

    def test_has_no_extra_entries(self):
        assert len(SUMMARIES) == 62
        for hen, chapter in SUMMARIES:
            assert hen in ("zenpen", "kohen")
            assert 1 <= chapter <= 31

    def test_every_entry_carries_a_title(self):
        for (hen, chapter), entry in SUMMARIES.items():
            assert len(entry) == 2, f"{hen} 第{chapter}章 の形が (章題, 要約) ではありません"
            assert entry[0], f"{hen} 第{chapter}章 の章題が空です"

    def test_every_summary_fits_the_length_range(self):
        for (hen, chapter), (_title, summary) in SUMMARIES.items():
            assert MIN_SUMMARY_CHARS <= len(summary) <= MAX_SUMMARY_CHARS, (
                f"{hen} 第{chapter}章 が{len(summary)}字"
            )

    def test_every_summary_ends_as_one_sentence(self):
        for (hen, chapter), (_title, summary) in SUMMARIES.items():
            assert summary.endswith("。"), f"{hen} 第{chapter}章 が句点で終わっていません"
            assert "\n" not in summary

    def test_returns_none_outside_the_range(self):
        assert get_summary("zenpen", 32) is None
        assert get_summary("chuhen", 1) is None

    def test_matches_on_the_chapter_title(self):
        assert get_summary("zenpen", 1, expected_title("zenpen", 1))

    def test_refuses_when_the_title_does_not_match(self):
        # 章の順序が変わった・別の章に振り替わった場合を黙って通さない
        assert get_summary("zenpen", 1, "別の章題") is None


class TestSimilarity:
    def test_identical_text_scores_one(self):
        assert bigram_dice("念仏せよ。", "念仏せよ。") == pytest.approx(1.0)
        assert sequence_ratio("念仏せよ。", "念仏せよ。") == pytest.approx(1.0)

    def test_unrelated_text_scores_low(self):
        assert similarity("念仏を称えよ。", "本日は晴天なり。") < 0.3

    def test_bigram_dice_catches_a_reordering(self):
        # 並びを入れ替えただけの言い換えは SequenceMatcher では下がるが
        # 2文字組では高いまま残る
        a = "智慧を極めて生死を離れ、愚痴に還って極楽に生まれる。"
        b = "愚痴に還って極楽に生まれ、智慧を極めて生死を離れる。"
        assert bigram_dice(a, b) > sequence_ratio(a, b)

    def test_short_or_empty_text(self):
        assert bigram_dice("", "") == pytest.approx(1.0)
        assert bigram_dice("", "あ") == pytest.approx(0.0)


class TestSimilarityReport:
    def test_flags_an_exact_copy(self):
        too_close, score, _ = similarity_report("同じ文。", "同じ文。")
        assert too_close and score == pytest.approx(1.0)

    def test_flags_a_near_copy(self):
        too_close, score, _ = similarity_report(
            "私の遺跡を一箇所に限ってはならない。念仏の声する所みなわが遺跡である。",
            "遺跡を一箇所に限ってはならない。念仏の修される所はみな我が遺跡である。",
        )
        assert too_close
        assert score >= SIMILARITY_LIMIT

    def test_passes_an_independently_written_summary(self):
        too_close, score, _ = similarity_report(
            "一つの廟に跡を留めれば教えは行き渡らない。貴賤を問わず念仏する所すべてが遺跡となる。",
            "私の遺跡を一箇所に限ってはならない。念仏の声する所みなわが遺跡である。",
        )
        assert not too_close
        assert score < SIMILARITY_LIMIT

    def test_says_nothing_when_there_is_no_site_summary(self):
        too_close, score, parts = similarity_report("こちらの要約。", "")
        assert not too_close and score == 0.0
        assert parts == {"dice": 0.0, "ratio": 0.0}

    def test_reports_both_measures(self):
        _, score, parts = similarity_report("念仏を称えよ。", "念仏を申せ。")
        assert set(parts) == {"dice", "ratio"}
        assert score == pytest.approx(max(parts["dice"], parts["ratio"]))
