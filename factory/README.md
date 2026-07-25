# factory — セットアップと使い方

守るべき掟は [CLAUDE.md](CLAUDE.md) を参照。ここは実行手順のメモ。

## セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## DDK (Dictionary Development Kit)

`build_apple_dict.py` は macOS 辞書バンドル (.dictionary) のコンパイルに Apple の DDK
(`build_dict.sh`) を使う。DDK は Apple Inc. の著作物のためこのリポジトリには含めない。

1. Apple Developer の「Additional Tools for Xcode」から Dictionary Development Kit を入手する。
2. `factory/tools/DDK/Dictionary-Development-Kit-master/bin/build_dict.sh` に展開するか、
   環境変数 `DDK_BIN` で `build_dict.sh` のパスを直接指定する。

`factory/tools/` は `.gitignore` 済み。

## スクリプト

- `src/wikitext.py` … wikitext→HTML変換・読み抽出・リンク解決の共通ロジック(下記2つから利用)
- `src/fetch_articles.py` … MediaWiki APIから全記事を取得し `cache/articles.json` に保存(再実行時は既存キャッシュに追記)
- `src/fetch_images.py` … 記事内画像を取得し `cache/images/` に保存
- `src/build_apple_dict.py` … `cache/` の記事・画像から `output/build/` にXML/CSS/plistを生成し、DDKで `.dictionary` をコンパイル
- `src/build_sqlite.py` … `cache/` の記事から `shared/schema.sql` 準拠の `output/gotou.sqlite3` を生成。読み欠落は `output/pending_readings.txt`、リンク切れは `output/broken_links.txt` に出力

生成物・キャッシュは `output/` と `cache/` に置く(どちらも `.gitignore` 済み)。それ以外の場所に実データを書き出さない。

## テスト

テスト・CIでは実データを使わない。`tests/fixtures/articles.json` の自作ダミー100件だけを使う。

```bash
pip install -r requirements-dev.txt

# fixtureの(再)生成。決定論的なので再実行しても内容は変わらない
python3 tests/generate_fixtures.py

# テスト実行
python3 -m pytest -v
```
