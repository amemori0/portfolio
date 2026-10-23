# Shuri Amemori Portfolio

雨森 守浬のポートフォリオサイトです。

- サイト: https://amemori-portfolio.pages.dev/
- 技術: Astro / TypeScript / CSS / Cloudflare Pages

## 作品を追加・更新する

1. `scripts/capture.mjs` の `TARGETS` に作品のURLを足し、`npm run capture <slug>` でスクリーンショットを撮る
2. `src/content/works/<slug>.md` を作る(項目は `src/content.config.ts` のスキーマを参照)
3. `npm run build` が通ることを確認して push する(Cloudflare Pages が自動で公開する)

## 開発

```bash
npm install
npm run dev          # 開発サーバー
npm run check        # 型チェック
npm test             # ユニットテスト
npm run build && npm run check:links   # ビルドと内部リンクの検査
npm run preview & npm run smoke        # 表示の検査(テーマ切替・横スクロール)
```
