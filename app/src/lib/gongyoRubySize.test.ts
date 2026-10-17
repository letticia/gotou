import { afterEach, describe, expect, it, vi } from "vitest";
import { RUBY_TO_TEXT_RATIO, loadRubySize, saveRubySize } from "./gongyoRubySize";
import { verticalMaxLineLength } from "./gongyo";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadRubySize / saveRubySize", () => {
  it("defaults to normal", () => {
    stubStorage(() => null);
    expect(loadRubySize()).toBe("normal");
  });

  it("reads large", () => {
    stubStorage(() => "large");
    expect(loadRubySize()).toBe("large");
  });

  it("falls back for unknown values and errors", () => {
    stubStorage(() => "huge");
    expect(loadRubySize()).toBe("normal");
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadRubySize()).toBe("normal");
  });

  it("writes the size", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveRubySize("large");
    expect(setItem).toHaveBeenCalledWith("gotou:gongyo-ruby-size", "large");
  });
});

describe("vertical sizing with a larger reading", () => {
  // 本文4字にルビ9字(光明遍照 こうみょうへんじょう)のように、ルビのほうが長い行
  const lines = [{ text: "光明遍照", ruby: "こうみょうへんじょう" }];

  it("needs more height when the reading is enlarged", () => {
    const normal = verticalMaxLineLength(lines, RUBY_TO_TEXT_RATIO.normal);
    const large = verticalMaxLineLength(lines, RUBY_TO_TEXT_RATIO.large);
    expect(normal).toBe(4); // 10×0.4 = 4
    expect(large).toBe(6); // 10×0.55 = 5.5 → 6
  });

  it("does not change a line whose text is longer than its reading needs", () => {
    const long = [{ text: "念のこころを悟りて申す念仏にもあらず。", ruby: "ねんのこころをさとりてもうすねんぶつにもあらず。" }];
    expect(verticalMaxLineLength(long, RUBY_TO_TEXT_RATIO.large)).toBe(19);
  });
});
