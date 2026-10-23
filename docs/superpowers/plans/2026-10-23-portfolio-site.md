# ポートフォリオサイト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TETOTE・daymaga・flow-meister(制作中)を、PC/スマホのモックアップ付きで見せる Astro 製ポートフォリオサイトを作り、Cloudflare Pages に公開する。

**Architecture:** Astro の静的出力。作品は Content Collections(`src/content/works/*.md`)で管理し、トップの一覧と `/works/<slug>/` の詳細ページを生成する。CSS は素の CSS(コンポーネント単位の scoped style + `src/styles/global.css`)。ライト/ダークは `data-theme` と `light-dark()`。

**Tech Stack:** Astro 7.3.8 / TypeScript strict / Vitest / Playwright / Formspree / Cloudflare Pages

設計書: `docs/superpowers/specs/2026-10-23-portfolio-site-design.md`

## Global Constraints

- 場所: `C:\Users\syuri\dev\portfolio-site`。パッケージマネージャは npm
- Astro は `7.3.8` に固定する(`^` を付けない)
- CSS は `第2の脳/base/frontend.md` に従う: フラットなセレクタ、状態は data 属性、余白は論理プロパティ、`position` は物理プロパティ、内部用変数は `--_`、`system-ui` を使わない
- `font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif;`
- 名前の表記は「雨森 守浬」/「Shuri Amemori」。ローマ字には `translate="no"`
- 文章は README と `dev/docs/portfolio-strategy.md` にある事実だけを使う。NG表現リスト(`第2の脳/base/ng-expressions.md`)に従う
- README に「AIが実装した」旨は書かない(ユーザー指示)
- コミットに `Co-Authored-By: Claude` を付けない(ユーザーのmemory方針)
- GitHub へのリポジトリ作成・push、Cloudflare への公開、フォームのテスト送信は、実行前にユーザーへ確認する

---

## File Structure

| ファイル | 役割 |
|---|---|
| `package.json` / `astro.config.mjs` / `tsconfig.json` / `.gitignore` | 設定 |
| `src/content.config.ts` | works コレクションのスキーマ |
| `src/content/works/{tetote,daymaga,flow-meister}.md` | 作品データと詳細ページ本文 |
| `src/assets/works/<slug>/{desktop,mobile}.png` | スクリーンショット(capture スクリプトで生成) |
| `src/lib/works.ts` | 並び替え・状態ラベル(純粋関数。Vitest で検証) |
| `src/lib/works.test.ts` | 上記のテスト |
| `src/styles/global.css` | リセット・色トークン・タイポグラフィ・共通クラス |
| `src/layouts/BaseLayout.astro` | `<head>`、テーマ初期化スクリプト、ヘッダー、フッター |
| `src/components/Header.astro` | サイト名・ナビ・トグル |
| `src/components/ThemeToggle.astro` | ライト/ダーク切り替え |
| `src/components/Footer.astro` | フッター |
| `src/components/DeviceMockup.astro` | CSSで描いたPC+スマホ枠にスクリーンショットをはめる |
| `src/components/WorkCard.astro` | 一覧のカード |
| `src/components/StatusBadge.astro` | 「公開中」「制作中」ラベル |
| `src/components/ContactForm.astro` | Formspree フォーム |
| `src/pages/index.astro` | トップ |
| `src/pages/works/[slug].astro` | 作品詳細 |
| `src/pages/404.astro` | 404 |
| `public/favicon.svg` | ファビコン |
| `scripts/capture.mjs` | Playwright でスクリーンショットを撮る |
| `scripts/check-links.mjs` | `dist/` の内部リンク切れ検査 |
| `scripts/smoke.mjs` | Playwright でテーマ切替・横スクロール・コンソールエラーを検査 |
| `README.md` | リポジトリ説明・作品の追加手順 |

---

### Task 1: プロジェクトの土台と作品ロジック

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `src/lib/works.ts`, `src/lib/works.test.ts`

**Interfaces:**
- Produces: `sortWorks<T extends { data: { order: number } }>(works: T[]): T[]`(order 昇順、元の配列は変えない) / `statusLabel(status: WorkStatus): string` / `type WorkStatus = "published" | "in-progress"`

- [ ] **Step 1: 設定ファイルを作る**

`package.json`:
```json
{
  "name": "portfolio-site",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "capture": "node scripts/capture.mjs",
    "check:links": "node scripts/check-links.mjs",
    "smoke": "node scripts/smoke.mjs"
  }
}
```

依存の追加:
```bash
npm install astro@7.3.8
npm install -D @astrojs/check typescript vitest playwright
npx playwright install chromium
```

`astro.config.mjs`:
```js
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://amemori-portfolio.pages.dev",
  trailingSlash: "always",
  build: { format: "directory" },
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`.gitignore`:
```
node_modules/
dist/
.astro/
.env
```

- [ ] **Step 2: 失敗するテストを書く** — `src/lib/works.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { sortWorks, statusLabel } from "./works";

describe("sortWorks", () => {
  it("order の小さい順に並べ、元の配列は変えない", () => {
    const input = [{ data: { order: 3 } }, { data: { order: 1 } }, { data: { order: 2 } }];
    const result = sortWorks(input);
    expect(result.map(work => work.data.order)).toEqual([1, 2, 3]);
    expect(input.map(work => work.data.order)).toEqual([3, 1, 2]);
  });
});

describe("statusLabel", () => {
  it("状態を日本語のラベルにする", () => {
    expect(statusLabel("published")).toBe("公開中");
    expect(statusLabel("in-progress")).toBe("制作中");
  });
});
```

- [ ] **Step 3: 失敗を確認** — `npm test` → `Failed to resolve import "./works"` で FAIL

- [ ] **Step 4: 実装** — `src/lib/works.ts`

```ts
export type WorkStatus = "published" | "in-progress";

const STATUS_LABELS: Record<WorkStatus, string> = {
  published: "公開中",
  "in-progress": "制作中",
};

export const statusLabel = (status: WorkStatus): string => STATUS_LABELS[status];

