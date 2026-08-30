import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROGRESS_MAX_AGE_MS,
  clearProgress,
  isResumable,
  loadProgress,
  saveProgress,
} from "./gongyoProgress";
import type { GongyoProgress } from "./gongyoProgress";

function stubStorage(
  getItem: () => string | null,
  setItem: () => void = () => {},
  removeItem: () => void = () => {},
) {
  vi.stubGlobal("localStorage", { getItem, setItem, removeItem } as unknown as Storage);
}

const sample: GongyoProgress = {
  presetId: "nichijo-gongyo-sanbujo",
  itemIndex: 10,
  pageOffset: 2,
  counterRemaining: null,
  savedAt: 1_700_000_000_000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadProgress", () => {
  it("returns null when nothing has been saved", () => {
    stubStorage(() => null);
    expect(loadProgress()).toBeNull();
  });

  it("returns the saved position", () => {
    stubStorage(() => JSON.stringify(sample));
    expect(loadProgress()).toEqual(sample);
  });

  it("keeps a stored counter remaining", () => {
    const withCounter = { ...sample, counterRemaining: 7 };
    stubStorage(() => JSON.stringify(withCounter));
    expect(loadProgress()).toEqual(withCounter);
  });

  it("returns null for malformed JSON", () => {
    stubStorage(() => "{not json");
    expect(loadProgress()).toBeNull();
  });

  it("returns null when a field has the wrong type", () => {
    stubStorage(() => JSON.stringify({ ...sample, itemIndex: "10" }));
    expect(loadProgress()).toBeNull();
  });

  it("returns null when a field is missing", () => {
    stubStorage(() => JSON.stringify({ presetId: "x", itemIndex: 1 }));
    expect(loadProgress()).toBeNull();
  });

  it("rejects a negative or fractional position", () => {
    stubStorage(() => JSON.stringify({ ...sample, itemIndex: -1 }));
    expect(loadProgress()).toBeNull();
    stubStorage(() => JSON.stringify({ ...sample, pageOffset: 1.5 }));
    expect(loadProgress()).toBeNull();
  });

  it("returns null when localStorage throws (private browsing etc.)", () => {
    stubStorage(() => {
      throw new Error("denied");
    });
    expect(loadProgress()).toBeNull();
  });
});

describe("saveProgress", () => {
  it("writes the position to localStorage", () => {
    const setItem = vi.fn();
    stubStorage(() => null, setItem);
    saveProgress(sample);
    expect(setItem).toHaveBeenCalledWith("gotou:gongyo-progress", JSON.stringify(sample));
  });

  it("does not throw when localStorage rejects the write", () => {
    stubStorage(
      () => null,
      () => {
        throw new Error("quota");
      },
    );
    expect(() => saveProgress(sample)).not.toThrow();
  });
});

describe("clearProgress", () => {
  it("removes the stored position", () => {
    const removeItem = vi.fn();
    stubStorage(() => null, () => {}, removeItem);
    clearProgress();
    expect(removeItem).toHaveBeenCalledWith("gotou:gongyo-progress");
  });

  it("does not throw when localStorage rejects the removal", () => {
    stubStorage(
      () => null,
      () => {},
      () => {
        throw new Error("denied");
      },
    );
    expect(() => clearProgress()).not.toThrow();
  });
});

describe("isResumable", () => {
  const now = sample.savedAt + 60_000;

  it("offers a recent position in the same preset", () => {
    expect(isResumable(sample, sample.presetId, now)).toBe(true);
  });

  it("does not offer anything when nothing was saved", () => {
    expect(isResumable(null, sample.presetId, now)).toBe(false);
  });

  it("does not offer a position saved for another preset", () => {
    expect(isResumable(sample, "tanagyo-shinbo", now)).toBe(false);
  });

  it("does not offer a position that is still at the very beginning", () => {
    const atStart = { ...sample, itemIndex: 0, pageOffset: 0 };
    expect(isResumable(atStart, sample.presetId, now)).toBe(false);
  });

  it("offers a position part-way through the first item", () => {
    const insideFirstItem = { ...sample, itemIndex: 0, pageOffset: 3 };
    expect(isResumable(insideFirstItem, sample.presetId, now)).toBe(true);
  });

  it("stops offering a position once it is too old", () => {
    const justInside = sample.savedAt + PROGRESS_MAX_AGE_MS;
    expect(isResumable(sample, sample.presetId, justInside)).toBe(true);
    expect(isResumable(sample, sample.presetId, justInside + 1)).toBe(false);
  });

  it("still offers a position that looks future-dated (device clock moved)", () => {
    expect(isResumable(sample, sample.presetId, sample.savedAt - 86_400_000)).toBe(true);
  });
});
