import { describe, expect, it } from "vitest";
import {
  decodePresetFromUrl,
  encodePresetForUrl,
  isValidGongyoPreset,
  parseShareHash,
} from "./presetSharing";
import type { GongyoPreset } from "./gongyo";

const preset: GongyoPreset = {
  version: 1,
  id: "user-abc",
  name: "わたしの差定(日常勤行式・三奉請版のコピー)",
  items: [{ unit: "koge" }, { unit: "junen", counter: 10 }, { unit: "sanborai", enabled: false }],
};

describe("encodePresetForUrl / decodePresetFromUrl", () => {
  it("round-trips a preset containing Japanese text", () => {
    const encoded = encodePresetForUrl(preset);
    expect(decodePresetFromUrl(encoded)).toEqual(preset);
  });

  it("produces a URL-safe string (no +, /, or = padding)", () => {
    const encoded = encodePresetForUrl(preset);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for garbled base64", () => {
    expect(decodePresetFromUrl("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid base64 that isn't JSON", () => {
    const encoded = btoa("this is not json");
    expect(decodePresetFromUrl(encoded)).toBeNull();
  });

  it("returns null for valid JSON that isn't a valid preset shape", () => {
    const encoded = btoa(JSON.stringify({ foo: "bar" }));
    expect(decodePresetFromUrl(encoded)).toBeNull();
  });
});

describe("isValidGongyoPreset", () => {
  it("accepts a well-formed preset", () => {
    expect(isValidGongyoPreset(preset)).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(isValidGongyoPreset(null)).toBe(false);
    expect(isValidGongyoPreset("preset")).toBe(false);
    expect(isValidGongyoPreset(42)).toBe(false);
  });

  it("rejects an item missing a unit string", () => {
    expect(
      isValidGongyoPreset({ version: 1, id: "p", name: "n", items: [{ counter: 10 }] }),
    ).toBe(false);
  });

  it("rejects a preset missing required top-level fields", () => {
    expect(isValidGongyoPreset({ id: "p", name: "n", items: [] })).toBe(false);
  });
});

describe("parseShareHash", () => {
  it("decodes a valid #share= hash", () => {
    const encoded = encodePresetForUrl(preset);
    expect(parseShareHash(`#share=${encoded}`)).toEqual(preset);
  });

  it("returns null for a hash without the share= prefix", () => {
    expect(parseShareHash("#somethingelse")).toBeNull();
  });

  it("returns null for an empty hash", () => {
    expect(parseShareHash("")).toBeNull();
  });
});
