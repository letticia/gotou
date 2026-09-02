import { useEffect, useMemo, useRef, useState } from "react";
import {
  GOHOGO_CHAPTERS_PER_HEN,
  chapterNumberForDate,
  chapterToKanji,
  getGohogoChapter,
  listChapters,
} from "./lib/gohogo";
import type { GohogoChapter, GohogoClause, GohogoParagraph } from "./lib/gohogo";
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
}

type View = { name: "index" } | { name: "chapter"; chapter: number };

function ClauseText({ clause }: { clause: GohogoClause }) {
  return (
    <>
      {clause.tokens.map((token, i) =>
        token.length === 2 ? (
          <ruby key={i}>
            {token[0]}
            <rt>{token[1]}</rt>
          </ruby>
        ) : (
          <span key={i}>{token[0]}</span>
        ),
      )}
    </>
  );
}

function Paragraph({ paragraph }: { paragraph: GohogoParagraph }) {
  return (
    <p className="gohogo-paragraph">
      {paragraph.clauses.map((clause, i) => (
        <ClauseText key={i} clause={clause} />
      ))}
    </p>
  );
}

export default function GohogoMode({
  initialTarget,
  onTargetHandled,
  fontScaleRow,
}: GohogoModeProps) {
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
            <Paragraph key={i} paragraph={paragraph} />
          ))}
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
