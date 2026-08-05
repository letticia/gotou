import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FONT,
  fontStackFor,
  loadFontChoice,
  saveFontChoice,
} from "./fontChoice";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadFontChoice", () => {
  it("defaults to Noto Serif JP when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadFontChoice()).toBe("noto-serif-jp");
    expect(DEFAULT_FONT).toBe("noto-serif-jp");
  });

  it("returns the saved font choice", () => {
    stubStorage(() => "zen-old-mincho");
    expect(loadFontChoice()).toBe("zen-old-mincho");
  });

  it("falls back to the default for an unrecognized stored value", () => {
    stubStorage(() => "comic-sans");
    expect(loadFontChoice()).toBe("noto-serif-jp");
  });

  it("falls back to the default when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadFontChoice()).toBe("noto-serif-jp");
  });
});

describe("saveFontChoice", () => {
  it("writes the font choice to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveFontChoice("klee-one");
    expect(setItem).toHaveBeenCalledWith("gotou:font-choice", "klee-one");
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveFontChoice("noto-serif-jp")).not.toThrow();
  });
});

describe("fontStackFor", () => {
  it("maps each choice to its font-family stack with a generic fallback", () => {
    expect(fontStackFor("noto-serif-jp")).toBe("'Noto Serif JP', serif");
    expect(fontStackFor("zen-old-mincho")).toBe("'Zen Old Mincho', serif");
    expect(fontStackFor("klee-one")).toBe("'Klee One', sans-serif");
  });
});
