import { test, expect, type Page, type BrowserContext } from "@playwright/test";

async function login(page: Page, context: BrowserContext, target: string) {
  const email = `multi-event-${Date.now()}@example.com`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByLabel("6 位验证码")).toBeVisible();
  const mail = await context.newPage();
  await mail.goto("/dev/mail");
  const text = await mail
    .locator("article")
    .filter({ hasText: email })
    .first()
    .locator("pre")
    .innerText();
  await mail.close();
  await page.getByLabel("6 位验证码").fill(text.match(/\b\d{6}\b/)![0]);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page).toHaveURL(new RegExp(target + "$"));
}

test("Board combines URL filters, restores language and renders a mobile grid", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: "活动", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".eb-card")).toHaveCount(3);
  await expect(page.locator(".eb-recommended")).toHaveCount(1);
  const columns = () =>
    page
      .locator(".eb-grid")
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(/\s+/).length,
      );
  expect(await columns()).toBe(3);
  await page.screenshot({
    path: testInfo.outputPath("board-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await columns()).toBe(2);
  await page.getByLabel("搜索活动", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("年份", { exact: true })).toBeFocused();
  await page.getByLabel("年份", { exact: true }).selectOption("2027");
  await expect(page).toHaveURL(/year=2027/);
  await expect(page.locator(".eb-card")).toHaveCount(1);
  await expect(page.locator(".eb-recommended")).toHaveCount(0);
  await page.getByLabel("活动阶段", { exact: true }).selectOption("ended");
  await expect(page.locator(".eb-card")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("年份", { exact: true })).toHaveValue("2027");
  await expect(page.getByLabel("活动阶段", { exact: true })).toHaveValue(
    "ended",
  );
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "Events", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/year=2027/);
  await page.getByRole("button", { name: "切换为中文" }).click();
  await page
    .getByRole("button", { name: "重置筛选", exact: true })
    .first()
    .click();
  await expect(page.locator(".eb-card")).toHaveCount(3);
  await page.getByLabel("搜索活动", { exact: true }).fill("  DOES-NOT-EXIST  ");
  await expect(page.locator(".eb-card")).toHaveCount(0);
  await expect(page).toHaveURL(/q=DOES-NOT-EXIST/);
  await page.goBack();
  await expect(page.locator(".eb-card")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".eb-card").first()).toBeVisible();
  expect(await columns()).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath("board-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await expect(
    page.locator('.site-header a[href="/events"]').last(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const result = await request.get("/api/events?year=2027&stage=upcoming");
  expect(result.status()).toBe(200);
  expect(result.headers()["cache-control"]).toContain("no-store");
  const body = await result.text();
  for (const secret of [
    "userId",
    "internalNote",
    "official",
    "storageName",
    "registrationOpensAt",
  ])
    expect(body).not.toContain(secret);
  for (const target of [
    "/events/not-an-event",
    "/events/not-an-event/register",
    "/events/not-an-event/materials",
    "/api/events/not-an-event",
    "/api/events/not-an-event/materials",
    "/review/events/not-an-event",
  ]) {
    expect((await request.get(target, { maxRedirects: 0 })).status()).toBe(404);
  }
  await page.locator('.eb-card a[href="/events/upcoming-demo"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("冬季");
  await page
    .locator('.pc-shortcuts a[href="/events/upcoming-demo/register"]')
    .click();
  await expect(page).toHaveURL(
    /\/login\?next=%2Fevents%2Fupcoming-demo%2Fregister$/,
  );
});

test("One account registers separately, keeps isolated drafts, and returns from login to selected activity", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await login(page, context, "/events/upcoming-demo/register");
  for (const [eventId, name] of [
    ["upcoming-demo", "Future Builder"],
    ["demo", "Current Builder"],
  ]) {
    await page.goto(`/events/${eventId}/register`);
    await page.getByLabel(/^姓名/).fill(name);
    await page.getByLabel(/^参赛角色/).selectOption("developer");
    await page.getByLabel(/^国家 \/ 地区/).fill("China");
    await page.locator("#reg-terms").check();
    await page.getByRole("button", { name: "确认报名" }).click();
    await expect(page.getByRole("heading", { name: "报名成功" })).toBeVisible();
    await page.getByRole("link", { name: "前往材料提交" }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}/materials$`));
    await page.getByLabel(/^项目名称/).fill(`${eventId} isolated draft`);
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.locator('.ev-success[role="status"]')).toContainText(
      "草稿已保存",
    );
  }
  await page.goto("/events/upcoming-demo/materials");
  await expect(page.getByLabel(/^项目名称/)).toHaveValue(
    "upcoming-demo isolated draft",
  );
  await page.getByLabel(/^项目名称/).fill("Unsent activity edit");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: /返回活动展板/ }).click();
  await expect(page).toHaveURL(/\/events\/upcoming-demo\/materials$/);
  await expect(page.getByLabel(/^项目名称/)).toHaveValue(
    "Unsent activity edit",
  );
  for (const eventId of ["demo", "upcoming-demo"]) {
    const data = await (
      await page.request.get(`/api/events/${eventId}/materials`)
    ).json();
    expect(data.draft.name).toBe(`${eventId} isolated draft`);
    expect(data.official).toBeNull();
    expect(data.revision).toBe(1);
  }
  const closed = await page.request.post("/api/events/past-demo/registration", {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      displayName: "Past",
      role: "developer",
      country: "China",
      organization: "",
      contact: "",
      acceptedTerms: true,
    },
  });
  expect(closed.status()).toBe(403);
  expect((await closed.json()).error).toBe("CLOSED");
});
