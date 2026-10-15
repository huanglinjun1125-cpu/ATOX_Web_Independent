import { test, expect } from "@playwright/test";

test("Email signup, local mail, refresh, account, and logout", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
  const address = `browser-${Date.now()}@example.com`;
  await page.getByLabel("邮箱地址").fill(address);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByLabel("6 位验证码")).toBeVisible();
  const mailbox = await context.newPage();
  await mailbox.goto("/dev/mail");
  await expect(mailbox.getByText(address, { exact: true })).toBeVisible();
  const body = await mailbox.locator("pre").first().innerText();
  const code = body.match(/\b\d{6}\b/)![0];
  await page.getByLabel("6 位验证码").fill(code);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: address })).toBeVisible();
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(200);
  expect((await me.json()).user.email).toBe(address);
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.httpOnly);
  expect(session).toBeDefined();
  expect(session!.sameSite).toBe("Lax");
  await page.goto("/");
  await expect(
    page.locator(".site-header").getByRole("link", { name: "我的账户" }),
  ).toBeVisible();
  await page.goto("/projects");
  await expect(
    page.locator(".site-header").getByRole("link", { name: "我的账户" }),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  expect(errors).toEqual([]);
});

test("Mobile layout and persisted language switching", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Turn curiosity",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .locator(".site-header")
    .getByRole("link", { name: "Sign in / Join" })
    .click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
});

test("Mutations reject foreign/missing origins and validate JSON", async ({
  request,
  baseURL,
}) => {
  const url = "/api/auth/send-code";
  expect(
    (
      await request.post(url, {
        data: { email: "safe@example.com", language: "zh" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(url, {
        headers: { Origin: "https://evil.example" },
        data: { email: "safe@example.com" },
      })
    ).status(),
  ).toBe(403);
  const invalid = await request.post(url, {
    headers: { Origin: new URL(baseURL!).origin },
    data: { email: "invalid", language: "zh" },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toBe("INVALID_EMAIL");
  const me = await request.get("/api/auth/me");
  expect(me.status()).toBe(401);
  expect(me.headers()["cache-control"]).toContain("no-store");
});
