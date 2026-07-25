import type { GongyoPage } from "./gongyo";

export interface GongyoNavState {
  pageIndex: number;
  counterRemaining: number | null;
}

export function initState(pages: GongyoPage[], pageIndex = 0): GongyoNavState {
  const page = pages[pageIndex];
  return {
    pageIndex,
    counterRemaining: page?.counterTotal ?? null,
  };
}

/**
 * タップ1回分の状態遷移。
 * カウンターが残っていれば1減算するのみ(ページはそのまま)。
 * カウンターが無い/使い切っていれば次ページへ進み、次ページのカウンターを初期化する。
 * 最終ページでカウンターを使い切った場合は状態を変えない(これ以上進めない)。
 */
export function advance(state: GongyoNavState, pages: GongyoPage[]): GongyoNavState {
  if (state.counterRemaining !== null && state.counterRemaining > 0) {
    return { ...state, counterRemaining: state.counterRemaining - 1 };
  }
  const nextIndex = state.pageIndex + 1;
  if (nextIndex >= pages.length) {
    return state;
  }
  return initState(pages, nextIndex);
}

/** 直前のページへ戻る(補助操作用。カウンターはそのページの初期値に戻す) */
export function goBack(state: GongyoNavState, pages: GongyoPage[]): GongyoNavState {
  const prevIndex = state.pageIndex - 1;
  if (prevIndex < 0) {
    return state;
  }
  return initState(pages, prevIndex);
}
