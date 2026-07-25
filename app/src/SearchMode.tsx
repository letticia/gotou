import { useEffect, useMemo, useState } from "react";
import { loadDummyEntries, buildTitleIdMap } from "./lib/dummyEntries";
import { openDatabaseFromBytes } from "./lib/db";
import type { DictionaryDb } from "./lib/db";
import { getDictionaryBytes } from "./lib/dictionaryStorage";
import { normalizeSearchInput } from "./lib/variants";
import { parseBody } from "./lib/renderBody";
import type { Segment } from "./lib/renderBody";

// 開発時はscripts/build-dummy-db.mtsが生成するダミーDBを指す。
// 実データ配信サーバーのURLは別途決定する(docs/handoff.md参照)。
const MANIFEST_URL = "/dictionary-manifest.json";

// リンクジャンプ描画用(parseBodyのタイトル解決)。DB本体とは独立に、
// 既存のダミーfixtureから直接構築する(理由はdocs/handoff.md参照)。
const entries = loadDummyEntries();
const titleToId = buildTitleIdMap(entries);

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

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
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { bytes } = await getDictionaryBytes(MANIFEST_URL);
      const opened = await openDatabaseFromBytes(bytes);
      if (cancelled) {
        opened.close();
        return;
      }
      setDb(opened);
      setLoadState({ status: "ready" });
    })().catch((err: unknown) => {
      if (!cancelled) {
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : "辞書データベースの初期化に失敗しました。",
        });
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
      {loadState.status === "loading" && (
        <p className="empty">辞書データをダウンロード(またはキャッシュから読み込み)中…</p>
      )}
      {loadState.status === "error" && <p className="empty error">{loadState.message}</p>}
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
