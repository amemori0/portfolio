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

    // 作品カードは画像(モックアップ)の上を押しても詳細ページへ移動する
    await page.goto(BASE + "/");
    const media = page.locator(".work-card__media").first();
    await media.scrollIntoViewIfNeeded();
    // 画像の上にはリンクの当たり判定が重なっているため、要素ではなく座標を押す(利用者と同じ操作)
    const box = await media.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForURL(/\/works\/[^/]+\/$/, { timeout: 5000 }).catch(() => failures.push(`[${label}] カードの画像を押しても詳細ページへ移動しない`));

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
