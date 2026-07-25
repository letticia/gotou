import { describe, expect, it } from "vitest";
import {
  duplicatePreset,
  generateUserPresetId,
  reorderItems,
  setItemCounter,
  toggleItemEnabled,
} from "./userPresets";
import type { GongyoPreset, GongyoPresetItem } from "./gongyo";

const preset: GongyoPreset = {
  version: 1,
  id: "nichijo-gongyo-sanbujo",
  name: "日常勤行式(三奉請・三身礼版)",
  items: [{ unit: "koge" }, { unit: "junen", counter: 10 }],
};

describe("duplicatePreset", () => {
  it("creates a new preset with the given id/name and a deep-copied items array", () => {
    const copy = duplicatePreset(preset, "user-abc", "わたしの差定");
    expect(copy).toEqual({
      version: 1,
      id: "user-abc",
      name: "わたしの差定",
      items: [{ unit: "koge" }, { unit: "junen", counter: 10 }],
    });
    expect(copy.items).not.toBe(preset.items);
    expect(copy.items[0]).not.toBe(preset.items[0]);
  });

  it("does not mutate the source preset", () => {
    const copy = duplicatePreset(preset, "user-abc", "わたしの差定");
    copy.items[0].unit = "changed";
    expect(preset.items[0].unit).toBe("koge");
  });
});

describe("reorderItems", () => {
  const items: GongyoPresetItem[] = [{ unit: "a" }, { unit: "b" }, { unit: "c" }];

  it("moves an item from one index to another", () => {
    expect(reorderItems(items, 0, 2)).toEqual([{ unit: "b" }, { unit: "c" }, { unit: "a" }]);
  });

  it("moves an item earlier in the list", () => {
    expect(reorderItems(items, 2, 0)).toEqual([{ unit: "c" }, { unit: "a" }, { unit: "b" }]);
  });

  it("returns the original array unchanged for out-of-range indices", () => {
    expect(reorderItems(items, 0, 5)).toBe(items);
    expect(reorderItems(items, -1, 1)).toBe(items);
  });

  it("returns the original array unchanged when fromIndex equals toIndex", () => {
    expect(reorderItems(items, 1, 1)).toBe(items);
  });
});

describe("toggleItemEnabled", () => {
  it("disables an item that has no enabled field (defaults to enabled)", () => {
    const items: GongyoPresetItem[] = [{ unit: "a" }];
    expect(toggleItemEnabled(items, 0)).toEqual([{ unit: "a", enabled: false }]);
  });

  it("re-enables a disabled item", () => {
    const items: GongyoPresetItem[] = [{ unit: "a", enabled: false }];
    expect(toggleItemEnabled(items, 0)).toEqual([{ unit: "a", enabled: true }]);
  });

  it("leaves other items untouched", () => {
    const items: GongyoPresetItem[] = [{ unit: "a" }, { unit: "b" }];
    expect(toggleItemEnabled(items, 1)).toEqual([{ unit: "a" }, { unit: "b", enabled: false }]);
  });
});

describe("setItemCounter", () => {
  it("sets a counter on the target item", () => {
    const items: GongyoPresetItem[] = [{ unit: "a" }];
    expect(setItemCounter(items, 0, 5)).toEqual([{ unit: "a", counter: 5 }]);
  });

  it("removes the counter field when passed undefined", () => {
    const items: GongyoPresetItem[] = [{ unit: "a", counter: 10 }];
    expect(setItemCounter(items, 0, undefined)).toEqual([{ unit: "a" }]);
  });
});

describe("generateUserPresetId", () => {
  it("returns a string prefixed with 'user-'", () => {
    expect(generateUserPresetId()).toMatch(/^user-/);
  });

  it("returns distinct ids on successive calls", () => {
    expect(generateUserPresetId()).not.toBe(generateUserPresetId());
  });
});
