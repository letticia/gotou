import { useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";

type Mode = "search" | "gongyo";

export default function App() {
  const [mode, setMode] = useState<Mode>("search");

  return (
    <div className={mode === "gongyo" ? "shell shell-gongyo" : "shell"}>
      <div className="prototype-notice">
        これは開発中のプロトタイプです。収録内容はダミーデータで、浄土宗大辞典の内容ではありません。浄土宗の公式アプリではありません。
      </div>
      <nav className="mode-tabs">
        <button
          type="button"
          className={mode === "search" ? "active" : ""}
          onClick={() => setMode("search")}
        >
          辞書
        </button>
        <button
          type="button"
          className={mode === "gongyo" ? "active" : ""}
          onClick={() => setMode("gongyo")}
        >
          勤行
        </button>
      </nav>
      {mode === "search" ? <SearchMode /> : <GongyoMode />}
    </div>
  );
}
