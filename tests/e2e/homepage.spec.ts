import { test, expect } from "@playwright/test";

test("Long homepage anchors, sticky header and all activity/project entry positions work", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).toHaveTitle(/ATOX.*连接青年/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /通过技术、产品与全球社区/,
  );
  await expect(page.locator(".hp-program")).toHaveCount(3);
  await expect(page.locator(".hp-explore-card")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await page
    .locator(".hp-footer-nav")
    .getByRole("link", { name: "关于我们", exact: true })
    .click();
  await expect(page).toHaveURL(/#about$/);
  await expect
    .poll(() =>
      page
        .locator("#about")
        .evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBe(105);
  expect(
    await page
      .locator(".site-header")
      .evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(0);
  await page
    .locator(".hp-footer")
    .getByRole("link", { name: "返回顶部", exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  for (const selector of [
    ".sn-primary-nav",
    ".hp-hero",
    ".hp-explore",
    ".hp-footer-nav",
  ]) {
    await page.goto("/");
    const entry = page.locator(selector).locator('a[href="/events"]').first();
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.locator(".eb-card")).toHaveCount(4);
  }
  await page.locator('.eb-card a[href="/events/demo"]').click();
  await page.locator('.pc-shortcuts a[href="/events/demo/register"]').click();
  await expect(page).toHaveURL(/\/login\?next=%2Fevents%2Fdemo%2Fregister$/);
  for (const selector of [
    ".sn-primary-nav",
    ".hp-hero",
    ".hp-explore",
    ".hp-footer-nav",
  ]) {
    await page.goto("/");
    await page.locator(selector).locator('a[href="/projects"]').first().click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "每一个想法",
    );
    await expect(page.locator(".pb-card")).toHaveCount(9);
    await page.locator(".site-header .sn-brand").click();
    await expect(page).toHaveURL(/\/$/);
  }
  await page.goto("/projects");
  await page.getByRole("link", { name: "探索活动", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  expect(errors).toEqual([]);
});

test("Mobile disclosure menu, keyboard, bilingual placeholder and reduced motion", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "打开菜单", exact: true });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#sn-primary-nav")).toBeHidden();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "关闭菜单" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Tab");
  await expect(page.locator("#sn-primary-nav a").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator("#sn-primary-nav")).toBeHidden();
  await menu.click();
  await page
    .locator("#sn-primary-nav")
    .getByRole("link", { name: "首页", exact: true })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page
    .locator(".hp-footer-nav")
    .getByRole("link", { name: "主办内容", exact: true })
    .click();
  await expect(page).toHaveURL(/#programs$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() =>
      page
        .locator("#programs")
        .evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBe(105);
  const sectionTop = await page
    .locator("#programs")
    .evaluate((element) => element.getBoundingClientRect().top);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Human ideas.",
  );
  await expect
    .poll(async () =>
      Math.abs(
        (await page
          .locator("#programs")
          .evaluate((element) => element.getBoundingClientRect().top)) -
          sectionTop,
      ),
    )
    .toBeLessThan(5);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/#programs$/);
  expect(
    await page
      .locator(".hp-art-panel svg")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(
    await page
      .locator("html")
      .evaluate((element) => getComputedStyle(element).scrollBehavior),
  ).toBe("auto");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("home-mobile-en.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .locator("#sn-primary-nav")
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every idea",
  );
  await page.getByRole("button", { name: "切换为中文" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "每一个想法",
  );
  await page.screenshot({
    path: testInfo.outputPath("projects-mobile.png"),
    fullPage: true,
  });
});

test("Homepage copy and key navigation render without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "好奇心",
    );
    await expect(page.locator("#about")).toContainText("面向创造者");
    await expect(page.locator(".hp-program")).toHaveCount(3);
    await page.locator('.hp-hero a[href="/projects"]').click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "每一个想法",
    );
  } finally {
    await context.close();
  }
});
