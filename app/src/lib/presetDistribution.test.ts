import { describe, expect, it } from "vitest";
import type { GongyoPreset } from "./gongyo";
import {
  MAX_FROM_LENGTH,
  extractSharedPreset,
  findSamePreset,
  normalizeFrom,
  receivedInIosBrowser,
} from "./presetDistribution";
import { encodePresetForUrl, isValidGongyoPreset } from "./presetSharing";
import { duplicatePreset } from "./userPresets";

const preset: GongyoPreset = {
  version: 1,
  id: "user-abc",
  name: "日常勤行",
  from: "浄光寺",
  items: [{ unit: "koge" }, { unit: "junen", counter: 10 }],
};

describe("normalizeFrom", () => {
  it("trims and drops an empty value", () => {
    expect(normalizeFrom("  浄光寺 ")).toBe("浄光寺");
    expect(normalizeFrom("   ")).toBeUndefined();
    expect(normalizeFrom(undefined)).toBeUndefined();
  });

  it("caps the length", () => {
    expect(normalizeFrom("あ".repeat(MAX_FROM_LENGTH + 5))!.length).toBe(MAX_FROM_LENGTH);
  });
});

describe("findSamePreset", () => {
  it("finds the same preset even though the id differs", () => {
    const saved = { ...preset, id: "user-xyz" };
    expect(findSamePreset([saved], preset)).toBe(saved);
  });

  it("treats a different temple as a different preset", () => {
    expect(findSamePreset([{ ...preset, from: "別の寺" }], preset)).toBeNull();
  });

  it("treats a different order as a different preset", () => {
    const reordered = { ...preset, items: [...preset.items].reverse() };
    expect(findSamePreset([reordered], preset)).toBeNull();
  });
});

describe("extractSharedPreset", () => {
  const url = `https://letticia.github.io/gotou/#share=${encodePresetForUrl(preset)}`;

  it("reads a share link", () => {
    expect(extractSharedPreset(url).preset).toEqual(preset);
  });

  it("reads a share link pasted with surrounding text", () => {
    expect(extractSharedPreset(`浄光寺の差定です\n${url}\n`).preset).toEqual(preset);
  });

  it("reads the preset JSON", () => {
    expect(extractSharedPreset(JSON.stringify(preset)).preset).toEqual(preset);
  });

  it("explains a link that was cut off on the way", () => {
    // LINE等で貼り付けたとき末尾が欠けると、中身が読めなくなる
    const cut = url.slice(0, url.indexOf("#share=") + 20);
    const result = extractSharedPreset(cut);
    expect(result.preset).toBeNull();
    expect(result.error).toMatch(/切れているか、壊れて/);
  });

  it("explains text that is neither", () => {
    expect(extractSharedPreset("こんにちは").error).toMatch(/共有リンクでも差定のJSONでもない/);
    expect(extractSharedPreset("").error).toMatch(/貼り付けて/);
  });
});

describe("the from field", () => {
  it("survives the share link", () => {
    const url = `#share=${encodePresetForUrl(preset)}`;
    expect(extractSharedPreset(url).preset?.from).toBe("浄光寺");
  });

  it("must be a string when present", () => {
    expect(isValidGongyoPreset({ ...preset, from: 3 })).toBe(false);
    const { from: _from, ...withoutFrom } = preset;
    expect(isValidGongyoPreset(withoutFrom)).toBe(true);
  });

  it("is kept when a received preset is duplicated for editing", () => {
    expect(duplicatePreset(preset, "user-new", "自分用").from).toBe("浄光寺");
  });

  it("is not invented for a preset that has none", () => {
    const { from: _from, ...plain } = preset;
    expect("from" in duplicatePreset(plain, "user-new", "自分用")).toBe(false);
  });
});

describe("receivedInIosBrowser", () => {
  const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const iPadAsMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130";

  it("is true in Safari on an iPhone", () => {
    expect(receivedInIosBrowser(iPhone, 5, false)).toBe(true);
  });

  it("is true on an iPad that reports itself as a Mac", () => {
    expect(receivedInIosBrowser(iPadAsMac, 5, false)).toBe(true);
  });

  it("is false on a real Mac", () => {
    expect(receivedInIosBrowser(iPadAsMac, 0, false)).toBe(false);
  });

  it("is false inside the installed app", () => {
    expect(receivedInIosBrowser(iPhone, 5, true)).toBe(false);
  });

  it("is false on Android (the browser and the app share storage)", () => {
    expect(receivedInIosBrowser(android, 5, false)).toBe(false);
  });
});
