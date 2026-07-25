import { describe, expect, it } from "vitest";
import { isDictionaryDataRequest } from "./swCacheRules";

describe("isDictionaryDataRequest", () => {
  it("matches the dictionary SQLite path exactly", () => {
    expect(isDictionaryDataRequest("/dictionary.sqlite3")).toBe(true);
  });

  it("matches the dictionary manifest path exactly", () => {
    expect(isDictionaryDataRequest("/dictionary-manifest.json")).toBe(true);
  });

  it("matches when prefixed by a subpath (e.g. a future GitHub Pages base)", () => {
    expect(isDictionaryDataRequest("/gotou/dictionary.sqlite3")).toBe(true);
  });

  it("does not match unrelated paths", () => {
    expect(isDictionaryDataRequest("/not-dictionary.sqlite3")).toBe(false);
    expect(isDictionaryDataRequest("/index.html")).toBe(false);
    expect(isDictionaryDataRequest("/")).toBe(false);
  });
});
