import wikitext


def test_extract_yomi_with_pattern():
    headword, yomi = wikitext.extract_yomi_and_clean_headword(
        "見出し語", "=よみがな／見出し語=\n本文"
    )
    assert headword == "見出し語"
    assert yomi == "よみがな"

def test_extract_yomi_without_pattern():
    headword, yomi = wikitext.extract_yomi_and_clean_headword(
        "タイトルのみ", "=タイトルのみ=\n本文"
    )
    assert headword == "タイトルのみ"
    assert yomi == "タイトルのみ"

def test_clean_wikitext_resolves_internal_link():
    title_map = {"リンク先": "entry_2"}
    resolved = []
    html = wikitext.clean_wikitext(
        "=よみ／タイトル=\n[[リンク先]]を参照。", title_map, link_sink=resolved.append
    )
    assert "x-dictionary:r:entry_2" in html
    assert resolved == ["entry_2"]

def test_clean_wikitext_reports_broken_link():
    broken = []
    html = wikitext.clean_wikitext(
        "=よみ／タイトル=\n[[存在しない項目]]を参照。", {}, broken_link_sink=broken.append
    )
    assert broken == ["存在しない項目"]
    assert "x-dictionary:r:" in html

def test_clean_wikitext_table():
    html = wikitext.clean_wikitext(
        '=よみ／タイトル=\n{|class="wikitable"\n! A !! B\n|-\n| 1 || 2\n|}', {}
    )
    assert '<table class="wikitable">' in html
    assert "<th>A</th>" in html
    assert "<td>1</td>" in html

def test_clean_wikitext_lists():
    html = wikitext.clean_wikitext("=よみ／タイトル=\n* 一\n* 二", {})
    assert "<ul>" in html
    assert "<li>一</li>" in html

def test_clean_wikitext_bold_italic():
    html = wikitext.clean_wikitext("=よみ／タイトル=\n'''太字'''と''斜体''", {})
    assert "<b>太字</b>" in html
    assert "<i>斜体</i>" in html

def test_clean_wikitext_image():
    html = wikitext.clean_wikitext(
        "=よみ／タイトル=\n[[File:sample.jpg|thumb|キャプション]]", {}
    )
    assert 'class="dict-image"' in html
    assert 'src="sample.jpg"' in html
    assert "キャプション" in html

def test_clean_wikitext_section_heading_and_hr():
    html = wikitext.clean_wikitext("=よみ／タイトル=\n== 概要 ==\n本文\n----", {})
    assert 'class="dict-section-heading"' in html
    assert '<hr class="section-divider"/>' in html

def test_build_title_id_map():
    articles = [
        {"pageid": "1", "title": "アルファ", "wikitext": "=あるふぁ／アルファ=\n本文"},
        {"pageid": "2", "title": "ベータ", "wikitext": "=べーた／ベータ=\n本文"},
    ]
    title_map = wikitext.build_title_id_map(articles)
    assert title_map["アルファ"] == "entry_1"
    assert title_map["ベータ"] == "entry_2"

def test_fixture_articles_parse_without_error(articles):
    """fixture 100件すべてがエラー無くHTML変換できることのスモークテスト"""
    title_map = wikitext.build_title_id_map(articles)
    for art in articles:
        html = wikitext.clean_wikitext(art["wikitext"], title_map)
        assert html
