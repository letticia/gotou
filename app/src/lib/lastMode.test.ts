import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODE, loadLastMode, saveLastMode } from "./lastMode";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadLastMode", () => {
  it("starts on the dictionary the first time", () => {
    stubStorage(() => null);
    expect(loadLastMode()).toBe("search");
    expect(DEFAULT_MODE).toBe("search");
  });

  it("returns the tab that was open last", () => {
    stubStorage(() => "gongyo");
    expect(loadLastMode()).toBe("gongyo");
    stubStorage(() => "gohogo");
    expect(loadLastMode()).toBe("gohogo");
  });

  it("falls back for an unknown value", () => {
    stubStorage(() => "settings");
    expect(loadLastMode()).toBe("search");
  });

  it("falls back when localStorage throws", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadLastMode()).toBe("search");
  });
});

describe("saveLastMode", () => {
  it("writes the tab", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveLastMode("gohogo");
    expect(setItem).toHaveBeenCalledWith("gotou:last-mode", "gohogo");
  });

  it("does not throw when the write is rejected", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveLastMode("gongyo")).not.toThrow();
  });
});
