import { useEffect, useMemo, useRef, useState } from "react";
import { openDatabaseFromBytes } from "./lib/db";
import type { DictionaryDb } from "./lib/db";
import {
  hasCachedLiveDictionary,
  readCachedLiveDictionaryBytes,
  storeLiveDictionaryBytes,
} from "./lib/dictionaryStorage";
import {
  acquireDictionaryFromSource,
  acquisitionProgressText,
} from "./lib/dictionaryAcquisition";
import type { AcquisitionProgress } from "./lib/dictionaryAcquisition";
import { ChevronLeftIcon } from "./Icons";
import { isStandalonePwa } from "./lib/pwaDisplayMode";
import { normalizeSearchInput } from "./lib/variants";
import { parseInternalLinkTarget } from "./lib/internalLinks";
import {
  FONT_SCALE_STEPS,
  canDecrease,
  canIncrease,
  loadScaleIndex,
  saveScaleIndex,
} from "./lib/dictFontScale";

type LoadState =
  | { status: "checking" }
  // ホーム画面に追加(PWAインストール)されていない通常のブラウザタブ向け。
  // 未許諾の辞書データを誰でも取得できてしまわないよう、ダウンロード自体を発生させない。
  | { status: "not-installed" }
  // インストール済みだが未ダウンロード。ユーザーの明示的なボタン操作を待つ
  | { status: "awaiting-download" }
  // 浄土宗大辞典への取得・変換中(フェーズごとの進捗)
  | { status: "acquiring"; progress: AcquisitionProgress }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function SearchMode() {
  const [db, setDb] = useState<DictionaryDb | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "checking" });
  const [query, setQuery] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  // 「ダウンロード開始」ボタンから、effect内で定義されたloadDictionaryを呼べるようにする
  const loadDictionaryRef = useRef<() => void>(() => {});
  const [scaleIndex, setScaleIndex] = useState(() => loadScaleIndex());

  // 辞書モードの文字サイズ(検索結果一覧・本文とも).appのfont-sizeがこの値を
  // 参照するので、:rootに置けば.appへ継承される(--app-font-familyと同じやり方)
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--dict-font-scale",
      String(FONT_SCALE_STEPS[scaleIndex]),
    );
  }, [scaleIndex]);

  function handleDecreaseFontScale() {
    setScaleIndex((prev) => {
      // disabled属性の再描画が間に合わない連続クリックでも配列の範囲外に
      // ならないようclampする(disabledだけに頼らない)
      const next = Math.max(0, prev - 1);
      saveScaleIndex(next);
      return next;
    });
  }

  function handleIncreaseFontScale() {
    setScaleIndex((prev) => {
      const next = Math.min(FONT_SCALE_STEPS.length - 1, prev + 1);
      saveScaleIndex(next);
      return next;
    });
  }

  const fontScaleRow = (
    <div className="font-scale-row">
      <button
        type="button"
        className="font-scale-button"
        onClick={handleDecreaseFontScale}
        disabled={!canDecrease(scaleIndex)}
        aria-label="文字を小さく"
      >
        A-
      </button>
      <button
        type="button"
        className="font-scale-button"
        onClick={handleIncreaseFontScale}
        disabled={!canIncrease(scaleIndex)}
        aria-label="文字を大きく"
      >
        A+
      </button>
    </div>
  );

  useEffect(() => {
    let cancelled = false;

    async function openAndFinish(bytes: Uint8Array) {
      const opened = await openDatabaseFromBytes(bytes);
      if (cancelled) {
        opened.close();
        return;
      }
      setDb(opened);
      setLoadState({ status: "ready" });
    }

    async function acquireLiveDictionary() {
      setLoadState({ status: "checking" });
      const bytes = await acquireDictionaryFromSource((progress) => {
        if (!cancelled) setLoadState({ status: "acquiring", progress });
      });
      await storeLiveDictionaryBytes(bytes);
      await openAndFinish(bytes);
    }

    async function loadCachedLiveDictionary() {
      setLoadState({ status: "checking" });
      const bytes = await readCachedLiveDictionaryBytes();
      if (!bytes) {
        setLoadState({ status: "awaiting-download" });
        return;
      }
      await openAndFinish(bytes);
    }

    function handleError(err: unknown) {
      if (!cancelled) {
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : "辞書データベースの初期化に失敗しました。",
        });
      }
    }

    // 開発サーバーでは通常のブラウザタブでも画面を確認できるようにする
    // (本番ビルドではimport.meta.env.DEVがfalseになり、従来通りの判定に戻る)
    if (!isStandalonePwa() && !import.meta.env.DEV) {
      setLoadState({ status: "not-installed" });
    } else {
      hasCachedLiveDictionary()
        .then((cached) => {
          if (cancelled) return;
          if (cached) {
            loadCachedLiveDictionary().catch(handleError);
          } else {
            setLoadState({ status: "awaiting-download" });
          }
        })
        .catch(handleError);
      loadDictionaryRef.current = () => acquireLiveDictionary().catch(handleError);
    }

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
    // 履歴が空なら検索結果一覧へ戻る(記事画面は一覧と入れ替わりで表示されるため、
    // 一覧へ戻る手段がこれしかない)
    if (history.length === 0) {
      setCurrentId(null);
      return;
    }
    setHistory(history.slice(0, -1));
    setCurrentId(history[history.length - 1]);
  }

  function handleBodyClick(event: React.MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest("a.internal-link");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href");
    const targetId = href ? parseInternalLinkTarget(href) : null;
    if (targetId !== null) {
      navigateTo(targetId);
    }
  }

  // 記事画面は検索結果一覧と入れ替わりで表示される(プッシュ遷移)ため、
  // 記事を開く・記事間を移動するたびに画面先頭から読み始められるようにする。
  useEffect(() => {
    if (current) {
      window.scrollTo(0, 0);
    }
  }, [current?.id]);

  // factory生成の本物のHTMLにはリンク切れの見た目が付いていないため、描画後に走査して付与する
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>("a.internal-link")) {
      const href = anchor.getAttribute("href");
      const resolved = href ? parseInternalLinkTarget(href) : null;
      anchor.classList.toggle("broken", resolved === null);
    }
  }, [current?.id]);

  if (loadState.status === "not-installed") {
    return (
      <div className="app">
        {fontScaleRow}
        <p className="empty">
          このアプリをホーム画面に追加してからご利用ください。
          <br />
          (ブラウザの共有メニュー等から「ホーム画面に追加」)
        </p>
      </div>
    );
  }

  if (loadState.status === "awaiting-download") {
    return (
      <div className="app">
        {fontScaleRow}
        <div className="download-prompt">
          <p className="empty">辞書データをダウンロードします。</p>
          <button
            type="button"
            className="download-start-button"
            onClick={() => loadDictionaryRef.current()}
          >
            ダウンロード開始
          </button>
        </div>
      </div>
    );
  }

  // 記事画面。検索結果一覧と入れ替わりで表示する(一覧の下に追記すると、
  // 長い一覧の分だけ本文が押し下げられ「遷移できたか分からない」状態になる)。
  if (current) {
    return (
      <div className="app">
        <div className="detail-toolbar">
          <button type="button" className="back-button" onClick={goBack}>
            <ChevronLeftIcon />
            <span>{history.length > 0 ? "戻る" : "検索"}</span>
          </button>
          {fontScaleRow}
        </div>
        <div className="detail">
          <h2>{current.title}</h2>
          <p className="reading">{current.reading}</p>
          {/*
            factoryの変換パイプライン(自分たちのコード)が生成した既知構造のHTML。
            外部・ユーザー入力ではないためdangerouslySetInnerHTMLで許容する。
          */}
          <div
            ref={bodyRef}
            className="body-html"
            onClick={handleBodyClick}
            dangerouslySetInnerHTML={{ __html: current.bodyHtml }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {fontScaleRow}
      <div className="search-input-wrapper">
        <input
          ref={queryInputRef}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="読みまたは見出し語で検索"
          className="search-input"
        />
        {query && (
          <button
            type="button"
            className="search-clear-button"
            aria-label="検索語をクリア"
            onClick={() => {
              setQuery("");
              queryInputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      {loadState.status === "checking" && <p className="empty">辞書データを確認中…</p>}
      {loadState.status === "acquiring" && (
        <div className="download-progress">
          <p className="empty">{acquisitionProgressText(loadState.progress)}</p>
        </div>
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
    </div>
  );
}
