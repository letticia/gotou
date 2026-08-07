import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SCALE_INDEX,
  FONT_SCALE_STEPS,
  canDecrease,
  canIncrease,
  loadScaleIndex,
  saveScaleIndex,
} from "./dictFontScale";

function stubStorage(getItem: () => string | null, setItem: () => void = () => {}) {
  vi.stubGlobal("localStorage", { getItem, setItem } as unknown as Storage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadScaleIndex", () => {
  it("defaults to 100% when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadScaleIndex()).toBe(DEFAULT_SCALE_INDEX);
    expect(FONT_SCALE_STEPS[DEFAULT_SCALE_INDEX]).toBe(1);
  });

  it("returns the index matching the saved scale", () => {
    stubStorage(() => "1.3");
    expect(loadScaleIndex()).toBe(FONT_SCALE_STEPS.indexOf(1.3));
  });

  it("falls back to the default for an unrecognized stored value", () => {
    stubStorage(() => "2.5");
    expect(loadScaleIndex()).toBe(DEFAULT_SCALE_INDEX);
  });

  it("falls back to the default when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadScaleIndex()).toBe(DEFAULT_SCALE_INDEX);
  });
});

describe("saveScaleIndex", () => {
  it("writes the scale value (not the index) to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveScaleIndex(3);
    expect(setItem).toHaveBeenCalledWith("gotou:dict-font-scale", String(FONT_SCALE_STEPS[3]));
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveScaleIndex(0)).not.toThrow();
  });
});

describe("canIncrease / canDecrease", () => {
  it("allows increasing except at the last step", () => {
    expect(canIncrease(0)).toBe(true);
    expect(canIncrease(FONT_SCALE_STEPS.length - 2)).toBe(true);
    expect(canIncrease(FONT_SCALE_STEPS.length - 1)).toBe(false);
  });

  it("allows decreasing except at the first step", () => {
    expect(canDecrease(FONT_SCALE_STEPS.length - 1)).toBe(true);
    expect(canDecrease(1)).toBe(true);
    expect(canDecrease(0)).toBe(false);
  });
});
