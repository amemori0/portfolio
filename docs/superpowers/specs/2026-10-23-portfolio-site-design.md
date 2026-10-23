# ポートフォリオサイト 設計書

作成: 2026-10-23 / 実装: Claude Code(ユーザーはコードを書かない。文章・見た目の確認と公開判断を担当)

## 目的

就活の応募書類に載せる、作品をまとめたサイト。採用担当者がひと目で作品の中身を把握でき、詳細ページで「実装→理由→効果」を読める状態にする。作品の追加・更新を続ける前提で、長く使える構成にする。

## 掲載する作品

| 作品 | 状態 | リンク |
|---|---|---|
| TETOTE | 公開中 | デモ https://tetote-997.pages.dev/ / GitHub amemori0/TETOTE-portfolio |
| daymaga | 公開中 | デモ https://daymaga.pages.dev/ / GitHub amemori0/daymaga-portfolio |
| flow-meister | 制作中 | なし(リポジトリ非公開のため。公開後にリンクを足す) |

## 技術構成

- Astro 7.3.8(静的出力)+ TypeScript(strict)
- CSSは素のCSS。UIフレームワーク・CSSフレームワークは使わない
- 作品データは Content Collections(1作品1 Markdown、frontmatterをスキーマで検証)
- スクリーンショット撮影は Playwright のスクリプト
- 公開は Cloudflare Pages(GitHubリポジトリ連携でpush時に自動公開)
- 場所: `C:\Users\syuri\dev\portfolio-site`

## ページ構成

- `/` トップ
  1. ヒーロー: 名前「雨森 守浬 / Shuri Amemori」と一言の紹介(`dev/docs/portfolio-strategy.md` の30秒版をもとに下書き)
  2. 作品一覧: カードを並べる(PCは3列、狭い画面では1〜2列)。カードはモックアップ画像・状態ラベル・タイトル・概要・技術タグ
  3. 自己紹介とスキル
  4. お問い合わせフォーム
- `/works/<slug>/` 作品詳細: PC+スマホのモックアップ、目的、担当範囲、使った技術、工夫した点(実装→理由→効果)、デモ・GitHubへのリンク(あるものだけ)
- `/404`

ヘッダー: サイト名(名前)、ナビ(Works / About / Contact)、ライト/ダークのトグル。参考サイト TAKLOG(https://www.tak-dcxi.com/)の、白黒基調・色数の少なさ・トグルスイッチ・カードグリッドの雰囲気に寄せる。

## 作品データ(Content Collections)

`src/content/works/<slug>.md`。frontmatter:

| 項目 | 型 | 必須 | 内容 |
|---|---|---|---|
| title | string | ○ | 作品名 |
| status | `"published"` \| `"in-progress"` | ○ | 表示ラベル「公開中」「制作中」 |
| summary | string | ○ | カードと詳細の冒頭に出す1〜2文 |
| role | string | ○ | 担当範囲 |
| tech | string[] | ○ | 技術タグ |
| order | number | ○ | 一覧の並び順(小さいほど先) |
| links.demo | URL | − | デモURL |
| links.repo | URL | − | GitHub URL |
| images.desktop | image | ○ | PCのスクリーンショット |
| images.mobile | image | ○ | スマホのスクリーンショット |

本文(Markdown)は詳細ページの「目的」「工夫した点」などの見出しと文章。READMEに書いてある内容だけを使い、READMEにない実績は書かない。

作品の追加手順: スクリーンショットを撮る → Markdownを1つ足す → push。

## デバイスモックアップ

- ノートPCとスマホの枠はCSSで描き、中に `<Image>`(astro:assets)でスクリーンショットをはめる。WebPに変換し、表示サイズに合わせた `srcset` を出す
- 一覧ではPCとスマホを重ねた1つの図、詳細では大きく表示
- 画像の `alt` は「TETOTEのトップページをPCで表示した画面」のように、何の画面かを書く
- 撮影: `npm run capture` で Playwright が各作品の公開URLを開き、PC 1440×900 / スマホ 390×844 で撮って `src/assets/works/<slug>/` に保存する。撮影対象のURLはスクリプト内の一覧で管理する
- flow-meister はローカルで起動した画面のURLを指定して撮る

## ライト/ダークモード

- 初期値はOSの設定(`prefers-color-scheme`)。トグルで切り替えたら `localStorage` に保存する(読み書きは try/catch で囲み、使えない環境でもOSの設定で表示する)
- `<html data-theme="light|dark">` と `color-scheme` で切り替え、色は `light-dark()` で定義する
- 表示のちらつきを防ぐため、`<head>` 内のインラインスクリプトで描画前に `data-theme` を決める
- トグルは `<button aria-pressed>` + `aria-label`。太陽/月のアイコンは装飾なので `aria-hidden="true"`

## お問い合わせ

- Formspree に新しいフォーム(「ポートフォリオ お問い合わせ」)を作る。受信先は amemori.sy@gmail.com
- `<form action="https://formspree.io/f/..." method="POST">` の普通のフォームとして作り、JSなしでも送れるようにする
- JSが動く場合は `fetch` で送り、ページ内に結果を `role="status"` / `role="alert"` で表示する
- 項目: お名前、メールアドレス、お問い合わせ内容(すべて必須)。バリデーション表示は `:user-invalid` + `aria-invalid` + `aria-describedby`

## CSS・アクセシビリティ(`第2の脳/base/frontend.md` に従う)

- セレクタはフラット、状態は data 属性、余白は論理プロパティ、カスタムプロパティ活用(内部用は `--_`)
- `font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif;`(`system-ui` は使わない)
- `body { overflow-wrap: anywhere; word-break: normal; line-break: strict; }`
- サイズは `clamp()` 中心、ビューポート単位は `svi` 系
- カードは `article` + `aria-labelledby`、一覧の `ul` は `role="list"`、`:focus-visible` を必ず付ける、クリック領域44px以上
- ホバー演出は `@media (any-hover: hover)`、モーションは `prefers-reduced-motion` で抑える
- 名前のローマ字表記に `translate="no"`、本文の最大幅は `min(40em, 65ch, 100%)` のような指定

## 公開

1. GitHubに `amemori0/portfolio` を作る(公開リポジトリ)。作成・pushの前にユーザーへ確認する
2. Cloudflare Pages でGitHub連携のプロジェクトを作る(ビルドコマンド `npm run build`、出力 `dist`)。連携時のGitHubアプリの許可はユーザーが行う
3. 以後は push で自動公開

## 確認方法(完了条件)

- `astro check` とビルドが警告なしで通る
- ビルド結果の全ページと内部リンクが200で返る
- Chromeで、ライト/ダーク両方の表示、キーボードだけでの操作、フォーカスの見え方、スマホ幅(390px)の表示を確認する
- フォームはJSあり・なしの両方で送信できる(テスト送信はユーザーの許可を取ってから)

## やらないこと

- ブログ機能、検索、多言語化
- 人気順など、外部サービスのデータを使う動的機能
- flow-meister のリポジトリ公開・README整備(このサイトの範囲外)
