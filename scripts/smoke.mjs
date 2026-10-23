// npm run preview を起動した状態で実行する。表示崩れ・テーマ切替・主要操作・フォームの状態表示を調べる
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4321";
const PAGES = ["/", "/works/tetote/", "/works/daymaga/", "/works/flow-meister/", "/404/"];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  tablet: { viewport: { width: 768, height: 1024 }, isMobile: true },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true },
  narrow: { viewport: { width: 320, height: 568 }, isMobile: true },
};
const failures = [];
const fail = message => failures.push(message);
const browser = await chromium.launch();

try {
  for (const [label, options] of Object.entries(VIEWPORTS)) {
    const width = options.viewport.width;
    const context = await browser.newContext({ ...options, colorScheme: "light" });
    const page = await context.newPage();
    page.on("console", message => {
      if (message.type() === "error" && !message.text().includes("Formspree responded")) fail(`[${label}] console error: ${message.text()}`);
    });

    for (const path of PAGES) {
      await page.goto(BASE + path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) fail(`[${label}] ${path}: 横スクロールが ${overflow}px 発生`);
      // ヘッダーは PC/タブレットで1行(64px)、480px未満で2行に収まる
      const headerHeight = await page.evaluate(() => document.querySelector(".header")?.getBoundingClientRect().height ?? 0);
      const maxHeader = width < 480 ? 128 : 72;
      if (headerHeight > maxHeader) fail(`[${label}] ${path}: ヘッダーが想定より高い(${headerHeight}px)`);
      const toggleRight = await page.evaluate(() => document.querySelector("[data-theme-toggle]")?.getBoundingClientRect().right ?? 0);
      if (toggleRight > width) fail(`[${label}] ${path}: トグルが画面の外にはみ出している`);
      // 操作要素は 44px 以上の高さを持つ
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("a.button, button, .header__link, .footer__link, .breadcrumb__link")]
          .filter(element => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 44)
          .map(element => element.textContent?.trim() || element.getAttribute("aria-label")),
      );
      if (small.length > 0) fail(`[${label}] ${path}: 44px未満の操作要素 ${small.join(", ")}`);
    }

    // 作品カード: 画像を押すと詳細ページへ、デモボタンは外部のデモURLを指す
    await page.goto(BASE + "/");
    const media = page.locator(".work-card__media").first();
    await media.scrollIntoViewIfNeeded();
    const box = await media.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForURL(/\/works\/[^/]+\/$/, { timeout: 5000 }).catch(() => fail(`[${label}] カードの画像を押しても詳細ページへ移動しない`));
    await page.goto(BASE + "/");
    const demoHref = await page.locator(".work-card").first().getByRole("link", { name: /デモを開く/ }).getAttribute("href");
    if (!demoHref?.startsWith("https://")) fail(`[${label}] カードのデモボタンのリンク先が不正: ${demoHref}`);

    // 入れ子のボタン同士の高さがそろっている(1px単位)
    const heights = await page.evaluate(() => [...document.querySelectorAll(".work-card .button")].map(element => element.getBoundingClientRect().height));
    if (new Set(heights).size > 1) fail(`[${label}] カード内のボタンの高さがそろっていない: ${heights.join(", ")}`);

    // テーマ: OSがライトならライトで始まり、トグルでダークになり、再読み込み後も保たれる
    if ((await page.getAttribute("html", "data-theme")) !== "light") fail(`[${label}] 初期テーマがOS設定(light)になっていない`);
    await page.click("[data-theme-toggle]");
    if ((await page.getAttribute("html", "data-theme")) !== "dark") fail(`[${label}] トグルでdarkにならない`);
    if ((await page.getAttribute("[data-theme-toggle]", "aria-pressed")) !== "true") fail(`[${label}] aria-pressed が true にならない`);
    await page.reload();
    if ((await page.getAttribute("html", "data-theme")) !== "dark") fail(`[${label}] 再読み込みでテーマが保たれない`);
    await context.close();
  }

  // フォームの状態表示(PC幅で確認)。Formspree への通信は差し替え、実際には送らない
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  let respondWith = 200;
  await page.route("https://formspree.io/**", async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ status: respondWith, contentType: "application/json", body: "{}" });
  });
  await page.goto(BASE + "/#contact");

  // 未入力で送信 → 3欄にエラー、最初の欄にフォーカス
  await page.click(".contact-form__submit");
  const invalidCount = await page.locator("[aria-invalid='true']").count();
  if (invalidCount !== 3) fail(`[form] 未入力送信でエラーになった欄が ${invalidCount} 件(期待: 3)`);
  if ((await page.evaluate(() => document.activeElement?.id)) !== "contact-name") fail("[form] 未入力送信で最初の欄にフォーカスが移らない");

  // 形式違いのメール → 形式のエラー文
  await page.fill("#contact-name", "テスト");
  await page.fill("#contact-email", "abc");
  await page.fill("#contact-message", "テストです");
  await page.click(".contact-form__submit");
  const emailError = await page.locator("#contact-email-error").innerText();
  if (!emailError.includes("形式")) fail(`[form] 形式違いのメールで形式のエラー文が出ない: ${emailError}`);

  // 送信中 → 成功
  await page.fill("#contact-email", "test@example.com");
  await page.click(".contact-form__submit");
  if (!(await page.locator(".contact-form__submit").isDisabled())) fail("[form] 送信中にボタンが無効にならない");
  if ((await page.locator("[data-submit-label]").innerText()) !== "送信中…") fail("[form] 送信中の文言が出ない");
  await page.waitForSelector("[data-contact-result][data-state='success']", { timeout: 3000 }).catch(() => fail("[form] 成功の表示が出ない"));
  if ((await page.evaluate(() => document.activeElement?.hasAttribute("data-contact-result"))) !== true) fail("[form] 成功時に結果へフォーカスが移らない");
  if ((await page.inputValue("#contact-name")) !== "") fail("[form] 成功後に入力内容が消えない");

  // 失敗 → エラー表示、入力内容は残る
  respondWith = 500;
  await page.fill("#contact-name", "テスト");
  await page.fill("#contact-email", "test@example.com");
  await page.fill("#contact-message", "テストです");
  await page.click(".contact-form__submit");
  await page.waitForSelector("[data-contact-result][data-state='error']", { timeout: 3000 }).catch(() => fail("[form] 失敗の表示が出ない"));
  if ((await page.inputValue("#contact-name")) !== "テスト") fail("[form] 失敗後に入力内容が消えている");
  if (await page.locator(".contact-form__submit").isDisabled()) fail("[form] 失敗後にボタンが押せるように戻らない");
  await context.close();
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke checks passed.");
