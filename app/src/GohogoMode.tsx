import { useEffect, useMemo, useRef, useState } from "react";
import {
  GOHOGO_CHAPTERS_PER_HEN,
  chapterNumberForDate,
  chapterToKanji,
  getGohogoChapter,
  listChapters,
} from "./lib/gohogo";
import type { GohogoChapter, GohogoParagraph, GohogoToken } from "./lib/gohogo";
import { openDatabaseFromBytes } from "./lib/db";
import type { DictionaryDb } from "./lib/db";
import { hasCachedLiveDictionary, readCachedLiveDictionaryBytes } from "./lib/dictionaryStorage";
import { isStandalonePwa } from "./lib/pwaDisplayMode";
import { MIN_GLOSS_LENGTH, buildHeadwordIndex, findGlossSpans } from "./lib/glossLinks";
import type { GlossEntry, HeadwordIndex } from "./lib/glossLinks";
import { GOHOGO_HEN_LABELS, loadGohogoHen } from "./lib/gohogoHen";
import type { GohogoHen } from "./lib/gohogoHen";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

// 『元祖大師御法語』を読み物として読む画面。
//
// 勤行モードの経本(縦書き・タップでページ送り)とは性格が違うので、
// こちらは横書き・縦スクロールにしてある。ルビもデータのトークン列から
// 語ごとに本物の <ruby> で振る(勤行側は句ごとのかな1行のまま。docs/saijo-spec.md)。

interface GohogoModeProps {
  /** 辞書の「今日の御法語」から開いたときの初期表示章 */
  initialTarget?: { hen: GohogoHen; chapter: number } | null;
  onTargetHandled?: () => void;
  /** 文字サイズのステッパー(辞書と共用の FontScaleRow)。Appが渡す */
  fontScaleRow: React.ReactNode;
  /** 語釈の小窓から「辞書で開く」を押したとき、辞書タブのその項目へ渡す */
  onOpenDictionaryEntry?: (entryId: number) => void;
}

type View = { name: "index" } | { name: "chapter"; chapter: number };

function TokenText({ token }: { token: GohogoToken }) {
  return token.length === 2 ? (
    <ruby>
      {token[0]}
      <rt>{token[1]}</rt>
    </ruby>
  ) : (
    <span>{token[0]}</span>
  );
}

/**
 * 段落を描く。辞書が開けていれば、見出しに一致した語を語釈リンクにする
 * (src/lib/glossLinks.ts)。句は勤行のページ送り用の区切りなので、照合は
 * 段落の中で句をまたいで行う(語が句の切れ目で割れていても拾えるように)。
 */
function Paragraph({
  paragraph,
  index,
  onGloss,
}: {
  paragraph: GohogoParagraph;
  index: HeadwordIndex | null;
  onGloss: (entry: GlossEntry) => void;
}) {
  const tokens = paragraph.clauses.flatMap((clause) => clause.tokens);
  const spans = index ? findGlossSpans(tokens, index) : [];
  const parts: React.ReactNode[] = [];
  let i = 0;
  for (const span of spans) {
    for (; i < span.start; i++) parts.push(<TokenText key={i} token={tokens[i]} />);
    parts.push(
      <button
        key={`g${span.start}`}
        type="button"
        className="gloss-link"
        onClick={() => onGloss(span.entry)}
      >
        {tokens.slice(span.start, span.end).map((token, k) => (
          <TokenText key={k} token={token} />
        ))}
      </button>,
    );
    i = span.end;
  }
  for (; i < tokens.length; i++) parts.push(<TokenText key={i} token={tokens[i]} />);
  return <p className="gohogo-paragraph">{parts}</p>;
}

/**
 * 辞書(端末にダウンロード済みの浄土宗大辞典)を開き、語釈リンク用の見出しの
 * 索引を作る。辞書タブと同じく、この画面を開いている間だけ開いておく
 * (辞書タブとは同時に表示されないので、それぞれが開いて閉じる)。
 * 辞書がまだ無い・ホーム画面に追加していない場合は null のまま(リンクは出ない)。
 */
