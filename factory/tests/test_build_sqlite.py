import sqlite3

from build_sqlite import generate_database
from generate_fixtures import TOTAL, NO_YOMI_INDEXES, BROKEN_LINK_INDEXES


def test_generate_database_counts(articles, tmp_path):
    db_path = tmp_path / "test.sqlite3"
    stats = generate_database(articles, str(db_path))

    assert stats["entries_count"] == TOTAL
    assert stats["missing_reading_count"] == len(NO_YOMI_INDEXES)
    assert stats["broken_links_count"] >= len(BROKEN_LINK_INDEXES)
    assert stats["links_count"] > 0

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM entries")
    assert cur.fetchone()[0] == TOTAL
    cur.execute("SELECT count(*) FROM entries_fts")
    assert cur.fetchone()[0] == TOTAL
    cur.execute("SELECT count(*) FROM aliases")
    assert cur.fetchone()[0] == 0
    conn.close()

def test_missing_reading_is_null(articles, tmp_path):
    db_path = tmp_path / "test.sqlite3"
    generate_database(articles, str(db_path))

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for entry_id in NO_YOMI_INDEXES:
        cur.execute("SELECT reading FROM entries WHERE id = ?", (entry_id,))
        row = cur.fetchone()
        assert row is not None
        assert row[0] is None
    conn.close()

def test_search_key_variant_normalization(articles, tmp_path):
    db_path = tmp_path / "test.sqlite3"
    generate_database(articles, str(db_path))

    # entry_id -> (旧字体, shared/variants.jsonでの正規化後の文字)
    expectations = {5: ("佛", "仏"), 15: ("彌", "弥"), 25: ("經", "経"), 35: ("淨", "浄")}

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for entry_id, (old_char, new_char) in expectations.items():
        cur.execute("SELECT title, search_key FROM entries WHERE id = ?", (entry_id,))
        title, search_key = cur.fetchone()
        assert old_char in title
        assert old_char not in search_key
        assert new_char in search_key
    conn.close()

def test_pending_readings_and_broken_links_files(articles, tmp_path):
    db_path = tmp_path / "test.sqlite3"
    pending_path = tmp_path / "pending.txt"
    broken_path = tmp_path / "broken.txt"

    stats = generate_database(
        articles, str(db_path),
        pending_readings_path=str(pending_path),
        broken_links_path=str(broken_path),
    )

    assert pending_path.exists()
    assert broken_path.exists()
    pending_lines = pending_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(pending_lines) == stats["missing_reading_count"]
