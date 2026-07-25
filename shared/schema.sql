-- 語灯 辞書DBスキーマ(正)
-- 変更時は factory(生成) / app(読み取り) の両方を必ず追随させること

CREATE TABLE entries (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,           -- 見出し語(表示用)
    reading    TEXT,                    -- 読み(ひらがな)。DEFAULTSORT第一ソース
    search_key TEXT NOT NULL,           -- variants.jsonで正規化済みの検索キー
    body_html  TEXT NOT NULL            -- 本文(整形済みHTML)
);

CREATE TABLE aliases (
    alias_key  TEXT NOT NULL,           -- 別表記・リダイレクト元など(正規化済み)
    entry_id   INTEGER NOT NULL REFERENCES entries(id)
);

CREATE TABLE links (
    from_id    INTEGER NOT NULL REFERENCES entries(id),
    to_id      INTEGER NOT NULL REFERENCES entries(id)
);

CREATE VIRTUAL TABLE entries_fts USING fts5(
    title,
    body_text                            -- body_htmlからタグ除去したテキスト
);

CREATE INDEX idx_search  ON entries(search_key);
CREATE INDEX idx_reading ON entries(reading);
CREATE INDEX idx_alias   ON aliases(alias_key);
