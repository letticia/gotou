# 引き継ぎ文書 — 語灯 (gotou)

この文書は、企画フェーズ(2026-07-24〜25)から実装フェーズ(Claude Code)への引き継ぎである。
毎回守るルールは各 CLAUDE.md を参照。ここには経緯と現状と直近タスクを書く。

## プロジェクト概要

浄土宗大辞典(https://jodoshuzensho.jp/daijiten/ 、MediaWiki・約1万項目)をスマホで引ける
辞書アプリ。正式名は「語灯(ごとう) ― 浄土のことば辞典」、愛称はマスコットの「ごとうさん」。
主対象は檀家・信徒。開発者は浄土宗僧侶の一人開発(Python経験あり)。

## 現状(2026-07-25時点)

- `factory/src/` に既存のPythonスクリプト(記事・画像取得、.Dictionary出力)を受け入れ済み。
  `wikitext.py` に変換ロジックを共通化し、`build_sqlite.py` で `shared/schema.sql` 準拠の
  SQLite(FTS5・links・aliasesテーブル含む)を出力できる。`--source {cache,fixtures}` で
  実データ/ダミーfixtureを切り替え可能(既定値`cache`)。pytest 16件、全pass。
- `app/` はVite+React+TSで、検索モード(読みインクリメンタル・異体字対応・実SQLクエリ)と
  勤行モード(差定プリセット選択・編集機能つき)を実装済み。辞書DBは
  `@sqlite.org/sqlite-wasm`経由で読み、初回ダウンロード→Cache API永続化→進捗表示まで
  動作する。項目本文はfactoryが生成した本物のHTML(body_html)をそのまま表示し、
  内部リンクのクリックでアプリ内ジャンプする。
- **PWA化完了**: Web App Manifest + 手書きのService Worker(`app/public/sw.js`)で
  アプリシェルのオフライン起動・ホーム画面追加に対応。vite-plugin-pwa等は使わず素の
  Cache API/Service Worker APIで実装(app/CLAUDE.mdの「Web標準から外れる実装を避ける」
  方針に沿う)。アイコンは開発者の正式素材待ちの仮素材(提灯モチーフ)。
- **勤行モードの日常勤行式データ完了**: 浄土宗公式サイト(jodo.or.jp)の日常勤行式PDFを
  底本に、香偈〜送仏偈まで全18項目をunit化(`shared/gongyo/units/`)。四奉請/三奉請・
  三唱礼/三身礼の二者択一は、スキーマ変更を避けるため差定を2種類
  (`nichijo-gongyo-shibujo`/`nichijo-gongyo-sanbujo`、既定は三奉請・三身礼版)に分けて用意。
  読み(ruby)は開発者(僧侶)による直接の点検・修正を複数回経て確定させた。
  十念は10回中9回目のみ「なむあみだぶつ」と読む仕様(`counterRubyOverrides`)にも対応。
- **差定プリセット選択UI・編集操作完了**: `docs/saijo-spec.md`が規定する「複製→編集」の
  動線を実装。プリセット選択画面、複製した差定の並べ替え・オンオフ・回数指定編集、
  localStorageへの永続化(spec原案のIndexedDBから変更)に対応。
- **GitHub Pages公開完了**: リポジトリをパブリック化し、
  https://letticia.github.io/gotou/ で公開中。`main`へのpush毎にActions経由で自動デプロイ。
  ダミーfixtureデータとPD勤行テキストのみを公開しており、実データ・許諾が絡む記述は
  Git履歴からも削除済み(`docs/plan-2026-07.html`は完全削除、`docs/handoff.md`旧版の
  該当箇所も現行版からは削除)。プロトタイプ注記バナー・`noindex`メタタグで
  非公式・開発中であることを明示している。
- GitHub Actions(`.github/workflows/ci.yml`)でfactory pytest・app vitest/buildの検証と
  Pagesデプロイをpush時に自動実行するようにした。
- 辞書データの利用許諾は未取得。よって実データは一切公開しない(CLAUDE.mdの掟)。
  appはダミーfixtureから`app/scripts/build-dummy-db.mjs`(factory側`build_sqlite.py`を
  呼び出す)で作った非公開の開発用SQLiteのみを使っている。

## 決定事項サマリ

- **技術**: TypeScript/React のPWA。辞書DBは **`@sqlite.org/sqlite-wasm`**
  (sql.jsは標準ビルドがFTS5を含まずshared/schema.sqlのentries_ftsが作れないため不採用)。
  GitHub Pages + Actionsで配信中(base pathは`VITE_BASE_PATH`環境変数で切替、
  既定は`/`のまま)。将来Capacitorでのストア展開も見据え、Service Worker等は
  素のWeb標準APIで実装している。
- **検索**: 読みのインクリメンタル・前方一致が主役。異体字は shared/variants.json で吸収。
  実装済み。音声入力(kuromoji.jsで読みに戻す)とカメラOCR(収録語スキャン)は未着手。
- **勤行モード**: 差定をプレイリストとして扱う(docs/saijo-spec.md)。日常勤行式一式・
  プリセット選択/編集(並べ替え・オンオフ・回数指定)まで実装済み。回転ロック、
  テンポ式オートスクロール・縦書きモード(v1.5)は未着手。他の法要用テキストは
  開発者による原文収集待ち。
- **データ取得〜表示の一気通貫**: factoryのwikitext→HTML変換をそのままappが表示する構成に
  統一済み(TS側での簡易再パースはしていない)。
- **計測**: Plausible/Umami 系、未着手。
- **公開範囲**: リポジトリはパブリック。ただし許諾交渉に関わる記述はコミット・履歴の
  両方から意図的に除外している(下記「連絡・確認の掟」参照)。
- **モデル運用**: 実装はSonnet。設計はプランモードで計画してから着手(本セッションで一貫)。

## 次にやるタスク(候補、優先度は未確定)

- 計測導入(Plausible/Umami、IndexedDBキュー)
- 音声入力(キーボード標準マイク + kuromoji.jsで読みに戻すパイプライン)
- カメラOCR、Capacitor化は許諾状況・優先度次第で後続
- 差定のJSON書き出し・QRコード共有(僧侶が檀信徒に配る経路。saijo-spec.mdが想定)

## 未決・保留(開発者側タスク含む)

- 勤行テキスト原文の収集(日常勤行式は収録済み。法要等の特殊な次第は未)
- 音声入力・カメラOCRの実装時期
- 実データ配信サーバーの選定
- 「ごとうさん」マスコットの正式アイコン素材(現在は仮の提灯アイコン)

## 連絡・確認の掟

宗門の慣習(差定の組み替え、勤行の作法など)に関わる仕様判断は推測しない。
開発者は当事者(僧侶)なので、直接質問するのが最短である。

リポジトリはパブリックだが、浄土宗総合研究所への許諾打診・商標確認等、交渉に
関わる具体的な記述は外部から見える形で残さない方針(コミットメッセージ・
ドキュメントとも)。この文書や関連ファイルを編集する際は、交渉の進め方や
戦略に関する記述を書き足さないよう注意する。

## 作業時の注意(教訓)

- `factory/src/build_sqlite.py` などfactoryのスクリプトは、引数を省略すると
  `factory/cache/`(実データ)をデフォルトで読む。ダミーfixtureで作業する際は
  `--source fixtures` を必ず明示し、実行後は `git status --ignored` で
  `factory/output/`・`factory/cache/`・`app/public/` に実データ由来のファイルが
  紛れ込んでいないか確認すること。
- 勤行テキストの読み(ruby)は、参考にした公式PDF等をそのまま複製せず自前で
  付与する方針(docs/saijo-spec.md)。ただし開発者から「このPDFは参照用途として
  使ってよい」と明示された場合はPDFの内容と直接照合してよい。読みの正誤は
  開発者(僧侶)にしか判断できないため、確信が持てない箇所は都度確認すること。
