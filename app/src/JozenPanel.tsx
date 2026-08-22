import { useEffect, useState } from "react";
import { JOZEN_SEARCH_ACTION, submitJozenSearch } from "./lib/jozenSearch";

// 浄土宗全書テキストデータベースの検索結果をアプリ内に表示するパネル。
//
// 浄全DBはCORSを許可していないため、fetchで本文を取得することはできない。
// iframeなら利用者のブラウザが浄全DBから直接読み込むので表示できる
// (アプリ側は本文を取得も保持もしない)。検索はPOST専用なので、
// formのtargetにこのiframeのnameを指定して送信する。
//
// 表示しているのが外部サイトのページそのものであることが分かるよう、
// 見出しに出典を明記し、元のページを開く導線も併せて置く。

/** form の target とこの iframe の name を一致させる */
const FRAME_NAME = "jozen-result-frame";

interface JozenPanelProps {
  keyword: string;
  onClose: () => void;
  onOpenInNewTab: () => void;
}

export default function JozenPanel({ keyword, onClose, onOpenInNewTab }: JozenPanelProps) {
  // 読み込みに数秒かかることがあり、その間は白い枠だけが見える状態になるので
  // 読み込み中であることを明示する(cross-originのiframeでもload自体は発火する)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // effectは描画後に走るので、この時点でiframeはDOMに存在する
    submitJozenSearch(keyword, FRAME_NAME);
  }, [keyword]);

  return (
    <section className="jozen-panel">
      <div className="jozen-panel-header">
        <div>
          <p className="jozen-panel-title">浄土宗全書テキストデータベース</p>
          <p className="jozen-panel-note">
            浄土宗総合研究所の外部サイトを表示しています(検索語: {keyword})
          </p>
        </div>
        <button type="button" className="jozen-panel-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </div>
      <div className="jozen-panel-frame-wrap">
        {loading && <p className="jozen-panel-loading">外部サイトから読み込んでいます…</p>}
        <iframe
          name={FRAME_NAME}
          title="浄土宗全書テキストデータベースの検索結果"
          className="jozen-panel-frame"
          onLoad={() => setLoading(false)}
        />
      </div>
      <button type="button" className="jozen-panel-external" onClick={onOpenInNewTab}>
        元のページを新しいタブで開く
      </button>
      <p className="jozen-panel-source">
        出典: 浄土宗全書テキストデータベース({new URL(JOZEN_SEARCH_ACTION).host})
      </p>
    </section>
  );
}
