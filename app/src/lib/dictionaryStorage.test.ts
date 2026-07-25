import { describe, expect, it } from "vitest";
import { concatChunks, withVersion } from "./dictionaryStorage";

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

describe("concatChunks", () => {
  it("concatenates chunks in order into a single Uint8Array", () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])];
    expect(concatChunks(chunks, 5)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("returns an empty array for no chunks", () => {
    expect(concatChunks([], 0)).toEqual(new Uint8Array(0));
  });
});
