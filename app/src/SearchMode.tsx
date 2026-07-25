import { useEffect, useMemo, useState } from "react";
import { loadDummyEntries, buildTitleIdMap } from "./lib/dummyEntries";
import { openDummyDatabase } from "./lib/db";
import type { DictionaryDb } from "./lib/db";
import { normalizeSearchInput } from "./lib/variants";
import { parseBody } from "./lib/renderBody";
import type { Segment } from "./lib/renderBody";

// リンクジャンプ描画用(parseBodyのタイトル解決)。DB本体とは独立に、
// 既存のダミーfixtureから直接構築する(理由はdocs/handoff.md参照)。
const entries = loadDummyEntries();
const titleToId = buildTitleIdMap(entries);

function SegmentView({ segment, onJump }: { segment: Segment; onJump: (id: number) => void }) {
  switch (segment.kind) {
    case "bold":
      return <strong>{segment.text}</strong>;
    case "italic":
      return <em>{segment.text}</em>;
    case "link":
      if (segment.targetId !== null) {
        return (
          <button
            type="button"
            className="internal-link"
            onClick={() => onJump(segment.targetId!)}
          >
            {segment.label}
          </button>
        );
      }
      return (
        <span className="internal-link broken" title="リンク先が見つかりません">
          {segment.label}
        </span>
      );
    case "text":
    default:
      return <>{segment.text}</>;
  }
}

export default function SearchMode() {
  const [db, setDb] = useState<DictionaryDb | null>(null);
  const [query, setQuery] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    openDummyDatabase().then((opened) => {
      if (cancelled) {
        opened.close();
      } else {
        setDb(opened);
      }
    });
    return () => {
      cancelled = true;
      setDb((current) => {
        current?.close();
        return null;
      });
    };
  }, []);

  const normalizedQuery = useMemo(() => normalizeSearchInput(query.trim()), [query]);
  const results = useMemo(() => {
    if (!db || !normalizedQuery) return [];
    return db.searchByPrefix(normalizedQuery);
  }, [db, normalizedQuery]);
  const current = db && currentId !== null ? db.getEntry(currentId) : null;

  function navigateTo(id: number) {
    if (id === currentId) return;
    if (currentId !== null) {
      setHistory([...history, currentId]);
    }
    setCurrentId(id);
  }

  function goBack() {
    if (history.length === 0) return;
    setHistory(history.slice(0, -1));
    setCurrentId(history[history.length - 1]);
  }

  return (
    <div className="app">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="読みまたは見出し語で検索"
        className="search-input"
      />
      {!db && <p className="empty">辞書データベースを準備中…</p>}
      <ul className="result-list">
        {results.map((entry) => (
          <li key={entry.id}>
            <button type="button" onClick={() => navigateTo(entry.id)}>
              <span className="title">{entry.title}</span>
              <span className="reading">{entry.reading}</span>
            </button>
          </li>
        ))}
      </ul>
      {db && query && results.length === 0 && (
        <p className="empty">該当する項目がありません</p>
      )}
      {current && (
        <div className="detail">
          {history.length > 0 && (
            <button type="button" className="back-button" onClick={goBack}>
              ← 戻る
            </button>
          )}
          <h2>{current.title}</h2>
          <p className="reading">{current.reading}</p>
          {parseBody(current.bodyHtml, titleToId).map((paragraph, i) => (
            <p key={i} className="body-paragraph">
              {paragraph.map((segment, j) => (
                <SegmentView key={j} segment={segment} onJump={navigateTo} />
              ))}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
