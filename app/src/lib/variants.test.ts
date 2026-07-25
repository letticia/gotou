import { describe, expect, it } from "vitest";
import { normalizeSearchInput } from "./variants";

describe("normalizeSearchInput", () => {
  it("maps known variant kanji to their modern form", () => {
    expect(normalizeSearchInput("佛教")).toBe("仏教");
    expect(normalizeSearchInput("彌勒")).toBe("弥勒");
  });

  it("applies NFKC normalization (full-width to half-width)", () => {
    expect(normalizeSearchInput("ＡＢＣ")).toBe("ABC");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSearchInput("")).toBe("");
  });

  it("leaves already-modern kanji unchanged", () => {
    expect(normalizeSearchInput("阿弥陀")).toBe("阿弥陀");
  });
});
