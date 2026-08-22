// 浄全DBへの実アクセスを伴うテストは書かない(docs/tenkyo-spec.md テスト方針)。
// ここで固定するのは、B-3事前検証で判明した送信仕様(POST・action・フィールド名)。
// これらは実サイトを調べて確定した値なので、勝手に変わると壊れる。
// 実際のDOM組み立て・送信はブラウザで確認する(このリポジトリはjsdomを入れていない)。
import { describe, expect, it } from "vitest";
import { JOZEN_SEARCH_ACTION, JOZEN_SEARCH_FIELD, buildJozenFormSpec } from "./jozenSearch";

describe("buildJozenFormSpec", () => {
  it("posts to the Jozen DB search endpoint in a new tab", () => {
    const spec = buildJozenFormSpec("南無阿弥陀仏");
    expect(spec).not.toBeNull();
    expect(spec!.method).toBe("POST");
    expect(spec!.action).toBe(JOZEN_SEARCH_ACTION);
    expect(spec!.target).toBe("_blank");
  });

  it("sends the keyword in the keywd field", () => {
    const spec = buildJozenFormSpec("南無阿弥陀仏");
    expect(spec!.fields).toEqual([{ name: JOZEN_SEARCH_FIELD, value: "南無阿弥陀仏" }]);
  });

  it("sends only that one field (the endpoint takes no hidden fields)", () => {
    expect(buildJozenFormSpec("十念")!.fields).toHaveLength(1);
  });

  it("uses the https endpoint under the jozensearch_post path", () => {
    expect(JOZEN_SEARCH_ACTION).toMatch(/^https:\/\//);
    expect(JOZEN_SEARCH_ACTION).toContain("jozensearch_post");
  });

  it("returns null for an empty keyword so nothing is submitted", () => {
    expect(buildJozenFormSpec("")).toBeNull();
  });

  it("can target a named iframe so the result shows inside the app", () => {
    const spec = buildJozenFormSpec("十念", "jozen-frame");
    expect(spec!.target).toBe("jozen-frame");
    // 送信先が変わってもPOST・action・フィールドは同じ契約のまま
    expect(spec!.method).toBe("POST");
    expect(spec!.action).toBe(JOZEN_SEARCH_ACTION);
    expect(spec!.fields).toEqual([{ name: JOZEN_SEARCH_FIELD, value: "十念" }]);
  });
});
