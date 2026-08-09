import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COUNTER_MODE, loadCounterMode, saveCounterMode } from "./gongyoCounterMode";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadCounterMode", () => {
  it("defaults to label when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadCounterMode()).toBe("label");
    expect(DEFAULT_COUNTER_MODE).toBe("label");
  });

  it("returns the saved mode", () => {
    stubStorage(() => "count");
    expect(loadCounterMode()).toBe("count");
  });

  it("falls back to the default for an unrecognized stored value", () => {
    stubStorage(() => "verbose");
    expect(loadCounterMode()).toBe("label");
  });

  it("falls back to the default when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadCounterMode()).toBe("label");
  });
});

describe("saveCounterMode", () => {
  it("writes the mode to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveCounterMode("count");
    expect(setItem).toHaveBeenCalledWith("gotou:gongyo-counter-mode", "count");
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveCounterMode("label")).not.toThrow();
  });
});