export const sortWorks = <T extends { data: { order: number } }>(works: T[]): T[] => [...works].sort((a, b) => a.data.order - b.data.order);
```

- [ ] **Step 5: 成功を確認** — `npm test` → 2 tests PASS

- [ ] **Step 6: コミット**
```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore src/lib
git commit -m "chore: Astroプロジェクトの土台と作品の並び替えロジックを追加"
```

---

### Task 2: スクリーンショット撮影スクリプトと画像の用意

**Files:**
- Create: `scripts/capture.mjs`, `src/assets/works/{tetote,daymaga,flow-meister}/{desktop,mobile}.png`

**Interfaces:**
- Produces: 各作品の `desktop.png`(1440×900)と `mobile.png`(780×1688 = 390×844 の2倍解像度)

- [ ] **Step 1: スクリプトを書く** — `scripts/capture.mjs`

```js
// 作品のスクリーンショットを撮る。使い方: npm run capture [slug ...](省略時は全作品)
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const TARGETS = {
  tetote: "https://tetote-997.pages.dev/",
  daymaga: "https://daymaga.pages.dev/",
  // flow-meister は非公開のため、ローカルで `npm run dev` してから撮る
  "flow-meister": "http://localhost:3000/",
};

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const slugs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(TARGETS);
const browser = await chromium.launch();

try {
  for (const slug of slugs) {
    const url = TARGETS[slug];
    if (!url) throw new Error(`Unknown slug: ${slug}`);
    const dir = new URL(`../src/assets/works/${slug}/`, import.meta.url);
    await mkdir(dir, { recursive: true });

    for (const [name, options] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ ...options, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      // 遅延読み込みの画像やフェードイン演出が終わるのを待つ
      await page.waitForTimeout(1500);
      await page.screenshot({ path: new URL(`${name}.png`, dir) });
      await context.close();
      console.log(`captured ${slug}/${name}.png`);
    }
  }
} finally {
  await browser.close();
}
```

- [ ] **Step 2: 公開中の2作品を撮る** — `npm run capture tetote daymaga` → `captured tetote/desktop.png` など4行

- [ ] **Step 3: flow-meister を撮る**
```bash
cd C:\Users\syuri\dev\advance\flow-meister && npm run dev   # 別シェルで起動しておく
npm run capture flow-meister
```
撮れたら flow-meister の開発サーバーを止める。

- [ ] **Step 4: 画像を目で確認する** — 6枚を Read で開き、読み込み途中の白画面やモーダルが写っていないか確認。写っていれば `waitForTimeout` を延ばして撮り直す

- [ ] **Step 5: コミット**
```bash
git add scripts/capture.mjs src/assets/works
git commit -m "feat: 作品スクリーンショットの撮影スクリプトと画像を追加"
```

---

### Task 3: 作品コレクションと作品データ

**Files:**
- Create: `src/content.config.ts`, `src/content/works/tetote.md`, `src/content/works/daymaga.md`, `src/content/works/flow-meister.md`

**Interfaces:**
- Produces: コレクション名 `works`。`entry.id` が slug。`entry.data` は `{ title: string; status: WorkStatus; summary: string; role: string; tech: string[]; order: number; links: { demo?: string; repo?: string }; images: { desktop: ImageMetadata; mobile: ImageMetadata } }`

- [ ] **Step 1: スキーマを書く** — `src/content.config.ts`

```ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      status: z.enum(["published", "in-progress"]),
      summary: z.string(),
      role: z.string(),
      tech: z.array(z.string()).min(1),
      order: z.number().int(),
      links: z
        .object({
          demo: z.string().url().optional(),
          repo: z.string().url().optional(),
        })
        .default({}),
      images: z.object({
        desktop: image(),
        mobile: image(),
      }),
    }),
});

export const collections = { works };
```

- [ ] **Step 2: 作品データを書く**

`src/content/works/tetote.md`:
```md
---
title: TETOTE 採用特設サイト
status: published
summary: 架空企業の採用特設サイトを、デザインカンプをもとにWordPressのオリジナルテーマとして実装しました。動きのある表現とアクセシビリティの両立がテーマです。
role: コーディング、WordPressオリジナルテーマ化(デザインカンプをもとにした課題制作)
tech: [HTML, SCSS(FLOCSS + BEM), JavaScript, PHP, WordPress, GSAP, Swiper.js, Vite]
order: 1
links:
  demo: https://tetote-997.pages.dev/
  repo: https://github.com/amemori0/TETOTE-portfolio
images:
  desktop: ../../assets/works/tetote/desktop.png
  mobile: ../../assets/works/tetote/mobile.png
---

## 目的

企業のコーポレートサイトとは切り離した採用特設サイトとして、求職者に働く人と社風の魅力を伝えることを目的にしたサイトです。WordPressのオリジナルテーマとして本格的に取り組んだ1作品目です。

## 工夫した点

### 強制カラーモードでも選択状態が見えるフォーム

- **実装**: Contact Form 7 のラジオボタンとチェックボックスをデザインに合わせてカスタムし、`forced-colors` メディアクエリで強制カラーモード用のスタイルを別に定義しました。
- **理由**: 擬似要素で選択状態を描くカスタムUIは、Windowsのハイコントラストモードで配色が無効になり、選択状態が見えなくなるためです。
- **効果**: 通常はデザインカンプどおりの見た目を保ちつつ、強制カラーモードでも選択状態を判別できます。

### コンポーネントに幅を持たせない設計

- **実装**: component層(`c-*`)には幅や外側の余白を持たせず、幅の決定を project層(`p-*`)に任せました。
- **理由**: コンポーネント自身が幅を持つと、別の場所に置いたときに意図しない幅が引き継がれてレイアウトが崩れるためです。
- **効果**: 同じカードを一覧とスライダーのように幅の違う場所で使い回せ、上書きの打ち消しが要らなくなりました。

### ファーストビュー画像の読み込み優先度

- **実装**: メインビジュアルを `<img>` で置き、`fetchpriority="high"` を付けました。
- **理由**: 最初に表示される大きな画像は、ページの表示速度の指標(LCP)に直結するためです。
- **効果**: メインビジュアルの画像を、ほかの画像より先に読み込ませています。
```

`src/content/works/daymaga.md`:
```md
---
title: デイマガ(DayMaga)
status: published
summary: コンサル案件やノウハウを発信するオウンドメディア型のブログサイトです。記事が日々追加される前提で、運用する人が壊しにくいテーマ設計に取り組みました。
role: コーディング、WordPressオリジナルテーマ開発
tech: [HTML, SCSS(FLOCSS + BEM), JavaScript, PHP, WordPress, Advanced Custom Fields, Swiper.js, Vite]
order: 2
links:
  demo: https://daymaga.pages.dev/
  repo: https://github.com/amemori0/daymaga-portfolio
images:
  desktop: ../../assets/works/daymaga/desktop.png
  mobile: ../../assets/works/daymaga/mobile.png
---

## 目的

CMSとして記事が日々追加・編集される前提で、運用者が壊しにくく、拡張しやすいテーマを作ることを目的にしました。TETOTEで身につけたコンポーネント設計とアクセシビリティの型を土台にした2作品目です。

