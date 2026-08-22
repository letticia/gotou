import { useEffect, useMemo, useRef, useState } from "react";
import { openDatabaseFromBytes } from "./lib/db";
import type { DictionaryDb, SuggestionRow } from "./lib/db";
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
  externalEmbedConfirmMessage,
  externalLinkConfirmMessage,
  hasSeenExternalLinkNotice,
  markExternalLinkNoticeSeen,
} from "./lib/externalLinks";
import JozenPanel from "./JozenPanel";
import { buildJozenKeyword, canSearchAsTenkyo, extractClauses } from "./lib/tenkyoNormalize";
import {
  formatPresetNames,
  searchDictionaryByClauses,
  searchGongyoByClauses,
} from "./lib/tenkyoSearch";
import { JOZEN_SEARCH_ACTION, submitJozenSearch } from "./lib/jozenSearch";
import { loadGongyoPresets, loadGongyoUnits } from "./lib/gongyo";
import {
  FONT_SCALE_STEPS,
  canDecrease,
  canIncrease,
  loadScaleIndex,
  saveScaleIndex,
} from "./lib/dictFontScale";

/** 見出し語で引く(既定) / 一節から典拠をさがす(逆引き。docs/tenkyo-spec.md B) */
type QueryMode = "headword" | "tenkyo";

/** 検索前の画面で紹介する収録語の件数 */
const SUGGESTION_COUNT = 5;

