import { useState } from "react";
import SearchMode from "./SearchMode";
import GongyoMode from "./GongyoMode";

type Mode = "search" | "gongyo";

export default function App() {
  const [mode, setMode] = useState<Mode>("search");

  return (
    <div className={mode === "gongyo" ? "shell shell-gongyo" : "shell"}>
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