## 工夫した点

### 本文からの目次自動生成

- **実装**: `the_content` フィルターで本文の h3 / h4 に id を自動で付け、同じ本文から見出しを抜き出して階層付きの目次を出力しています。
- **理由**: 執筆者が管理画面で見出しを自由に増減するため、目次を手で書く運用では本文とのズレが必ず起きるためです。
- **効果**: 手入力なしで目次と本文が常に一致し、執筆者の手間と表示崩れの両方をなくしました。

### 記事カードを1つの部品にまとめる引数設計

- **実装**: 記事カードを `get_template_part()` の共通パーツ1つにまとめ、ラッパーのタグやバリエーションを呼び出し側から引数で渡す形にしました。タグ名はホワイトリストで検証しています。
- **理由**: 記事カードはトップのスライダー・新着・人気・各一覧と登場箇所が多く、コピーを増やすとデザイン変更時の修正漏れが起きるためです。
- **効果**: カードの修正が `card.php` 1ファイルで完結するようになりました。

### 一覧ごとのクエリの使い分け

- **実装**: 一覧の表示件数と並び順は `pre_get_posts` で制御し、メイン以外の一覧は `WP_Query` で個別に取得しています。
- **理由**: CSSで件数を隠す方法では、ページネーションの計算と実際の表示がズレるためです。
- **効果**: ページネーションが常に正しく動き、どの一覧がどこで制御されているかがコードで追えるようになりました。

## 静的版での制限

デモサイトはWordPressから静的HTMLに書き出したものです。PHPで並べ替える「人気順」は、WordPress上でのみ動作します。
```

`src/content/works/flow-meister.md`:
```md
---
title: FLOW MEISTER
status: in-progress
summary: Next.js(App Router)と TypeScript で制作中のコーポレートサイトです。ニュース一覧・詳細やお問い合わせフォームまでを実装しています。
role: コーディング(スクール課題)
tech: [Next.js(App Router), TypeScript, CSS Modules, Swiper]
order: 3
images:
  desktop: ../../assets/works/flow-meister/desktop.png
  mobile: ../../assets/works/flow-meister/mobile.png
---

## 目的

WordPressでの制作から、React / Next.js でのWebアプリ開発へ領域を広げるために取り組んでいる作品です。

## 現在の実装範囲

- ニュースの一覧・カテゴリ別一覧・ページネーション・詳細ページ
- お問い合わせフォームと送信完了ページ
- 環境変数による設定の切り替え

## 開発の進め方

機能ごとに Issue・ブランチ・プルリクエストを分けて開発しています。

公開の準備ができたら、デモとリポジトリへのリンクを追加します。
```

- [ ] **Step 3: 型生成と検証** — `npx astro sync` → エラーなし。わざと `tetote.md` の `order` を消して `npx astro sync` が `order: Required` で失敗することを確認し、元に戻す

- [ ] **Step 4: コミット**
```bash
git add src/content.config.ts src/content
git commit -m "feat: 作品コレクションのスキーマと3作品のデータを追加"
```

---

### Task 4: レイアウト・グローバルCSS・ライト/ダーク切り替え

**Files:**
- Create: `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/Header.astro`, `src/components/ThemeToggle.astro`, `src/components/Footer.astro`, `public/favicon.svg`, `src/pages/404.astro`

**Interfaces:**
- Produces: `<BaseLayout title: string; description?: string>`(slot が `<main>` の中身)。CSS変数 `--color-bg` `--color-surface` `--color-text` `--color-muted` `--color-border` `--color-accent` `--content-width` `--space-section` `--radius` `--focus-ring`。共通クラス `.l-container` `.u-sr-only`

- [ ] **Step 1: `src/styles/global.css`**

```css
@layer reset, base, utilities;