// 勤行テキストはimport.meta.globのeager読み込みなので、モジュール初期化時に一度だけ作る
const gongyoUnits = loadGongyoUnits();
const gongyoPresets = loadGongyoPresets();

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
  // 一時的な通知(オフライン時に外部リンクを踏んだ場合など)。数秒で自動的に消す
  const [toast, setToast] = useState<string | null>(null);
  const [queryMode, setQueryMode] = useState<QueryMode>("headword");
  // 記事本文で選択された一節。「この一節の典拠をさがす」を出すかの判断に使う
  const [selectionText, setSelectionText] = useState<string | null>(null);
  // アプリ内に表示中の浄全DB検索(検索語。nullなら非表示)
  const [jozenPanelKeyword, setJozenPanelKeyword] = useState<string | null>(null);
  // 検索前の画面で紹介する収録語。押すたびに引き直せるようカウンタで再取得する
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [suggestionSeed, setSuggestionSeed] = useState(0);

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
    if (!db || !normalizedQuery || queryMode !== "headword") return [];
    return db.searchByPrefix(normalizedQuery);
  }, [db, normalizedQuery, queryMode]);

  // --- 逆引き典拠検索(docs/tenkyo-spec.md B) ---
  // 句読点で分割した句ごとに部分一致を取る。一節をまるごと句読点除去して引くと
  // 本文側の句読点と食い違って当たらなくなるため、除去はしない(B-1の実測参照)。
  const clauses = useMemo(
    () => (queryMode === "tenkyo" ? extractClauses(query) : []),
    [query, queryMode],
  );
  const dictionaryHits = useMemo(() => {
    if (!db || clauses.length === 0) return [];
    return searchDictionaryByClauses(clauses, (needle, limit) =>
      db.searchTextContains(needle, limit),
    );
  }, [db, clauses]);
  const gongyoHits = useMemo(() => {
    if (clauses.length === 0) return [];
    return searchGongyoByClauses(query, clauses, gongyoUnits, gongyoPresets);
  }, [query, clauses]);

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
    const target = event.target as HTMLElement;

    const link = target.closest("a.internal-link");
    if (link) {
      event.preventDefault();
      const href = link.getAttribute("href");
      const targetId = href ? parseInternalLinkTarget(href) : null;
      if (targetId !== null) {
        navigateTo(targetId);
      }
      return;
    }

    // 外部リンク(浄全DB・SATへの典拠リンクを含む)。
    // 既定の遷移に任せると、ホーム画面に追加したPWA(standalone表示)では
    // アプリ自身が外部サイトに置き換わり、ブラウザのUIも無いため戻る手段が無くなる。
    // 必ず新しいタブで開いて、読誦・検索の文脈を残す(docs/tenkyo-spec.md A-2)。
    const external = target.closest("a.external-link");
    if (!external) return;
    event.preventDefault();
    const href = external.getAttribute("href");
    if (!href) return;

    guardExternalNavigation(href, () => window.open(href, "_blank", "noopener"));
  }

  /**
   * 外部サイトへ出る前の共通の関門。典拠リンクのタップと浄全DB検索(POST送信)の
   * 両方が必ずここを通る。POST送信はwindow.openを経由しないので、素通りさせないよう
   * 呼び出し側で明示的に通すこと(docs/tenkyo-spec.md B-3)。
   */
  function guardExternalNavigation(
    href: string,
    proceed: () => void,
    confirmMessage: (href: string) => string = externalLinkConfirmMessage,
  ) {
    // 典拠DBは外部サイトなのでオフラインでは開けない。踏んでから気付けるようにする
    // (存在確認のための事前リクエストはしない、という掟に沿う)。
    if (!navigator.onLine) {
      setToast("オフラインです。オンライン時にご利用ください");
      return;
    }

    if (!hasSeenExternalLinkNotice()) {
      if (!window.confirm(confirmMessage(href))) return;
      markExternalLinkNoticeSeen();
    }

    proceed();
  }

  /** 浄全DBの検索結果をアプリ内(iframe)に表示する */
  function handleJozenSearchInApp() {
    const keyword = buildJozenKeyword(query);
    if (!keyword) return;
    // アプリ内表示でも読み込むのは外部サイトそのものなので、同じ関門を通す
    guardExternalNavigation(
      JOZEN_SEARCH_ACTION,
      () => setJozenPanelKeyword(keyword),
      externalEmbedConfirmMessage,
    );
  }

  /** 浄全DBの検索結果を新しいタブで開く */
  function handleJozenSearchInNewTab() {
    const keyword = buildJozenKeyword(query);
    if (!keyword) return;
    guardExternalNavigation(JOZEN_SEARCH_ACTION, () => submitJozenSearch(keyword));
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // 記事本文の範囲選択を拾って「この一節の典拠をさがす」を出す
  // (docs/tenkyo-spec.md UI節・M4)。選択が本文の外に出ている場合や、
  // 短すぎて句が取れない場合は導線を出さない。
  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      const container = bodyRef.current;
      if (!selection || selection.isCollapsed || !container) {
        setSelectionText(null);
        return;
      }
      // 記事本文の中だけを対象にする(見出しやツールバーの選択では出さない)
      if (
        !selection.anchorNode ||
        !selection.focusNode ||
        !container.contains(selection.anchorNode) ||
        !container.contains(selection.focusNode)
      ) {
        setSelectionText(null);
        return;
      }
      const text = selection.toString().trim();
      setSelectionText(canSearchAsTenkyo(text) ? text : null);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  // 記事から離れたら選択の導線も消す(前の記事の選択が残らないように)
  useEffect(() => {
    setSelectionText(null);
  }, [currentId]);

  // 検索語や検索の種類が変わったら、前の検索語の結果が残らないよう閉じる
  useEffect(() => {
    setJozenPanelKeyword(null);
  }, [query, queryMode]);

  // 検索前の画面に出す収録語を引く。辞書が開けた時と「ほかの語を見る」の押下時だけ。
  useEffect(() => {
    if (!db) {
      setSuggestions([]);
      return;
    }
    setSuggestions(db.randomEntries(SUGGESTION_COUNT));
  }, [db, suggestionSeed]);

  /** 選択した一節をそのまま逆引き検索へ渡し、一覧画面に戻る */
  function handleSearchSelection(event: React.PointerEvent<HTMLButtonElement>) {
    // pointerdownで処理する: clickを待つと、ボタンに触れた時点で選択が解除され
    // selectionchangeがselectionTextを消してボタン自体が消えてしまう
    event.preventDefault();
    if (!selectionText) return;
    setQuery(selectionText);
    setQueryMode("tenkyo");
    setSelectionText(null);
    window.getSelection()?.removeAllRanges();
    // 記事を閉じて一覧(=逆引きの結果画面)へ戻る。記事の履歴は辿り直さない
    setHistory([]);
    setCurrentId(null);
  }

  // 記事画面・一覧画面のどちらからも外部サイトへ出られる(記事本文の典拠リンクと、
  // 逆引きの浄全DB検索ボタン)。どちらの画面でもトーストが出るよう共通化する。
  // 選択の導線と同じ位置に出るので、両方見えるときはトーストを一段上げる
  const toastElement = toast ? (
    <div className={selectionText ? "toast toast-raised" : "toast"} role="status">
      {toast}
    </div>
  ) : null;

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
          <p className="download-source-note">
            浄土宗大辞典(jodoshuzensho.jp/daijiten/)のデータを取得します。本アプリは非公式です。
          </p>
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
          <p className="entry-source">出典: 浄土宗大辞典(非公式・本アプリ独自の変換による表示です)</p>
        </div>
        {selectionText && (
          <div className="selection-action">
            <button type="button" onPointerDown={handleSearchSelection}>
              この一節の典拠をさがす
            </button>
          </div>
        )}
        {toastElement}
      </div>
    );
  }

  return (
    <div className="app">
      {fontScaleRow}
      <div className="search-input-wrapper">
        {queryMode === "tenkyo" ? (
          // 逆引きは一節をまるごと貼る前提なので複数行にする
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="一節を貼り付け(法語・偈文・引用文)"
            className="search-input search-input-multiline"
            rows={3}
          />
        ) : (
          <input
            ref={queryInputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="読みまたは見出し語で検索"
            className="search-input"
          />
        )}
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
      <div className="query-mode-toggle" role="group" aria-label="検索の種類">
        <button
          type="button"
          className={queryMode === "headword" ? "active" : undefined}
          aria-pressed={queryMode === "headword"}
          onClick={() => setQueryMode("headword")}
        >
          見出し語で引く
        </button>
        <button
          type="button"
          className={queryMode === "tenkyo" ? "active" : undefined}
          aria-pressed={queryMode === "tenkyo"}
          onClick={() => setQueryMode("tenkyo")}
        >
          一節から典拠をさがす
        </button>
      </div>
      {loadState.status === "checking" && <p className="empty">辞書データを確認中…</p>}
      {loadState.status === "acquiring" && (
        <div className="download-progress">
          <p className="empty">{acquisitionProgressText(loadState.progress)}</p>
        </div>
      )}
      {loadState.status === "error" && <p className="empty error">{loadState.message}</p>}

      {queryMode === "headword" ? (
        <>
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
          {/* 検索前の余白で語に出あえるようにする。押せばその項目へ、
              入力を始めれば通常の検索結果に切り替わる */}
          {db && !query && suggestions.length > 0 && (
            <section className="preset-section suggestion-section">
              <h3>収録語から</h3>
              <ul className="suggestion-list">
                {suggestions.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => navigateTo(entry.id)}>
                      <span className="suggestion-head">
                        <span className="title">{entry.title}</span>
                        <span className="reading">{entry.reading}</span>
                      </span>
                      {entry.excerpt && (
                        <span className="suggestion-excerpt">{entry.excerpt}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="suggestion-reroll"
                onClick={() => setSuggestionSeed((n) => n + 1)}
              >
                ほかの語を見る
              </button>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="preset-section">
            <h3>辞書の項目</h3>
            {dictionaryHits.length > 0 ? (
              <ul className="result-list">
                {dictionaryHits.map((hit) => (
                  <li key={hit.id}>
                    <button type="button" onClick={() => navigateTo(hit.id)}>
                      <span className="title">{hit.title}</span>
                      <span className="reading">{hit.reading}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">{clauses.length === 0 ? "一節を入力してください" : "見つかりませんでした"}</p>
            )}
          </section>

          <section className="preset-section">
            <h3>勤行テキスト</h3>
            {gongyoHits.length > 0 ? (
              <ul className="tenkyo-gongyo-list">
                {gongyoHits.map((hit) => (
                  <li key={`${hit.unitId}-${hit.lineIndex}`}>
                    <p className="tenkyo-gongyo-line">{hit.lineText}</p>
                    {hit.lineRuby && <p className="tenkyo-gongyo-ruby">{hit.lineRuby}</p>}
                    <p className="tenkyo-gongyo-source">
                      {hit.unitTitle}
                      {hit.presetNames.length > 0 && `(${formatPresetNames(hit.presetNames)})`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">
                {clauses.length === 0 ? "一節を入力してください" : "見つかりませんでした"}
              </p>
            )}
          </section>

          <section className="preset-section">
            <h3>浄土宗全書テキストデータベース(外部)</h3>
            <p className="tenkyo-jozen-note">
              手元の辞書と勤行テキストに無い場合は、浄土宗全書の全文を検索できます。
              結果は外部サイトから直接読み込んで表示します。
            </p>
            <button
              type="button"
              className="tenkyo-jozen-button"
              disabled={!buildJozenKeyword(query)}
              onClick={handleJozenSearchInApp}
            >
              浄土宗全書で検索
            </button>
            {jozenPanelKeyword && (
              <JozenPanel
                keyword={jozenPanelKeyword}
                onClose={() => setJozenPanelKeyword(null)}
                onOpenInNewTab={handleJozenSearchInNewTab}
              />
            )}
          </section>
        </>
      )}
      {toastElement}
    </div>
  );
}
