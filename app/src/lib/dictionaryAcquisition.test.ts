import { describe, expect, it } from "vitest";
import { acquisitionProgressText } from "./dictionaryAcquisition";

describe("acquisitionProgressText", () => {
  it("formats the listing phase", () => {
    expect(acquisitionProgressText({ phase: "listing", current: 120 })).toBe(
      "記事一覧を取得中…(120件)",
    );
  });

  it("formats the fetching phase with current/total", () => {
    expect(acquisitionProgressText({ phase: "fetching", current: 1200, total: 9197 })).toBe(
      "記事本文を取得中…(1200/9197件)",
    );
  });

  it("formats the building phase", () => {
    expect(acquisitionProgressText({ phase: "building" })).toBe("変換・索引作成中…");
  });
});
