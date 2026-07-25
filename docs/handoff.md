# 引き継ぎ文書 — 語灯 (gotou)

この文書は、企画フェーズ(2026-07-24〜25)から実装フェーズ(Claude Code)への引き継ぎである。
毎回守るルールは各 CLAUDE.md を参照。ここには経緯と現状と直近タスクを書く。

## プロジェクト概要

浄土宗大辞典(https://jodoshuzensho.jp/daijiten/ 、MediaWiki・約1万項目)をスマホで引ける
辞書アプリ。正式名は「語灯(ごとう) ― 浄土のことば辞典」、愛称はマスコットの「ごとうさん」。
主対象は檀家・信徒。開発者は浄土宗僧侶の一人開発(Python経験あり)。

## 現状(2026-07-25時点、企画からタスク⑦まで完了)

- `factory/src/` に既存のPythonスクリプト(記事・画像取得、.Dictionary出力)を受け入れ済み。
  `wikitext.py` に変換ロジックを共通化し、`build_sqlite.py` で `shared/schema.sql` 準拠の
  SQLite(FTS5・links・aliasesテーブル含む)を出力できる。`--source {cache,fixtures}` で
  実データ/ダミーfixtureを切り替え可能(既定値`cache`)。pytest 16件、全pass。
- `app/` はVite+React+TSで、検索モード(読みインクリメンタル・異体字対応・実SQLクエリ)と
  勤行モード(shared/gongyo/のサンプル、カウンター・タップ送り)を実装済み。
  辞書DBは`@sqlite.org/sqlite-wasm`(**sql.jsではない**、後述)経由で読み、
  初回ダウンロード→Cache API永続化→進捗表示まで動作する。項目本文はfactoryが生成した
  本物のHTML(body_html)をそのまま表示し、内部リンクのクリックでアプリ内ジャンプする。
  vitest 24件、全pass。
- GitHub Actions(`.github/workflows/ci.yml`)でfactory pytest・app vitest/buildを
  push/PR時に自動実行するようにした。
- 辞書データの利用許諾は未取得。よって実データは一切公開しない(CLAUDE.mdの掟)。
  appはダミーfixtureから`app/scripts/build-dummy-db.mjs`(factory側`build_sqlite.py`を
  呼び出す)で作った非公開の開発用SQLiteのみを使っている。
- **GitHub Pagesへの公開はまだ行っていない**(ダミーデータのみとはいえ、非公式表示等を
  整えるまでは保留、と開発者と合意)。
- 検討の経緯全体は docs/plan-2026-07.html(人間の閲覧用・更新不要)。

## 決定事項サマリ(更新あり)

- **技術**: TypeScript/React のPWA。辞書DBは **`@sqlite.org/sqlite-wasm`**
  (sql.jsは標準ビルドがFTS5を含まずshared/schema.sqlのentries_ftsが作れないため不採用。
  wa-sqlite/OPFSは今のところ不要と判断、main threadでの利用で足りている)。
  GitHub Pages + Actions で配信予定(未着手)。将来 Capacitor でiOS/Androidストア展開。
- **検索**: 読みのインクリメンタル・前方一致が主役。異体字は shared/variants.json で吸収。
  実装済み。音声入力(kuromoji.jsで読みに戻す)とカメラOCR(収録語スキャン)は未着手。
  起動時の既定検索モード(文字/音声/カメラ)切替も未着手(今は文字検索のみ)。
- **勤行モード**: 差定をプレイリストとして扱う(docs/saijo-spec.md)。骨組みは実装済み
  (十念のみ、shared/gongyo/units/junen.json)。ユーザーによる差定編集(並べ替え・オンオフ・
  回数指定)、回転ロック、テンポ式オートスクロール・縦書きモード(v1.5)は未着手。
  他unit(香偈・三宝礼等)の本文は開発者による原文収集待ち。
- **データ取得〜表示の一気通貫**: factoryのwikitext→HTML変換をそのままappが表示する構成に
  統一済み(TS側での簡易再パースはしていない)。
- **計測**: Plausible/Umami 系、未着手。
- **モデル運用**: 実装はSonnet。設計はプランモードで計画してから着手(本セッションで一貫)。

## 次にやるタスク(候補、優先度は未確定)

- PWA化(manifest.webmanifest + Service Worker、ホーム画面追加対応)
- 音声入力(キーボード標準マイク + kuromoji.jsで読みに戻すパイプライン)
- 差定の編集操作(並べ替え・オンオフ・回数指定)
- GitHub Pages公開(ダミーデータでの実証実験。非公式表示・出典明記を整えてから)
- 計測導入(Plausible/Umami)
- カメラOCR、Capacitor化は許諾状況・優先度次第で後続

## 未決・保留(開発者側タスク含む)

- 勤行テキスト原文の収集(日常勤行式は収録済み。法要等の特殊な次第は未)
- 音声入力・カメラOCRの実装時期
- 実データ配信サーバーの選定

## 連絡・確認の掟

宗門の慣習(差定の組み替え、勤行の作法など)に関わる仕様判断は推測しない。
開発者は当事者(僧侶)なので、直接質問するのが最短である。

## 作業時の注意(本セッションでの教訓)

`factory/src/build_sqlite.py` などfactoryのスクリプトは、引数を省略すると
`factory/cache/`(実データ)をデフォルトで読む。ダミーfixtureで作業する際は
`--source fixtures` を必ず明示し、実行後は `git status --ignored` で
`factory/output/`・`factory/cache/`・`app/public/` に実データ由来のファイルが
紛れ込んでいないか確認すること。
