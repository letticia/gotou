// 浄土宗全書テキストデータベース(浄全DB)への検索リンクアウト(docs/tenkyo-spec.md B-3)。
//
// B-3事前検証(2026-08-16)の結果、浄全DBの検索は **POST専用** と判明している:
//   action = search/connect_jozen_DB.php / method = POST / フィールドは keywd のみ
//   (hidden項目も巻選択も無い。GETで同じURLを叩くと検索語が取り込まれず0件になる)
// そのため window.open ではなく、画面外のformを組んでPOSTする。
//
// 掟(docs/tenkyo-spec.md 大原則): 利用者のタップ1回につきリクエスト1回。
// 結果の取得・解析・保存はしない。プリフェッチも存在確認もしない。
// この関数は外部サイトへ遷移させるので、**呼び出し側で externalLinks.ts の関門
// (オフライン判定・初回確認ダイアログ)を必ず通すこと。**

export const JOZEN_SEARCH_ACTION =
  "https://jodoshuzensho.jp/jozensearch_post/search/connect_jozen_DB.php";

export const JOZEN_SEARCH_FIELD = "keywd";

/** 新しいタブへ出す場合の送信先 */
export const JOZEN_TARGET_NEW_TAB = "_blank";

/** 送信するformの内容。B-3事前検証で確定した値を1箇所に閉じ込めておく */
export interface JozenFormSpec {
  action: string;
  method: "POST";
  target: string;
  fields: ReadonlyArray<{ name: string; value: string }>;
}

/**
 * 送信すべきformの内容を組み立てる(純粋関数)。
 * B-3事前検証で確定した契約(POST・action・keywdのみ)をここで固定し、
 * テストで固定できるようにDOM操作から分離している。
 * 検索語が空の場合はnull(送信しない)。
 *
 * targetにiframeのname属性を渡すと、そのiframeの中に結果を表示できる
 * (アプリ内表示。浄全DBはCORSを許可していないのでfetchでは取得できないが、
 * iframeなら利用者のブラウザが直接読み込むため表示できる)。
 */
export function buildJozenFormSpec(
  keyword: string,
  target: string = JOZEN_TARGET_NEW_TAB,
): JozenFormSpec | null {
  if (!keyword) return null;
  return {
    action: JOZEN_SEARCH_ACTION,
    method: "POST",
    target,
    fields: [{ name: JOZEN_SEARCH_FIELD, value: keyword }],
  };
}

/**
 * 画面外にformを作り、指定の送信先へPOSTして即座に取り除く。
 * 既定は新しいタブ。iframeのname属性を渡すとアプリ内に結果を表示できる。
 * どちらもトップレベル/フレームの遷移なのでCORSの制約は受けない。
 */
export function submitJozenSearch(keyword: string, target: string = JOZEN_TARGET_NEW_TAB): void {
  const spec = buildJozenFormSpec(keyword, target);
  if (!spec) return;

  const form = document.createElement("form");
  form.method = spec.method;
  form.action = spec.action;
  form.target = spec.target;
  // 画面に見えないようにする(一瞬でも表示されると崩れて見えるため)
  form.style.display = "none";

  for (const { name, value } of spec.fields) {
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    form.appendChild(field);
  }

  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    form.remove();
  }
}
