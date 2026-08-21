import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeExternalSite,
  externalLinkConfirmMessage,
  hasSeenExternalLinkNotice,
  markExternalLinkNoticeSeen,
} from "./externalLinks";

describe("describeExternalSite", () => {
  it("names the Jozen text database", () => {
    expect(
      describeExternalSite(
        "https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508",
      ),
    ).toBe("浄土宗全書テキストデータベース");
  });

  it("names the SAT database", () => {
    expect(describeExternalSite("https://21dzk.l.u-tokyo.ac.jp/SAT2018/V51.0861a.html")).toBe(
      "SAT大正新脩大藏經テキストデータベース",
    );
  });

  it("matches case-insensitively", () => {
    expect(describeExternalSite("https://21DZK.L.U-TOKYO.AC.JP/SAT2018/V51.0861a.html")).toBe(
      "SAT大正新脩大藏經テキストデータベース",
    );
  });

  it("returns null for an unknown site", () => {
    expect(describeExternalSite("https://example.com/foo")).toBeNull();
  });
});

describe("externalLinkConfirmMessage", () => {
  it("names a known site in the message", () => {
    const msg = externalLinkConfirmMessage(
      "https://jodoshuzensho.jp/jozensearch_post/search/detail.php?lineno=J09_0508",
    );
    expect(msg).toContain("浄土宗全書テキストデータベース");
  });

  it("falls back to a generic wording for an unknown site", () => {
    const msg = externalLinkConfirmMessage("https://example.com/foo");
    expect(msg).toContain("外部サイト");
    expect(msg).not.toContain("『");
  });
});

describe("external link notice flag", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("is unseen before anything is stored", () => {
    expect(hasSeenExternalLinkNotice()).toBe(false);
  });

  it("is seen after being marked", () => {
    markExternalLinkNoticeSeen();
    expect(hasSeenExternalLinkNotice()).toBe(true);
  });

  it("treats an unreadable localStorage as unseen so the notice is shown again", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(hasSeenExternalLinkNotice()).toBe(false);
    expect(() => markExternalLinkNoticeSeen()).not.toThrow();
  });
});
