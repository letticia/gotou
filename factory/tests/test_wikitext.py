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

def test_clean_wikitext_table_caption():
    """|+ キャプション行がデータセルとして誤解釈されず<caption>になること"""
    html = wikitext.clean_wikitext(
        '=よみ／タイトル=\n{|class="wikitable"\n|+ 表題\n! A\n|-\n| 1\n|}', {}
    )
    assert "<caption>表題</caption>" in html
    assert "<th>A</th>" in html
    assert "<td>1</td>" in html
    # キャプションが余分なセルとしてヘッダー行に混入していないこと
    assert html.count("<th>") == 1

def test_clean_wikitext_table_without_blank_line_before():
    """表の直前に空行が無くても、地の文と混じって<br/>が挿入されないこと"""
    html = wikitext.clean_wikitext(
        '=よみ／タイトル=\n本文の続き。\n{|class="wikitable"\n! A\n|-\n| 1\n|}', {}
    )
    assert "<br/>" not in html
    assert html.startswith("<p>本文の続き。</p>")
    assert '<table class="wikitable">' in html

def test_clean_wikitext_heading_without_blank_line_before():
    """見出しの直前に空行が無くても、地の文と混じって<br/>が挿入されないこと"""
    html = wikitext.clean_wikitext("=よみ／タイトル=\n本文\n== 見出し ==\n続き", {})
    assert "<br/>" not in html
    assert html == (
        "<p>本文</p>"
        '<h2 class="dict-section-heading"><span class="no-dict-link">見出し</span></h2>'
        "<p>続き</p>"
    )

def test_clean_wikitext_hr_without_blank_line_before():
    """水平線の直前に空行が無くても、地の文と混じって<br/>が挿入されないこと"""
    html = wikitext.clean_wikitext("=よみ／タイトル=\n本文\n----\n続き", {})
    assert "<br/>" not in html
    assert html == '<p>本文</p><hr class="section-divider"/><p>続き</p>'

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

# --- 典拠リンク(docs/tenkyo-spec.md A-1) ---------------------------------
# app/src/lib/wikitextConvert.test.ts の同名ケースと対応させること。
# URLの形は本物だが、記事本文は一切使わず自作のダミー文で組み立てている。

def test_clean_wikitext_marks_jozen_db_link_as_tenkyo():
    html = wikitext.clean_wikitext(
        "[http://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508 浄全九・五〇八上]",
        {},
    )
    assert 'class="external-link tenkyo-link"' in html
    # 典拠DBはhttps配信のため引き上げる
    assert 'href="https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508"' in html
    # 表示テキストは原文のまま
    assert ">浄全九・五〇八上</a>" in html


def test_clean_wikitext_marks_sat_link_as_tenkyo():
    html = wikitext.clean_wikitext(
        "[http://21dzk.l.u-tokyo.ac.jp/SAT2018/V51.0861a.html 正蔵五一・八六一上]", {}
    )
    assert 'class="external-link tenkyo-link"' in html
    assert 'href="https://21dzk.l.u-tokyo.ac.jp/SAT2018/V51.0861a.html"' in html


def test_clean_wikitext_keeps_plain_external_link_unmarked():
    html = wikitext.clean_wikitext("[http://example.com/foo 例]", {})
    assert 'class="external-link"' in html
    assert "tenkyo-link" not in html
    # 未検証のホストはhttpのまま書き換えない
    assert 'href="http://example.com/foo"' in html


def test_clean_wikitext_marks_bare_tenkyo_link():
    html = wikitext.clean_wikitext(
        "[http://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=Z15_0203]", {}
    )
    assert 'class="external-link tenkyo-link"' in html
    # ラベル省略時はhttps化した後のURLを表示に使う(hrefと表示を食い違わせない)
    assert ">https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=Z15_0203</a>" in html


def test_clean_wikitext_marks_raw_tenkyo_url():
    html = wikitext.clean_wikitext(
        "参照 https://21dzk.l.u-tokyo.ac.jp/SAT2018/V39.0586b.html", {}
    )
    assert 'class="external-link tenkyo-link"' in html


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
