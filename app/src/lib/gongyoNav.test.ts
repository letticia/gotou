import { describe, expect, it } from "vitest";
import { advance, goBack, initState } from "./gongyoNav";
import type { GongyoPage } from "./gongyo";

const pages: GongyoPage[] = [
  { unitId: "koge", itemIndex: 0, unitTitle: "香偈", lines: [{ text: "香偈句" }] },
  {
    unitId: "junen",
    itemIndex: 1,
    unitTitle: "十念",
    lines: [{ text: "南無阿弥陀仏" }],
    counterTotal: 3,
  },
  { unitId: "shiseige", itemIndex: 2, unitTitle: "四誓偈", lines: [{ text: "四誓偈句" }] },
];

describe("gongyoNav", () => {
  it("initState has no counter for a page without counterTotal", () => {
    expect(initState(pages, 0)).toEqual({ pageIndex: 0, counterRemaining: null });
  });

  it("initState sets counterRemaining to counterTotal for a counted page", () => {
    expect(initState(pages, 1)).toEqual({ pageIndex: 1, counterRemaining: 3 });
  });

  it("advance on a page without a counter moves to the next page", () => {
    const state = initState(pages, 0);
    expect(advance(state, pages)).toEqual({ pageIndex: 1, counterRemaining: 3 });
  });

  it("advance on a counted page decrements the counter without changing page", () => {
    let state = initState(pages, 1);
    state = advance(state, pages);
    expect(state).toEqual({ pageIndex: 1, counterRemaining: 2 });
    state = advance(state, pages);
    expect(state).toEqual({ pageIndex: 1, counterRemaining: 1 });
  });

  it("advance moves to the next page once the counter reaches 0", () => {
    let state: ReturnType<typeof initState> = { pageIndex: 1, counterRemaining: 0 };
    state = advance(state, pages);
    expect(state).toEqual({ pageIndex: 2, counterRemaining: null });
  });

  it("advance on the last page does nothing further", () => {
    const state = initState(pages, 2);
    expect(advance(state, pages)).toEqual(state);
  });

  it("goBack returns to the previous page and resets its counter", () => {
    const state = initState(pages, 2);
    expect(goBack(state, pages)).toEqual({ pageIndex: 1, counterRemaining: 3 });
  });

  it("goBack on the first page does nothing", () => {
    const state = initState(pages, 0);
    expect(goBack(state, pages)).toEqual(state);
  });
});
