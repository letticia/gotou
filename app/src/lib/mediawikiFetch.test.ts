import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllArticles,
  fetchAllPageTitles,
  fetchArticleBatch,
  makeBatches,
} from "./mediawikiFetch";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("makeBatches", () => {
  it("splits evenly when the length is an exact multiple of batchSize", () => {
    expect(makeBatches([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("puts the remainder in a smaller final batch", () => {
    expect(makeBatches([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it("returns an empty array for empty input", () => {
    expect(makeBatches([], 2)).toEqual([]);
  });
});

describe("fetchAllPageTitles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns all pages from a single response with no continuation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        query: { allpages: [{ pageid: 1, title: "阿弥陀仏" }] },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pages = await fetchAllPageTitles();
    expect(pages).toEqual([{ pageid: "1", title: "阿弥陀仏" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows apcontinue until the response has none, concatenating results and reporting progress", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          query: { allpages: [{ pageid: 1, title: "阿弥陀仏" }] },
          continue: { apcontinue: "next-token" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: { allpages: [{ pageid: 2, title: "観音菩薩" }] },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const progressCalls: number[] = [];
    const pages = await fetchAllPageTitles((count) => progressCalls.push(count));

    expect(pages).toEqual([
      { pageid: "1", title: "阿弥陀仏" },
      { pageid: "2", title: "観音菩薩" },
    ]);
    expect(progressCalls).toEqual([1, 2]);

    const secondCallUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("apcontinue=next-token");
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    await expect(fetchAllPageTitles()).rejects.toThrow(/status=503/);
  });
});

describe("fetchArticleBatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts pageid, title, and wikitext from the revisions response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          query: {
            pages: {
              "42": { title: "阿弥陀仏", revisions: [{ "*": "=あみだぶつ／阿弥陀仏=\n本文" }] },
            },
          },
        }),
      ),
    );

    const articles = await fetchArticleBatch(["42"]);
    expect(articles).toEqual([
      { pageid: "42", title: "阿弥陀仏", wikitext: "=あみだぶつ／阿弥陀仏=\n本文" },
    ]);
  });

  it("returns an empty wikitext when a page has no revisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          query: { pages: { "1": { title: "空の記事" } } },
        }),
      ),
    );

    const articles = await fetchArticleBatch(["1"]);
    expect(articles).toEqual([{ pageid: "1", title: "空の記事", wikitext: "" }]);
  });
});

describe("fetchAllArticles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps pages within one batch (batchSize=50) as a single request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        query: {
          pages: {
            "1": { title: "A", revisions: [{ "*": "wikitext-A" }] },
            "2": { title: "B", revisions: [{ "*": "wikitext-B" }] },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pages = [
      { pageid: "1", title: "A" },
      { pageid: "2", title: "B" },
    ];
    const progressCalls: Array<[number, number]> = [];
    const articles = await fetchAllArticles(
      pages,
      (fetched, total) => progressCalls.push([fetched, total]),
      undefined,
      0, // テストではバッチ間待機を無効化
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(articles).toHaveLength(2);
    expect(progressCalls).toEqual([[2, 2]]);
  });

  it("issues one request per batch when pages exceed batchSize (50)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            pages: Object.fromEntries(
              Array.from({ length: 50 }, (_, i) => [
                String(i + 1),
                { title: `記事${i + 1}`, revisions: [{ "*": "本文" }] },
              ]),
            ),
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: { pages: { "51": { title: "記事51", revisions: [{ "*": "本文" }] } } },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pages = Array.from({ length: 51 }, (_, i) => ({
      pageid: String(i + 1),
      title: `記事${i + 1}`,
    }));
    const articles = await fetchAllArticles(pages, undefined, undefined, 0);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(articles).toHaveLength(51);
  });
});
