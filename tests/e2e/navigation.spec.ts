import { test, expect } from "@playwright/test";

test("Home, events and projects share navigation and accessible menu behavior", async ({
  page,
}) => {
  for (const path of ["/", "/events", "/projects"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const header = page.locator(".site-header");
    const nav = header.getByRole("navigation", { name: "主导航", exact: true });
    await expect(nav.getByRole("link")).toHaveText(["首页", "活动", /项目/]);
    await expect(nav.getByRole("link")).toHaveCount(3);
    await expect(header.locator('a[href="/projects/submit"]')).toHaveCount(0);
    const menu = header.getByRole("button", { name: "打开菜单", exact: true });
    await menu.click();
    await expect(
      header.getByRole("button", { name: "关闭菜单", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(nav).toBeHidden();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await menu.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("link").first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
    }
    await header.getByRole("button", { name: "Switch to English" }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await header
      .getByRole("button", { name: "Open menu", exact: true })
      .click();
    await expect(header.getByRole("navigation").getByRole("link")).toHaveText([
      "Home",
      "Events",
      /Projects/,
      "Tickets (Demo)",
    ]);
    await header
      .getByRole("navigation")
      .getByRole("link", { name: "Events", exact: true })
      .click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(
      header.getByRole("button", { name: "Open menu", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    await header.getByRole("button", { name: "切换为中文" }).click();
  }
});
