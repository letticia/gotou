import { useMemo, useState } from "react";
import { loadDummyEntries } from "./lib/dummyEntries";
import type { DummyEntry } from "./lib/dummyEntries";
import { searchEntries } from "./lib/search";

const entries = loadDummyEntries();

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DummyEntry | null>(null);

  const results = useMemo(() => searchEntries(entries, query), [query]);

  return (
    <div className="app">
      <h1>語灯(検索プロトタイプ)</h1>
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
            <button type="button" onClick={() => setSelected(entry)}>
              <span className="title">{entry.title}</span>
              <span className="reading">{entry.reading}</span>
            </button>
          </li>
        ))}
      </ul>
      {query && results.length === 0 && (
        <p className="empty">該当する項目がありません</p>
      )}
      {selected && (
        <div className="detail">
          <h2>{selected.title}</h2>
          <p className="reading">{selected.reading}</p>
          <pre>{selected.body}</pre>
        </div>
      )}
    </div>
  );
}
