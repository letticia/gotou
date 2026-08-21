import { describe, expect, it } from "vitest";
import { buildJozenKeyword, extractClauses } from "./tenkyoNormalize";

describe("extractClauses", () => {
  it("splits a passage at Japanese punctuation", () => {
    expect(extractClauses("ただ往生極楽のためには、南無阿弥陀仏と申して、")).toEqual([
      "ただ往生極楽のためには",
      "南無阿弥陀仏と申して",
    ]);
  });

  it("splits at brackets and whitespace as well", () => {
    expect(extractClauses("「往生極楽のみち」　念仏往生の要義")).toEqual([
      "往生極楽のみち",
      "念仏往生の要義",
    ]);
  });

  it("drops clauses shorter than 4 characters", () => {
    expect(extractClauses("また、念仏を信ぜん人は、この")).toEqual(["念仏を信ぜん人は"]);
  });

  it("orders clauses longest first so the most distinctive one is queried first", () => {
    const clauses = extractClauses("あいうえお、あいうえおかきくけこ、あいうえおかき");
    expect(clauses).toEqual(["あいうえおかきくけこ", "あいうえおかき", "あいうえお"]);
  });

  it("removes duplicates", () => {
    expect(extractClauses("南無阿弥陀仏、南無阿弥陀仏。")).toEqual(["南無阿弥陀仏"]);
  });

  it("caps the number of clauses at five", () => {
    const input = [
      "いちばんながいくのれい",
      "にばんめのくのれい",
      "さんばんめのく",
      "よんばんめ",
      "ごばんめの",
      "ろくばんめ",
    ].join("、");
    expect(extractClauses(input)).toHaveLength(5);
  });

  it("returns an empty array for empty or punctuation-only input", () => {
    expect(extractClauses("")).toEqual([]);
    expect(extractClauses("、。「」")).toEqual([]);
  });

  it("keeps a passage without any punctuation as a single clause", () => {
    expect(extractClauses("南無阿弥陀仏")).toEqual(["南無阿弥陀仏"]);
  });
});

describe("buildJozenKeyword", () => {
  it("strips punctuation and whitespace", () => {
    expect(buildJozenKeyword("往生極楽のため、南無阿弥陀仏")).toBe("往生極楽のため南無阿弥陀仏");
  });

  it("keeps a short passage as a single term", () => {
    const keyword = buildJozenKeyword("南無阿弥陀仏");
    expect(keyword).toBe("南無阿弥陀仏");
    expect(keyword).not.toContain(" ");
  });

  it("splits an over-long passage into a two-term AND query", () => {
    // 30字(句読点なし)。前半10字 + 空白 + 続く10字 になる
    const input = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ";
    expect(buildJozenKeyword(input)).toBe("あいうえおかきくけこ さしすせそたちつてと");
  });

  it("never exceeds the 20-character budget (plus the separating space)", () => {
    const input = "あ、".repeat(60);
    const keyword = buildJozenKeyword(input);
    expect(keyword.replace(/ /g, "")).toHaveLength(20);
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(buildJozenKeyword("、。「」")).toBe("");
  });
});
