import { useMemo, useState } from "react";
import { loadDummyEntries, buildTitleIdMap } from "./lib/dummyEntries";
import { searchEntries } from "./lib/search";
import { parseBody } from "./lib/renderBody";
import type { Segment } from "./lib/renderBody";

const entries = loadDummyEntries();

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
  const [query, setQuery] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), []);
  const titleToId = useMemo(() => buildTitleIdMap(entries), []);

  const results = useMemo(() => searchEntries(entries, query), [query]);
  const current = currentId !== null ? entriesById.get(currentId) ?? null : null;

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
      {query && results.length === 0 && (
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
          {parseBody(current.body, titleToId).map((paragraph, i) => (
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