@layer reset {
  :where(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :where(body, h1, h2, h3, h4, p, figure, ul, ol, dl, dd) {
    margin: 0;
  }

  :where(ul[role="list"], ol[role="list"]) {
    padding: 0;
    list-style: none;
  }

  :where(img, svg, picture) {
    display: block;
    max-inline-size: 100%;
    block-size: auto;
  }

  :where(button, input, textarea) {
    font: inherit;
    color: inherit;
  }
}

@layer base {
  :root {
    color-scheme: light dark;

    --color-bg: light-dark(#fafafa, #161616);
    --color-surface: light-dark(#ffffff, #1f1f1f);
    --color-text: light-dark(#1a1a1a, #ececec);
    --color-muted: light-dark(#5c5c5c, #a8a8a8);
    --color-border: light-dark(#dcdcdc, #3a3a3a);
    --color-accent: light-dark(#b35c00, #4fd1c5);
    --color-device: light-dark(#2b2b2b, #0c0c0c);
    --focus-ring: 2px solid var(--color-accent);

    --content-width: min(1120px, 100% - 2 * clamp(16px, 4svi, 40px));
    --space-section: clamp(64px, 10svi, 120px);
    --radius: 8px;
    --leading-trim: calc((1em - 1lh) / 2);

    font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif;
    line-height: calc(28 / 16);
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  :root[data-theme="light"] {
    color-scheme: light;
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
  }

  body {
    min-block-size: 100svb;
    background-color: var(--color-bg);
    color: var(--color-text);
    overflow-wrap: anywhere;
    word-break: normal;
    line-break: strict;
  }

  a {
    color: inherit;
    text-underline-offset: 0.2em;
  }

  :focus-visible {
    outline: var(--focus-ring);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer utilities {
  .l-container {
    inline-size: var(--content-width);
    margin-inline: auto;
  }

  .u-sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

- [ ] **Step 2: `src/components/ThemeToggle.astro`**

```astro
<button class="theme-toggle" type="button" aria-pressed="false" aria-label="ダークモード" data-theme-toggle>
  <span class="theme-toggle__track" aria-hidden="true">
    <span class="theme-toggle__knob">
      <svg class="theme-toggle__icon" data-icon="sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" focusable="false">
        <circle cx="12" cy="12" r="4"></circle>
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
      </svg>
      <svg class="theme-toggle__icon" data-icon="moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" focusable="false">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>
      </svg>
    </span>
  </span>
</button>

<script>
  const STORAGE_KEY = "theme";
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");

  const sync = () => {
    button?.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  };

  sync();
  button?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 保存できない環境でも、このページの表示だけは切り替える
    }
    sync();
  });
</script>

<style>
  .theme-toggle {
    display: grid;
    place-items: center;
    min-inline-size: 44px;
    min-block-size: 44px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .theme-toggle__track {
    display: flex;
    align-items: center;
    inline-size: 52px;
    block-size: 28px;
    padding: 3px;
    border-radius: 999px;
    background-color: var(--color-accent);
    transition: background-color 0.2s;
  }

  .theme-toggle__knob {
    display: grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    border-radius: 50%;
    background-color: var(--color-surface);
    color: var(--color-text);
    transition: translate 0.2s;
  }

  .theme-toggle[aria-pressed="true"] .theme-toggle__knob {
    translate: 24px 0;
  }

  .theme-toggle__icon {
    grid-area: 1 / 1;
  }

  .theme-toggle[aria-pressed="true"] .theme-toggle__icon[data-icon="sun"],
  .theme-toggle[aria-pressed="false"] .theme-toggle__icon[data-icon="moon"] {
    visibility: hidden;
  }

  @media (scripting: none) {
    .theme-toggle {
      display: none;
    }
  }
</style>
```

- [ ] **Step 3: `src/components/Header.astro`**

```astro
---
import ThemeToggle from "./ThemeToggle.astro";

const NAV = [
  { href: "/#works", label: "Works" },
  { href: "/#about", label: "About" },
  { href: "/#contact", label: "Contact" },
];
---

<header class="header">
  <div class="header__inner l-container">
    <a class="header__logo" href="/" translate="no">Shuri Amemori</a>
    <nav class="header__nav" aria-label="メイン">
      <ul class="header__list" role="list">
        {
          NAV.map(item => (
            <li>
              <a class="header__link" href={item.href}>
                {item.label}
              </a>
            </li>
          ))
        }
      </ul>
    </nav>
    <ThemeToggle />
  </div>
</header>

<style>
  .header {
    position: sticky;
    top: 0;
    z-index: 10;
    border-block-end: 1px solid var(--color-border);
    background-color: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(8px);
  }

  .header__inner {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2svi, 32px);
    min-block-size: 64px;
  }

  .header__logo {
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-decoration: none;
  }

  .header__nav {
    margin-inline-start: auto;
  }

  .header__list {
    display: flex;
    gap: clamp(4px, 1.5svi, 24px);
  }

  .header__link {
    display: grid;
    place-items: center;
    min-block-size: 44px;
    padding-inline: 8px;
    text-decoration: none;
  }

  @media (any-hover: hover) {
    .header__link:hover {
      text-decoration: underline;
    }
  }

  @media (width < 480px) {
    .header__logo {
      font-size: 1rem;
    }

    .header__link {
      padding-inline: 4px;
      font-size: 0.875rem;
    }
  }
</style>
```

- [ ] **Step 4: `src/components/Footer.astro`**

```astro
---
const year = new Date().getFullYear();
---

<footer class="footer">
  <div class="footer__inner l-container">
    <a class="footer__link" href="https://github.com/amemori0">GitHub</a>
    <p class="footer__copy"><small>&copy; {year} <span translate="no">Shuri Amemori</span></small></p>
  </div>
</footer>

<style>
  .footer {
    margin-block-start: var(--space-section);
    border-block-start: 1px solid var(--color-border);
  }

  .footer__inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-block: 24px;
    color: var(--color-muted);
  }

  .footer__link {
    display: grid;
    place-items: center;
    min-block-size: 44px;
  }
</style>
```

- [ ] **Step 5: `src/layouts/BaseLayout.astro`**

```astro
---
import "../styles/global.css";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";

interface Props {
  title: string;
  description?: string;
}

const SITE_NAME = "Shuri Amemori Portfolio";
const DEFAULT_DESCRIPTION = "雨森 守浬のポートフォリオサイトです。WordPressのオリジナルテーマ制作と、Next.jsで制作中の作品を掲載しています。";
const { title, description = DEFAULT_DESCRIPTION } = Astro.props;
const pageTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
const canonical = new URL(Astro.url.pathname, Astro.site);
---

<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <script is:inline>
      (() => {
        let theme = null;
        try {
          theme = localStorage.getItem("theme");
        } catch {
          // 保存領域が使えない環境ではOSの設定に従う
        }
        if (theme !== "light" && theme !== "dark") {
          theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.dataset.theme = theme;
      })();
    </script>
  </head>
  <body>
    <a class="skip-link" href="#main">本文へスキップ</a>
    <Header />
    <main id="main">
      <slot />
    </main>
    <Footer />
  </body>
</html>

<style>
  .skip-link {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 100;
    padding: 8px 16px;
    background-color: var(--color-surface);
    translate: 0 -200%;
  }

  .skip-link:focus-visible {
    translate: 0 0;
  }
</style>
```

- [ ] **Step 6: `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1a1a1a"/><text x="16" y="22" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#fafafa" text-anchor="middle">SA</text></svg>
```

- [ ] **Step 7: `src/pages/404.astro`**

```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="ページが見つかりません">
  <section class="not-found l-container" aria-labelledby="not-found-title">
    <h1 id="not-found-title" class="not-found__title">ページが見つかりません</h1>
    <p>URLが変わったか、ページが削除された可能性があります。</p>
    <p><a href="/">トップページへ戻る</a></p>
  </section>
</BaseLayout>

<style>
  .not-found {
    display: grid;
    gap: 16px;
    padding-block: var(--space-section);
  }

  .not-found__title {
    font-size: clamp(1.5rem, 1.2rem + 1.5svi, 2.25rem);
  }
</style>
```

- [ ] **Step 8: 確認** — `npm run check` → `0 errors`、`npm run build` → `dist/404.html` が生成される

- [ ] **Step 9: コミット**
```bash
git add src/styles src/layouts src/components public src/pages/404.astro
git commit -m "feat: レイアウトとライト/ダーク切り替えを追加"
```

---

### Task 5: デバイスモックアップ・作品カード・トップページ

**Files:**
- Create: `src/components/DeviceMockup.astro`, `src/components/StatusBadge.astro`, `src/components/WorkCard.astro`, `src/pages/index.astro`

**Interfaces:**
- Consumes: `sortWorks` / `statusLabel`(Task 1)、`works` コレクション(Task 3)、`BaseLayout`(Task 4)
- Produces: `<DeviceMockup desktop: ImageMetadata; mobile: ImageMetadata; title: string; size?: "card" | "large"; priority?: boolean>`、`<StatusBadge status: WorkStatus>`、`<WorkCard work: CollectionEntry<"works">; headingLevel?: 2 | 3>`

- [ ] **Step 1: `src/components/DeviceMockup.astro`**

```astro
---
import { Image } from "astro:assets";
import type { ImageMetadata } from "astro";

interface Props {
  desktop: ImageMetadata;
  mobile: ImageMetadata;
  title: string;
  size?: "card" | "large";
  priority?: boolean;
}

const { desktop, mobile, title, size = "card", priority = false } = Astro.props;
const loading = priority ? "eager" : "lazy";
const fetchpriority = priority ? "high" : "auto";
const desktopSizes = size === "large" ? "(width < 1120px) 85vw, 950px" : "(width < 720px) 85vw, 320px";
const mobileSizes = size === "large" ? "200px" : "80px";
---

<figure class="device-mockup" data-size={size}>
  <div class="device-mockup__laptop">
    <div class="device-mockup__laptop-screen">
      <Image
        class="device-mockup__image"
        src={desktop}
        alt={`${title}のトップページをPCで表示した画面`}
        widths={[480, 960, 1440]}
        sizes={desktopSizes}
        loading={loading}
        fetchpriority={fetchpriority}
      />
    </div>
    <div class="device-mockup__laptop-base" aria-hidden="true"></div>
  </div>
  <div class="device-mockup__phone">
    <div class="device-mockup__phone-screen">
      <Image class="device-mockup__image" src={mobile} alt={`${title}のトップページをスマートフォンで表示した画面`} widths={[200, 400, 780]} sizes={mobileSizes} loading={loading} />
    </div>
  </div>
</figure>

<style>
  .device-mockup {
    --_phone-width: 22%;

    position: relative;
    padding-block-end: 4%;
    padding-inline-end: 8%;
  }

  .device-mockup__laptop-screen {
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border: clamp(4px, 1.2cqi, 14px) solid var(--color-device);
    border-radius: 10px 10px 0 0;
    background-color: var(--color-device);
  }

  .device-mockup__laptop {
    container-type: inline-size;
    container-name: laptop;
  }

  .device-mockup__laptop-base {
    block-size: clamp(6px, 2.4cqi, 20px);
    margin-inline: -5%;
    border-radius: 0 0 12px 12px;
    background: linear-gradient(var(--color-device), color-mix(in srgb, var(--color-device) 70%, var(--color-bg)));
  }

  .device-mockup__phone {
    position: absolute;
    right: 0;
    bottom: 0;
    inline-size: var(--_phone-width);
    padding: 3%;
    border-radius: 14%/7%;
    background-color: var(--color-device);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
  }

  .device-mockup__phone-screen {
    aspect-ratio: 390 / 844;
    overflow: hidden;
    border-radius: 10%/5%;
    background-color: var(--color-bg);
  }

  .device-mockup__image {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    object-position: top;
  }
</style>
```

- [ ] **Step 2: `src/components/StatusBadge.astro`**

```astro
---
import { statusLabel, type WorkStatus } from "../lib/works";

interface Props {
  status: WorkStatus;
}

const { status } = Astro.props;
---

<span class="status-badge" data-status={status}>{statusLabel(status)}</span>

<style>
  .status-badge {
    display: inline-block;
    padding: 2px 10px;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.75rem;
    line-height: calc(20 / 12);
    font-weight: 700;
  }

  .status-badge[data-status="published"] {
    color: var(--color-text);
  }

  .status-badge[data-status="in-progress"] {
    color: var(--color-accent);
  }
</style>
```

- [ ] **Step 3: `src/components/WorkCard.astro`**

```astro
---
import type { CollectionEntry } from "astro:content";
import DeviceMockup from "./DeviceMockup.astro";
import StatusBadge from "./StatusBadge.astro";

interface Props {
  work: CollectionEntry<"works">;
  headingLevel?: 2 | 3;
  priority?: boolean;
}

const { work, headingLevel = 3, priority = false } = Astro.props;
const Heading = `h${headingLevel}` as "h2" | "h3";
const titleId = `work-${work.id}-title`;
const href = `/works/${work.id}/`;
---

<article class="work-card" aria-labelledby={titleId}>
  <Heading id={titleId} class="work-card__title">
    <a class="work-card__link" href={href}>{work.data.title}</a>
  </Heading>
  <div class="work-card__media">
    <DeviceMockup desktop={work.data.images.desktop} mobile={work.data.images.mobile} title={work.data.title} priority={priority} />
  </div>
  <div class="work-card__meta">
    <StatusBadge status={work.data.status} />
  </div>
  <p class="work-card__summary">{work.data.summary}</p>
  <ul class="work-card__tags" role="list" aria-label="使用技術">
    {work.data.tech.map(tech => <li class="work-card__tag">{tech}</li>)}
  </ul>
</article>

<style>
  .work-card {
    position: relative;
    display: grid;
    grid-template-rows: auto auto auto 1fr auto;
    gap: 12px;
    padding: clamp(16px, 2svi, 24px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-surface);
  }

  .work-card__title {
    order: 2;
    font-size: 1.125rem;
    line-height: calc(28 / 18);
  }

  .work-card__media {
    order: 0;
    padding-block: 8px;
  }

  .work-card__meta {
    order: 1;
  }

  .work-card__summary {
    order: 3;
    color: var(--color-muted);
    font-size: 0.9375rem;
  }

  .work-card__tags {
    order: 4;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .work-card__tag {
    padding: 2px 8px;
    border-radius: 4px;
    background-color: var(--color-bg);
    font-size: 0.75rem;
  }

  .work-card__link {
    text-decoration: none;
  }

  /* カード全体をクリック領域にする */
  .work-card__link::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
  }

  .work-card:has(.work-card__link:focus-visible) {
    outline: var(--focus-ring);
    outline-offset: 3px;
  }

  .work-card__link:focus-visible {
    outline: none;
  }

  @media (any-hover: hover) {
    .work-card {
      transition: border-color 0.2s;
    }

    .work-card:has(.work-card__link:hover) {
      border-color: var(--color-text);
    }

    .work-card:has(.work-card__link:hover) .work-card__link {
      text-decoration: underline;
    }
  }
</style>
```

見出しを DOM の先頭に置き(`frontend.md`: カードは見出し始まり)、見た目の順番は `order` で画像を上にしている。

- [ ] **Step 4: `src/pages/index.astro`**

フォームはTask 6で作るので、ここではContactの見出しと説明文だけを置く。

```astro
---
import { getCollection } from "astro:content";
import BaseLayout from "../layouts/BaseLayout.astro";
import WorkCard from "../components/WorkCard.astro";
import { sortWorks } from "../lib/works";

const works = sortWorks(await getCollection("works"));

const SKILLS = [
  { name: "HTML / CSS(SCSS)", note: "FLOCSS + BEM、アクセシビリティを意識したマークアップ" },
  { name: "JavaScript", note: "GSAP・Swiper.jsを使った動きの実装" },
  { name: "PHP / WordPress", note: "オリジナルテーマ開発、ACFを使った運用設計" },
  { name: "TypeScript / React / Next.js", note: "学習中。App Routerで作品を制作中" },
  { name: "開発環境", note: "Vite、Docker(@wordpress/env)、Git / GitHub" },
];
---

<BaseLayout title="Shuri Amemori Portfolio">
  <section class="hero l-container" aria-labelledby="hero-title">
    <hgroup class="hero__heading">
      <h1 id="hero-title" class="hero__name">雨森 守浬</h1>
      <p class="hero__roman" translate="no" lang="en">Shuri Amemori</p>
    </hgroup>
    <p class="hero__lead">
      デザイン再現とアクセシビリティを土台に、CMSの運用設計や開発ツールの自作まで領域を広げてきました。作って終わりではなく、運用する人・書く人・次に開発する人の手間をどう減らすかを考えて実装するのが強みです。
    </p>
  </section>

  <section id="works" class="section l-container" aria-labelledby="works-title">
    <h2 id="works-title" class="section__title">Works</h2>
    <ul class="works-list" role="list">
      {
        works.map((work, index) => (
          <li>
            <WorkCard work={work} priority={index === 0} />
          </li>
        ))
      }
    </ul>
  </section>

  <section id="about" class="section l-container" aria-labelledby="about-title">
    <h2 id="about-title" class="section__title">About</h2>
    <div class="about">
      <p class="about__text">2027年卒業予定。WordPressのオリジナルテーマ制作を中心に作品を作ってきました。現在はReact / Next.js と TypeScript でのアプリ開発に取り組んでいます。</p>
      <h3 class="about__subtitle">スキル</h3>
      <dl class="skills">
        {
          SKILLS.map(skill => (
            <div class="skills__item">
              <dt class="skills__name">{skill.name}</dt>
              <dd class="skills__note">{skill.note}</dd>
            </div>
          ))
        }
      </dl>
    </div>
  </section>

  <section id="contact" class="section l-container" aria-labelledby="contact-title">
    <h2 id="contact-title" class="section__title">Contact</h2>
    <p class="contact__lead">お問い合わせは、下記のフォームからお送りください。</p>
  </section>
</BaseLayout>

<style>
  .hero {
    display: grid;
    gap: 24px;
    padding-block: clamp(56px, 10svi, 120px) clamp(32px, 6svi, 72px);
  }

  .hero__heading {
    display: grid;
    gap: 4px;
  }

  .hero__name {
    font-size: clamp(2rem, 1.4rem + 3svi, 3.5rem);
    line-height: calc(64 / 56);
    letter-spacing: 0.04em;
  }

  .hero__roman {
    color: var(--color-muted);
    font-size: clamp(1rem, 0.9rem + 0.5svi, 1.25rem);
    letter-spacing: 0.08em;
  }

  .hero__lead {
    max-inline-size: min(40em, 100%);
    font-size: clamp(1rem, 0.95rem + 0.3svi, 1.125rem);
  }

  .section {
    display: grid;
    gap: 32px;
    padding-block-start: var(--space-section);
    scroll-margin-block-start: 64px;
  }

  .section__title {
    font-size: clamp(1.5rem, 1.2rem + 1.5svi, 2.25rem);
    letter-spacing: 0.04em;
  }

  .works-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: clamp(16px, 3svi, 32px);
  }

  .works-list > li {
    display: grid;
  }

  .about {
    display: grid;
    gap: 24px;
    max-inline-size: min(48em, 100%);
  }

  .about__subtitle {
    font-size: 1.125rem;
  }

  .skills {
    display: grid;
    gap: 0;
    border-block-start: 1px solid var(--color-border);
  }

  .skills__item {
    display: grid;
    grid-template-columns: minmax(10em, 1fr) 2fr;
    gap: 8px 24px;
    padding-block: 16px;
    border-block-end: 1px solid var(--color-border);
  }

  .skills__name {
    font-weight: 700;
  }

  .skills__note {
    color: var(--color-muted);
  }

  @media (width < 640px) {
    .skills__item {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 5: 確認** — `npm run check` → 0 errors、`npm run build` → `dist/index.html` 生成。`npm run preview` で開き、3枚のカードにモックアップが表示されること、カードのどこを押しても詳細URLへ遷移すること(詳細ページはTask 6まで404でよい)

- [ ] **Step 6: コミット**
```bash
git add src/components src/pages/index.astro
git commit -m "feat: デバイスモックアップ付きの作品一覧とトップページを追加"
```

---

### Task 6: 作品詳細ページとお問い合わせフォーム

**Files:**
- Create: `src/pages/works/[slug].astro`, `src/components/ContactForm.astro`
- Modify: `src/pages/index.astro`(Contact セクションにフォームを入れる)

**Interfaces:**
- Consumes: `DeviceMockup` / `StatusBadge` / `BaseLayout` / `works` コレクション
- Produces: `<ContactForm endpoint: string>`

- [ ] **Step 1: Formspree にフォームを作る** — Chrome で https://formspree.io/forms を開き、「ポートフォリオ お問い合わせ」という名前でフォームを作成(受信先 amemori.sy@gmail.com)。表示されたエンドポイント `https://formspree.io/f/<id>` を控える

- [ ] **Step 2: `src/pages/works/[slug].astro`**

```astro
---
import { getCollection, render, type CollectionEntry } from "astro:content";
import BaseLayout from "../../layouts/BaseLayout.astro";
import DeviceMockup from "../../components/DeviceMockup.astro";
import StatusBadge from "../../components/StatusBadge.astro";

export async function getStaticPaths() {
  const works = await getCollection("works");
  return works.map(work => ({ params: { slug: work.id }, props: { work } }));
}

interface Props {
  work: CollectionEntry<"works">;
}

const { work } = Astro.props;
const { Content } = await render(work);
const { title, summary, role, tech, links, images, status } = work.data;
---

<BaseLayout title={title} description={summary}>
  <article class="work l-container" aria-labelledby="work-title">
    <nav class="work__breadcrumb" aria-label="パンくずリスト">
      <ol role="list" class="breadcrumb">
        <li><a href="/">トップ</a></li>
        <li><a href="/#works">Works</a></li>
        <li aria-current="page">{title}</li>
      </ol>
    </nav>

    <header class="work__header">
      <StatusBadge status={status} />
      <h1 id="work-title" class="work__title">{title}</h1>
      <p class="work__summary">{summary}</p>
    </header>

    <DeviceMockup desktop={images.desktop} mobile={images.mobile} title={title} size="large" priority />

    <dl class="work__facts">
      <div class="work__fact">
        <dt>担当範囲</dt>
        <dd>{role}</dd>
      </div>
      <div class="work__fact">
        <dt>使用技術</dt>
        <dd>
          <ul class="work__tags" role="list">
            {tech.map(item => <li class="work__tag">{item}</li>)}
          </ul>
        </dd>
      </div>
      {
        (links.demo || links.repo) && (
          <div class="work__fact">
            <dt>リンク</dt>
            <dd>
              <ul class="work__links" role="list">
                {links.demo && (
                  <li>
                    <a class="work__button" href={links.demo}>
                      デモサイトを見る<span class="u-sr-only">({title})</span>
                    </a>
                  </li>
                )}
                {links.repo && (
                  <li>
                    <a class="work__button" href={links.repo}>
                      GitHubでコードを見る<span class="u-sr-only">({title})</span>
                    </a>
                  </li>
                )}
              </ul>
            </dd>
          </div>
        )
      }
    </dl>

    <div class="work__body">
      <Content />
    </div>
  </article>
</BaseLayout>

<style>
  .work {
    display: grid;
    gap: clamp(24px, 4svi, 48px);
    padding-block-start: 24px;
  }

  .breadcrumb {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    color: var(--color-muted);
    font-size: 0.875rem;
  }

  .breadcrumb > li:not(:last-child)::after {
    content: "/";
    margin-inline-start: 8px;
  }

  .work__header {
    display: grid;
    justify-items: start;
    gap: 12px;
  }

  .work__title {
    font-size: clamp(1.75rem, 1.3rem + 2svi, 2.75rem);
    line-height: calc(52 / 44);
  }

  .work__summary {
    max-inline-size: min(40em, 100%);
    color: var(--color-muted);
  }

  .work__facts {
    display: grid;
    border-block-start: 1px solid var(--color-border);
  }

  .work__fact {
    display: grid;
    grid-template-columns: 8em 1fr;
    gap: 8px 24px;
    padding-block: 16px;
    border-block-end: 1px solid var(--color-border);
  }

  .work__fact dt {
    font-weight: 700;
  }

  .work__tags,
  .work__links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .work__tag {
    padding: 2px 8px;
    border-radius: 4px;
    background-color: var(--color-surface);
    font-size: 0.875rem;
  }

  .work__button {
    display: inline-flex;
    align-items: center;
    min-block-size: 44px;
    padding-inline: 20px;
    border: 1px solid var(--color-text);
    border-radius: 999px;
    text-decoration: none;
  }

  @media (any-hover: hover) {
    .work__button {
      transition:
        background-color 0.2s,
        color 0.2s;
    }

    .work__button:hover {
      background-color: var(--color-text);
      color: var(--color-bg);
    }
  }

  .work__body {
    display: grid;
    gap: 16px;
    max-inline-size: min(48em, 100%);
  }

  .work__body :global(h2) {
    margin-block-start: 24px;
    font-size: clamp(1.25rem, 1.1rem + 0.8svi, 1.625rem);
  }

  .work__body :global(h3) {
    margin-block-start: 12px;
    font-size: 1.125rem;
  }

  .work__body :global(ul) {
    display: grid;
    gap: 8px;
    padding-inline-start: 1.25em;
  }

  .work__body :global(code) {
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background-color: var(--color-surface);
    font-size: 0.9em;
  }

  @media (width < 640px) {
    .work__fact {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 3: `src/components/ContactForm.astro`**

```astro
---
interface Props {
  endpoint: string;
}

const { endpoint } = Astro.props;
---

<form class="contact-form" action={endpoint} method="POST" data-contact-form>
  <div class="contact-form__field">
    <label class="contact-form__label" for="contact-name">お名前<span class="contact-form__required">必須</span></label>
    <input class="contact-form__input" id="contact-name" name="name" type="text" autocomplete="name" required aria-describedby="contact-name-error" />
    <p class="contact-form__error" id="contact-name-error">お名前を入力してください。</p>
  </div>
  <div class="contact-form__field">
    <label class="contact-form__label" for="contact-email">メールアドレス<span class="contact-form__required">必須</span></label>
    <input class="contact-form__input" id="contact-email" name="email" type="email" autocomplete="email" required aria-describedby="contact-email-error" />
    <p class="contact-form__error" id="contact-email-error">メールアドレスの形式で入力してください。</p>
  </div>
  <div class="contact-form__field">
    <label class="contact-form__label" for="contact-message">お問い合わせ内容<span class="contact-form__required">必須</span></label>
    <textarea class="contact-form__input contact-form__textarea" id="contact-message" name="message" rows="6" required aria-describedby="contact-message-error"></textarea>
    <p class="contact-form__error" id="contact-message-error">お問い合わせ内容を入力してください。</p>
  </div>
  <!-- スパム対策: 人には見えない項目。値が入っていたらFormspreeが破棄する -->
  <input class="u-sr-only" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" />
  <input type="hidden" name="_subject" value="ポートフォリオサイトからのお問い合わせ" />
  <button class="contact-form__submit" type="submit">送信する</button>
  <p class="contact-form__result" data-contact-result role="status"></p>
</form>

<script>
  const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
  const result = form?.querySelector<HTMLElement>("[data-contact-result]");

  form?.addEventListener("submit", async event => {
    // required 属性の検証はブラウザが先に行うため、ここに来るのは入力が揃っているときだけ
    event.preventDefault();
    const submitButton = form.querySelector<HTMLButtonElement>("[type='submit']");
    if (!submitButton || !result) return;

    submitButton.disabled = true;
    result.removeAttribute("role");
    result.textContent = "送信しています…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Formspree responded ${response.status}`);
      form.reset();
      result.setAttribute("role", "status");
      result.dataset.state = "success";
      result.textContent = "送信しました。お問い合わせありがとうございます。";
    } catch (error) {
      console.error(error);
      result.setAttribute("role", "alert");
      result.dataset.state = "error";
      result.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
    } finally {
      submitButton.disabled = false;
    }
  });
</script>

<style>
  .contact-form {
    display: grid;
    gap: 24px;
    max-inline-size: min(40em, 100%);
  }

  .contact-form__field {
    display: grid;
    gap: 8px;
  }

  .contact-form__label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }

  .contact-form__required {
    padding: 0 6px;
    border-radius: 4px;
    background-color: var(--color-accent);
    color: var(--color-bg);
    font-size: 0.75rem;
  }

  .contact-form__input {
    min-block-size: 44px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background-color: var(--color-surface);
    font-size: 1rem;
  }

  .contact-form__textarea {
    field-sizing: content;
    min-block-size: 8lh;
    resize: vertical;
  }

  .contact-form__input:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  .contact-form__error {
    display: none;
    color: light-dark(#b00020, #ff8a80);
    font-size: 0.875rem;
  }

  .contact-form__input:user-invalid {
    border-color: light-dark(#b00020, #ff8a80);
  }

  .contact-form__field:has(:user-invalid) .contact-form__error {
    display: block;
  }

  .contact-form__submit {
    justify-self: start;
    min-block-size: 48px;
    padding-inline: 32px;
    border: 0;
    border-radius: 999px;
    background-color: var(--color-text);
    color: var(--color-bg);
    font-weight: 700;
    cursor: pointer;
  }

  .contact-form__submit:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .contact-form__result[data-state="error"] {
    color: light-dark(#b00020, #ff8a80);
  }
</style>
```

- [ ] **Step 4: `src/pages/index.astro` を変更** — import にフォームを足し、Contact セクションの説明文の下に置く

```astro
import ContactForm from "../components/ContactForm.astro";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/<Step 1 で控えたID>";
```
```astro
    <p class="contact__lead">お問い合わせは、下記のフォームからお送りください。</p>
    <ContactForm endpoint={FORMSPREE_ENDPOINT} />
```

- [ ] **Step 5: 確認** — `npm run check` → 0 errors、`npm run build` → `dist/works/{tetote,daymaga,flow-meister}/index.html` が生成される。flow-meister の詳細にリンク欄が出ないこと

- [ ] **Step 6: コミット**
```bash
git add src/pages src/components/ContactForm.astro
git commit -m "feat: 作品詳細ページとお問い合わせフォームを追加"
```

---

### Task 7: 検査スクリプトと README

**Files:**
- Create: `scripts/check-links.mjs`, `scripts/smoke.mjs`, `README.md`

- [ ] **Step 1: `scripts/check-links.mjs`**

```js
// dist/ の全HTMLから内部リンク(/ で始まる href と src)を集め、対応するファイルがあるかを調べる
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const listHtml = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => (entry.isDirectory() ? listHtml(join(dir, entry.name)) : entry.name.endsWith(".html") ? [join(dir, entry.name)] : [])));
  return files.flat();
};

const exists = async path => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const missing = new Set();
for (const file of await listHtml(DIST)) {
  const html = await readFile(file, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"/][^"]*|\/)"/g)) {
    const path = decodeURI(url.split(/[?#]/)[0]);
    const target = path.endsWith("/") ? join(DIST, path, "index.html") : join(DIST, path);
    if (!(await exists(target))) missing.add(`${path} (in ${file.replace(DIST, "")})`);
  }
}

if (missing.size > 0) {
  console.error(`Missing ${missing.size} link(s):\n${[...missing].join("\n")}`);
  process.exit(1);
}
console.log("All internal links resolve.");
```

- [ ] **Step 2: `scripts/smoke.mjs`**

```js
// npm run preview を起動した状態で実行する。テーマ切替・保存、横スクロール、コンソールエラーを調べる
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const PAGES = ["/", "/works/tetote/", "/works/daymaga/", "/works/flow-meister/", "/404/"];
const failures = [];
const browser = await chromium.launch();

try {
  for (const [label, options] of Object.entries({
    desktop: { viewport: { width: 1280, height: 800 } },
    mobile: { viewport: { width: 390, height: 844 }, isMobile: true },
  })) {
    const context = await browser.newContext({ ...options, colorScheme: "light" });
    const page = await context.newPage();
    page.on("console", message => {
      if (message.type() === "error") failures.push(`[${label}] console error: ${message.text()}`);
    });

    for (const path of PAGES) {
      await page.goto(BASE + path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) failures.push(`[${label}] ${path}: 横スクロールが ${overflow}px 発生`);
    }

    // OSがライトならライトで始まり、トグルでダークになり、再読み込み後も保たれる
    await page.goto(BASE + "/");
    if ((await page.getAttribute("html", "data-theme")) !== "light") failures.push(`[${label}] 初期テーマがOS設定(light)になっていない`);
    await page.click("[data-theme-toggle]");
    if ((await page.getAttribute("html", "data-theme")) !== "dark") failures.push(`[${label}] トグルでdarkにならない`);
    if ((await page.getAttribute("[data-theme-toggle]", "aria-pressed")) !== "true") failures.push(`[${label}] aria-pressed が true にならない`);
    await page.reload();
    if ((await page.getAttribute("html", "data-theme")) !== "dark") failures.push(`[${label}] 再読み込みでテーマが保たれない`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke checks passed.");
```

- [ ] **Step 3: 実行**
```bash
npm run build && npm run check:links      # → All internal links resolve.
npm run preview                            # 別シェルで起動したまま
npm run smoke                              # → Smoke checks passed.
```
失敗したら原因を直してから次へ進む。

- [ ] **Step 4: `README.md`**

````md
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
````

- [ ] **Step 5: コミット**
```bash
git add scripts/check-links.mjs scripts/smoke.mjs README.md
git commit -m "chore: リンク検査・表示検査のスクリプトとREADMEを追加"
```

---

### Task 8: 目視確認と公開

- [ ] **Step 1: Chromeで目視確認** — `npm run preview` を開き、トップと詳細3ページを、ライト/ダーク・1280px/390px で確認。Tab キーだけでヘッダー→カード→フォームまで移動でき、フォーカスが見えること

- [ ] **Step 2: web-design-guidelines スキルで UI 監査** — 指摘を直してコミット

- [ ] **Step 3: ユーザーに見てもらう** — 文章(自己紹介・作品説明)と見た目の確認を依頼し、直しを反映する

- [ ] **Step 4: GitHubリポジトリ作成と push(ユーザー確認後)**
```bash
gh repo create amemori0/portfolio --public --source . --push
```

- [ ] **Step 5: Cloudflare Pages と GitHub を連携(ユーザー操作)** — ダッシュボードの Workers & Pages → Create → Pages → Connect to Git で `amemori0/portfolio` を選ぶ。プロジェクト名 `amemori-portfolio`、Framework preset `Astro`、Build command `npm run build`、Output `dist`、環境変数 `NODE_VERSION=24`。GitHubアプリの許可はユーザーが押す

- [ ] **Step 6: 公開確認** — 割り当てられたURLが `amemori-portfolio.pages.dev` と違えば `astro.config.mjs` の `site` と README を直して push。公開URLで全ページ200、ライト/ダーク切替を確認

- [ ] **Step 7: フォームのテスト送信(ユーザー確認後)** — 公開URLからダミーの値で1回送り、Formspree の受信箱に入ることを確認