function useGlossDictionary(): {
  db: DictionaryDb | null;
  index: HeadwordIndex | null;
  unavailable: boolean;
} {
  const [state, setState] = useState<{
    db: DictionaryDb | null;
    index: HeadwordIndex | null;
    unavailable: boolean;
  }>({ db: null, index: null, unavailable: false });

  useEffect(() => {
    let cancelled = false;
    let opened: DictionaryDb | null = null;
    async function open() {
      // 辞書タブと同じ条件(本番ではホーム画面に追加したアプリでだけ辞書を持てる)
      if (!isStandalonePwa() && !import.meta.env.DEV) throw new Error("not-installed");
      if (!(await hasCachedLiveDictionary())) throw new Error("not-downloaded");
      const bytes = await readCachedLiveDictionaryBytes();
      if (!bytes) throw new Error("not-downloaded");
      opened = await openDatabaseFromBytes(bytes);
      if (cancelled) {
        opened.close();
        return;
      }
      const index = buildHeadwordIndex(opened.listHeadwords(MIN_GLOSS_LENGTH));
      setState({ db: opened, index, unavailable: false });
    }
    open().catch(() => {
      if (!cancelled) setState({ db: null, index: null, unavailable: true });
    });
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, []);

  return state;
}

export default function GohogoMode({
  initialTarget,
  onTargetHandled,
  fontScaleRow,
  onOpenDictionaryEntry,
}: GohogoModeProps) {
  const gloss = useGlossDictionary();
  // 語釈の小窓に出している語(null なら閉じている)
  const [glossEntry, setGlossEntry] = useState<GlossEntry | null>(null);
  const glossExcerpt = useMemo(
    () => (glossEntry && gloss.db ? gloss.db.getExcerpt(glossEntry.id, 120) : ""),
    [glossEntry, gloss.db],
  );
  // 篇の初期値は勤行の設定に合わせるが、この画面での切り替えは保存しない
  // (読み物として行き来するためのもので、おつとめで読む篇の設定とは別)
  const [hen, setHen] = useState<GohogoHen>(() => loadGohogoHen());
  const [view, setView] = useState<View>({ name: "index" });
  const scrollTopRef = useRef<HTMLDivElement>(null);

  // その日の章。一覧で「今日」の印を付けるためにマウント時に1回だけ決める
  const [today] = useState(() => chapterNumberForDate(new Date()));

  const chapters = useMemo(() => listChapters(hen), [hen]);

  // 辞書の「今日の御法語」から渡された章を開く
  useEffect(() => {
    if (!initialTarget) return;
    setHen(initialTarget.hen);
    setView({ name: "chapter", chapter: initialTarget.chapter });
    onTargetHandled?.();
  }, [initialTarget, onTargetHandled]);

  // 章を移ったら先頭から読み始められるようにする
  useEffect(() => {
    if (view.name === "chapter") window.scrollTo(0, 0);
  }, [view.name, view.name === "chapter" ? view.chapter : null, hen]);

  const current: GohogoChapter | null =
    view.name === "chapter" ? getGohogoChapter(hen, view.chapter) : null;

  function openChapter(chapter: number) {
    setView({ name: "chapter", chapter });
  }

  function switchHen(next: GohogoHen) {
    setHen(next);
    // 篇を変えても同じ章番号に留まる(前篇第三章 ⇔ 後篇第三章を見比べられる)
  }

  if (current) {
    const previous = current.chapter > 1 ? current.chapter - 1 : null;
    const next = current.chapter < GOHOGO_CHAPTERS_PER_HEN ? current.chapter + 1 : null;
    return (
      <div className="app" ref={scrollTopRef}>
        <div className="detail-toolbar">
          <button
            type="button"
            className="back-button"
            onClick={() => setView({ name: "index" })}
          >
            <ChevronLeftIcon />
            <span>御法語</span>
          </button>
          {fontScaleRow}
        </div>
        <div className="detail gohogo-detail">
          <p className="gohogo-chapter-label">
            {GOHOGO_HEN_LABELS[hen]}　第{chapterToKanji(current.chapter)}章
            {current.chapter === today && <span className="gohogo-today-mark">今日</span>}
          </p>
          <h2>{current.title}</h2>
          <p className="reading">{current.titleReading}</p>
          {current.paragraphs.map((paragraph, i) => (
            <Paragraph
              key={i}
              paragraph={paragraph}
              index={gloss.index}
              onGloss={setGlossEntry}
            />
          ))}
          {gloss.unavailable && (
            <p className="gloss-unavailable">
              辞書をダウンロードすると、本文の語をタップして意味を引けるようになります。
            </p>
          )}
          <p className="entry-source">出典: {current.source.name}</p>
          <div className="gohogo-chapter-nav">
            <button
              type="button"
              disabled={previous === null}
              onClick={() => previous !== null && openChapter(previous)}
            >
              <ChevronLeftIcon />
              <span>前の章</span>
            </button>
            <button
              type="button"
              disabled={next === null}
              onClick={() => next !== null && openChapter(next)}
            >
              <span>次の章</span>
              <ChevronRightIcon />
            </button>
          </div>
        </div>
        {glossEntry && (
          <div className="gloss-sheet-backdrop" onClick={() => setGlossEntry(null)}>
            <div
              className="gloss-sheet"
              role="dialog"
              aria-label={`${glossEntry.title}の意味`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="gloss-sheet-title">
                {glossEntry.title}
                <span className="gloss-sheet-reading">{glossEntry.reading}</span>
              </p>
              <p className="gloss-sheet-excerpt">{glossExcerpt}</p>
              <p className="gloss-sheet-source">出典: 浄土宗大辞典(非公式・本アプリ独自の変換による表示です)</p>
              <div className="gloss-sheet-actions">
                {onOpenDictionaryEntry && (
                  <button
                    type="button"
                    className="gloss-sheet-open"
                    onClick={() => {
                      const id = glossEntry.id;
                      setGlossEntry(null);
                      onOpenDictionaryEntry(id);
                    }}
                  >
                    辞書で開く
                  </button>
                )}
                <button type="button" onClick={() => setGlossEntry(null)}>
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {fontScaleRow}
      <div className="query-mode-toggle gohogo-hen-toggle" role="group" aria-label="篇">
        {(Object.keys(GOHOGO_HEN_LABELS) as GohogoHen[]).map((value) => (
          <button
            key={value}
            type="button"
            className={hen === value ? "active" : undefined}
            onClick={() => switchHen(value)}
            aria-pressed={hen === value}
          >
            {GOHOGO_HEN_LABELS[value]}
          </button>
        ))}
      </div>
      <p className="gohogo-intro-note">
        『元祖大師御法語』{GOHOGO_HEN_LABELS[hen]}
        。その日の日付と同じ番号の章が、その日の御法語です。
      </p>
      <ul className="gohogo-chapter-list">
        {chapters.map((chapter) => (
          <li key={chapter.chapter}>
            <button type="button" onClick={() => openChapter(chapter.chapter)}>
              <span className="gohogo-chapter-number">
                {chapterToKanji(chapter.chapter)}
              </span>
              {/* 一文要約(chapter.summary)はデータには入っているが、いまは出さない。
                  僧侶の校閲が済んでいないため(shared/gohogo/README.md)。 */}
              <span className="gohogo-chapter-title">
                <span className="title">{chapter.title}</span>
                <span className="reading">{chapter.titleReading}</span>
              </span>
              {chapter.chapter === today && (
                <span className="gohogo-today-mark">今日</span>
              )}
              <ChevronRightIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
