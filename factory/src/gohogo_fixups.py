"""
gohogo_fixups.py
知恩院のページに読みが無い箇所を、こちらで補うための表。

**当て推量で読みを当てない。** 一件ずつ出所を書き、根拠の無いものは
補わずに検証で落とす(build_gohogo.py が「ルビに漢字が残っています」として
書き出しを止める)。factory/CLAUDE.md の「読みが無い項目は保留リストに出力して
人間が確認する」と同じ考え方。

再取得しても効き続けるよう、パーサ本体ではなくこの表に集約する。
"""

# ルビが付いていない語に読みを補う。値は (読み, 根拠)。
MISSING_RUBY = {
    "釈迦": (
        "しゃか",
        "前篇第4章。同じページの別の段落に <ruby>釈迦<rt>しゃか</rt></ruby> があり、"
        "同一ページ内でのルビ付け漏れと判断した",
    ),
}

# 本文から取り除く注記。読誦の対象ではない書誌の断り書きだけをここに置く。
# 割注でも本文の一部として読むもの(後篇第10章の〈十声一声までに往生す〉など)は
# 取り除かない。
DROPPED_NOTES = (
    "〈已上略抄〉",
)


def apply_missing_ruby(text):
    """ルビの無い地の文から読みを組み立てるときに使う。表に載っている語だけを
    読みへ置き換える。載っていない漢字はそのまま残り、検証で捕まる。"""
    for word, (reading, _reason) in MISSING_RUBY.items():
        text = text.replace(word, reading)
    return text


def strip_dropped_notes(text):
    """本文から書誌の注記を取り除く"""
    for note in DROPPED_NOTES:
        text = text.replace(note, "")
    return text
