// 作品のスクリーンショットを撮る。使い方: npm run capture [slug ...](省略時は全作品)
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const TARGETS = {
  tetote: "https://tetote-997.pages.dev/",
  daymaga: "https://daymaga.pages.dev/",
  // flow-meister は非公開のため、ローカルで `npm run dev` してから撮る
  "flow-meister": "http://localhost:3000/",
};

// 撮影時だけ隠す要素(開発サーバーが重ねて表示するUIなど)
const HIDE_SELECTORS = {
  "flow-meister": ["nextjs-portal"],
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
      const hidden = HIDE_SELECTORS[slug];
      if (hidden) await page.addStyleTag({ content: `${hidden.join(",")} { display: none !important; }` });
      // 遅延読み込みの画像やフェードイン演出が終わるのを待つ
      await page.waitForTimeout(1500);
      await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, dir)) });
      await context.close();
      console.log(`captured ${slug}/${name}.png`);
    }
  }
} finally {
  await browser.close();
}
