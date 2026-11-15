import { test, expect } from "@playwright/test";

test("native auth, shared mailbox views, compose, ownership and responsive HTML mail", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const active = new Set<ResizeObserver>();
    const Base = window.ResizeObserver;
    window.ResizeObserver = class extends Base {
      observe(target: Element, options?: ResizeObserverOptions) {
        active.add(this);
        super.observe(target, options);
      }
      disconnect() {
        active.delete(this);
        super.disconnect();
      }
    };
    (
      window as Window & { activeFixtureObservers?: () => number }
    ).activeFixtureObservers = () => active.size;
  });
  const user = "browser-user",
    password = "fixture-browser-password";
  await page.goto("/signup");
  await expect(page.locator('input[name="signupToken"]')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveAttribute(
    "minlength",
    "8",
  );
  await page.getByLabel("아이디", { exact: true }).fill(user);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "내 편지함 만들기" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByText("HTML fixture", { exact: true })).toBeVisible();
  for (const path of ["/sent", "/bounced"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
  }
  await page.goto("/compose?to=fixture-user&subject=browser-local-fixture");
  await expect(page.locator('form[action="/api/send"]')).toHaveAttribute(
    "enctype",
    "multipart/form-data",
  );
  await page.getByLabel("편지 내용").fill("Browser fixture local delivery");
  await page.getByLabel("첨부파일", { exact: true }).setInputFiles({
    name: "fixture.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("local attachment fixture"),
  });
  await page.getByRole("button", { name: "편지 보내기", exact: true }).click();
  await expect(page).toHaveURL(/\/mail\/sent\//);
  const sentUrl = page.url();
  await expect(
    page.getByRole("heading", { name: "browser-local-fixture" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /fixture.txt/ })).toBeVisible();
  const attachment = await page
    .getByRole("link", { name: /fixture.txt/ })
    .getAttribute("href");
  const response = await context.request.get(attachment!);
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe("local attachment fixture");
  await page.goto("/mail/inbox/html-fixture");
  await expect(page.locator("iframe")).toHaveAttribute(
    "sandbox",
    "allow-popups allow-popups-to-escape-sandbox allow-same-origin",
  );
  expect(
    await page.evaluate(() =>
      Boolean(
        (window as Window & { fixtureScriptRan?: boolean }).fixtureScriptRan,
      ),
    ),
  ).toBe(false);
  await expect(
    page.frameLocator("iframe").getByText("HTML fixture content"),
  ).toBeVisible();
  const height = await page
    .locator("iframe")
    .evaluate((frame) => frame.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(240);
  expect(height).toBeLessThanOrEqual(16000);
  for (let i = 0; i < 4; i++) {
    await page.locator(".messageToolbar > a").click();
    await expect(page).toHaveURL(/\/inbox$/);
    expect(
      await page.evaluate(() =>
        (
          window as Window & { activeFixtureObservers?: () => number }
        ).activeFixtureObservers?.(),
      ),
    ).toBe(0);
    await page.locator('a[href="/mail/inbox/html-fixture"]').click();
    await expect(page.locator("iframe")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/inbox");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: process.env.MAILBOX_BROWSER_OUTPUT + "/mobile-inbox.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/inbox");
  await expect(page.locator(".appShell")).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: process.env.MAILBOX_BROWSER_OUTPUT + "/desktop-inbox.png",
    fullPage: true,
  });
  await page.locator("summary").click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("아이디", { exact: true }).fill("fixture-user");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(process.env.FIXTURE_PASSWORD!);
  await page.getByRole("button", { name: "편지함 열기" }).click();
  await page.goto(sentUrl);
  await expect(
    page.getByRole("heading", { name: "browser-local-fixture" }),
  ).toHaveCount(0);
  const forbidden = await context.request.get(attachment!);
  expect(forbidden.status()).toBe(403);
});
