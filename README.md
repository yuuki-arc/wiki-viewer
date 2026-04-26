# wiki-viewer

任意ディレクトリの Markdown 群に、レイアウトとデザインを適用してローカル閲覧する小さな Eleventy (11ty) プロジェクト。

- **静的サイトビルド**: Eleventy v3 で `_site/` に HTML を吐く
- **ライブリロード**: ファイル保存 → ブラウザ自動更新（Eleventy 標準）
- **テーマ切替**: 5 種のカラーテーマ（localStorage 保存）
- **対象ディレクトリ非破壊**: ソースには一切書き込まない
- **依存最小**: `@11ty/eleventy` 1 つだけ

動的なソース切替や wikilink / callout が必要な場合は姉妹プロジェクト [md-live-viewer](https://github.com/yuuki-arc/md-live-viewer) を参照。

## セットアップ

```bash
git clone <this-repo-url> wiki-viewer
cd wiki-viewer
npm install
cp config.example.json config.json
# config.json を編集して、対象 Markdown ディレクトリの絶対パスを記入
npm run dev
```

`http://localhost:8080/` をブラウザで開く。

`config.json` はマシン固有の絶対パスを含むため `.gitignore` 対象。リポジトリには `config.example.json` をテンプレートとして同梱している。

### 静的ビルド（サーバを立てず成果物だけ生成）

```bash
npm run build
```

`_site/` に HTML を書き出す。任意の静的サーバで配信すれば live-reload なしの閲覧が可能。

## ソースの変更

`config.json` の `vault` キーを書き換えて dev server を再起動:

```json
{
  "vault": "/絶対/パス/markdown/dir"
}
```

複数ソースを画面から切り替えたい場合は md-live-viewer 側を使う（wiki-viewer は単一ソース固定）。

## アーキテクチャ

```
.md ──> Eleventy ──> _site/*.html ──> dev server (:8080)
            │
            ├─ markdown-it（Eleventy 内蔵）
            ├─ addPreprocessor ── 除外ルール適用
            ├─ addTransform ──── _includes/base.html で wrap
            ├─ addPassthroughCopy ── _attachments/ をコピー
            └─ eleventy.after ── root index (ツリー) を生成
```

- **ページ生成**: 各 `.md` を markdown-it で HTML に変換、`addTransform` で `_includes/base.html` のテンプレートに包む
- **ルートインデックス**: `eleventy.after` フックで全 URL を収集、フォルダ階層をネストした `<ul class="tree">` として `_site/index.html` を生成
- **ライブリロード**: Eleventy 標準の `--serve` モードがファイル監視 + WebSocket 経由でブラウザを再読込

## ディレクトリ構成

```
wiki-viewer/
├── .eleventy.js          # Eleventy 設定（config.json から vault を読込）
├── config.json           # vault パス（gitignore 対象）
├── config.example.json   # config.json のテンプレート
├── _includes/
│   └── base.html         # HTML テンプレート（{{title}}/{{content}}）
├── assets/
│   └── css/              # _base.css + 5 テーマ
├── _site/                # ビルド出力（gitignore 対象、再生成される）
└── package.json
```

## 除外ルール

`config.json` の `excludedDirs` / `excludedFiles` で指定する。デフォルトは `.git` のみ：

```json
{
  "vault": "...",
  "excludedDirs": [".git"],
  "excludedFiles": []
}
```

- `excludedDirs`: vault 直下に該当名のディレクトリがあれば、その配下を一切インデックスしない（basename 一致）
- `excludedFiles`: vault 直下のファイル名（`vault/CLAUDE.md` 等）を除外。subdir 配下は対象外

未指定なら `excludedDirs: [".git"]`、`excludedFiles: []` が適用される。

## 将来の拡張

- `markdown-it-wikilinks` プラグイン追加で `[[ノート名]]` を有効化
- `markdown-it-container` 等で callout (`> [!note]`) を有効化
- Cloudflare Pages / GitHub Pages へのデプロイ
- 全文検索（Pagefind 等）

## テーマ

5 種のカラーテーマ（`assets/css/` 配下）:

- `petal-rose.css` (default)
- `cream-terracotta.css`
- `mint-sage.css`
- `mist-blue.css`
- `lilac-plum.css`

footer の Theme select で切替、localStorage キー `wiki-viewer-theme` に保存。

## ポート

デフォルト 8080。`.eleventy.js` の `setServerOptions({ port: 8080 })` で変更可能。

## 依存

- [Eleventy](https://www.11ty.dev/) — 静的サイトジェネレータ。markdown-it を内蔵
