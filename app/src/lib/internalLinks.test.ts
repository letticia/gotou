import { describe, expect, it } from "vitest";
import { parseInternalLinkTarget } from "./internalLinks";

describe("parseInternalLinkTarget", () => {
  it("extracts the entry id from a resolved internal link href", () => {
    expect(parseInternalLinkTarget("x-dictionary:r:entry_42")).toBe(42);
  });

  it("returns null for a broken-link href (raw title, no entry_ prefix)", () => {
    expect(parseInternalLinkTarget("x-dictionary:r:存在しない項目999")).toBeNull();
  });

  it("returns null for an unrelated href", () => {
    expect(parseInternalLinkTarget("https://example.com")).toBeNull();
  });
});
