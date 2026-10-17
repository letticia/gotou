import { useMemo, useState } from "react";
import { ChevronLeftIcon } from "./Icons";
import { formatJaDate, parseDateInput } from "./lib/jaDate";
import { listMemorials, nextMemorial } from "./lib/nenkaiki";
import type { Memorial } from "./lib/nenkaiki";

// 年回忌の早見表。命日を入れると中陰・百箇日・年回忌のおおよその日付を出す。
//
// 命日は保存しない(開発者=僧侶の判断)。故人に関わる情報を端末に残さないため、
// 画面を閉じれば消える。URLにも載せない。
// 数え方は src/lib/nenkaiki.ts の冒頭を参照。

interface NenkaikiScreenProps {
  onClose: () => void;
}

const GROUPS: { kind: Memorial["kind"]; title: string }[] = [
  { kind: "chuin", title: "中陰" },
  { kind: "hyakkanichi", title: "百箇日" },
  { kind: "nenki", title: "年回忌" },
];

export default function NenkaikiScreen({ onClose }: NenkaikiScreenProps) {
  const [input, setInput] = useState("");
  const memorials = useMemo(() => {
    const deathDate = parseDateInput(input);
    return deathDate ? listMemorials(deathDate) : [];
  }, [input]);
  const today = new Date();
  const next = nextMemorial(memorials, today);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button type="button" className="back-button" onClick={onClose}>
          <ChevronLeftIcon />
          <span>設定</span>
        </button>
      </div>
      <h2 className="settings-title">年回忌の早見表</h2>

      <section className="settings-group settings-textblock">
        <p className="settings-body-text">
          {"命日を入れると、中陰・百箇日・年回忌のおおよその日付が出ます。"
            + "法要の日取りは菩提寺とご相談ください。"}
        </p>
        <label className="nenkaiki-input-row">
          <span className="settings-row-label">命日</span>
          <input
            type="date"
            className="nenkaiki-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
      </section>

      {memorials.length > 0 && (
        <>
          {GROUPS.map(({ kind, title }) => (
            <div key={kind}>
              <h3 className="settings-subhead">{title}</h3>
              <ul className="settings-group nenkaiki-list">
                {memorials
                  .filter((m) => m.kind === kind)
                  .map((m) => {
                    const isPast = m.date.getTime() < todayStart;
                    const isNext = m === next;
                    const className = [
                      "nenkaiki-row",
                      isPast && "nenkaiki-row-past",
                      isNext && "nenkaiki-row-next",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <li key={m.label} className={className}>
                        <span className="nenkaiki-label">{m.label}</span>
                        {isNext && <span className="nenkaiki-next-mark">次</span>}
                        <span className="nenkaiki-date">{formatJaDate(m.date)}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          <p className="settings-footnote">
            {"命日を1日目として数えています(地域によっては前日から数えることもあります)。"
              + "年回忌は亡くなった年を1として数えます(一周忌は満1年、三回忌は満2年)。"
              + "入れた命日はこの端末にも保存しません。"}
          </p>
        </>
      )}
    </div>
  );
}
