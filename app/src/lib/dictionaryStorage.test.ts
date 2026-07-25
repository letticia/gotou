import { describe, expect, it } from "vitest";
import { withVersion } from "./dictionaryStorage";

describe("withVersion", () => {
  it("appends the version as a query parameter", () => {
    expect(withVersion("/dictionary.sqlite3", "abc123")).toBe("/dictionary.sqlite3?v=abc123");
  });

  it("produces a different URL for a different version (cache-key invalidation)", () => {
    const a = withVersion("/dictionary.sqlite3", "abc123");
    const b = withVersion("/dictionary.sqlite3", "def456");
    expect(a).not.toBe(b);
  });
});
