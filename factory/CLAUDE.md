# factory — Pythonデータ工場

MediaWiki(浄土宗大辞典)から項目を取得し、`shared/schema.sql` に従うSQLiteと
macOS向け .Dictionary を生成する。既存の取得スクリプトが出発点。

## 掟

- 取得はMediaWiki APIを優先。**1リクエスト/秒以下**にスロットルし、User-Agentに
  連絡先を明記する。取得結果は必ずローカルキャッシュし、再実行時はキャッシュを使う。
- 生成物・キャッシュはすべて `output/` と `cache/` に置く(どちらも .gitignore 済み)。
  それ以外の場所に実データを書き出さない。
- テスト・CIで実データを使わない。`tests/fixtures/` のダミー項目(約100件)だけを使う。
- **外部ライブラリを使い始めたら必ず `requirements.txt` に足す。** 手元のPython環境に
  たまたま入っていると気づかずに通ってしまい、CIだけが落ちる
  (beautifulsoup4で実際に踏んだ)。確かめるなら使い捨ての仮想環境で
  `pip install -r requirements-dev.txt` してから `pytest` を回すこと。

## 変換の方針

- 読みは DEFAULTSORT を第一ソースとし、無い項目は保留リストに出力して人間が確認する。
- `search_key` は `shared/variants.json` による正規化(NFKC+異体字変換)で生成する。
  正規化ロジックを factory 内に直書きしない。
- 項目間リンク([[...]])を抽出して links テーブルに落とす。リンク切れは警告として集計する。
- スキーマ変更が必要になったら、まず `shared/schema.sql` を直し、app側の追随が必要な旨を明示する。
