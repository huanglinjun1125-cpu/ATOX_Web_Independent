import { test, expect, type Page, type BrowserContext } from "@playwright/test";
test.setTimeout(120000);
async function login(
  page: Page,
  context: BrowserContext,
  target: string,
  email: string,
) {
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
  await expect(page).not.toHaveURL(/\/login/);
}
async function register(page: Page, name: string) {
  await page.getByLabel(/^姓名/).fill(name);
  await page.getByLabel(/^国家 \/ 地区/).fill("China");
  await page.locator("#reg-terms").check();
  await page.getByRole("button", { name: "确认报名" }).click();
}
test("participant hub and complete recruitment flow preserve personal submissions", async ({
  page,
  context,
  browser,
  baseURL,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/events/demo");
  await expect(page.locator(".pc-banner")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "下一步", exact: true }),
  ).toBeVisible();
  await page.goto("/events/demo/teams");
  await expect(
    page.getByRole("heading", { name: "招募大厅", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "我要开团", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(
    page,
    context,
    "/events/demo/register?next=" +
      encodeURIComponent("/events/demo/teams?intent=create"),
    "center-captain-" + Date.now() + "@example.com",
  );
  await register(page, "Captain");
  await expect(page).toHaveURL(/\/events\/demo\/teams/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("队伍名称", { exact: true }).fill("Orbit Crew");
  await dialog
    .getByLabel("队伍简介", { exact: true })
    .fill("Build useful things");
  await dialog
    .getByLabel("希望招募的技能", { exact: true })
    .fill("Design and TypeScript");
  await dialog
    .getByLabel("招募说明", { exact: true })
    .fill("Looking for a teammate");
  await dialog.getByLabel("人数上限", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/events/demo/my-team");
  await expect(
    page.getByRole("heading", { name: "Orbit Crew", exact: true }),
  ).toBeVisible();
  const other = await browser.newContext({ baseURL });
  const candidate = await other.newPage();
  try {
    await login(
      candidate,
      other,
      "/events/demo/register",
      "center-member-" + Date.now() + "@example.com",
    );
    await register(candidate, "Member");
    await candidate.goto("/events/demo/teams");
    await candidate
      .getByLabel("搜索队名或招募说明", { exact: true })
      .fill("Orbit Crew");
    await candidate
      .getByRole("button", { name: "申请加入", exact: true })
      .click();
    await candidate
      .getByRole("dialog")
      .getByLabel("我的技能", { exact: true })
      .fill("UX design");
    await candidate
      .getByRole("dialog")
      .getByLabel("申请说明", { exact: true })
      .fill("I would like to join.");
    await candidate
      .getByRole("button", { name: "提交申请", exact: true })
      .click();
    await expect(candidate.getByRole("dialog")).not.toBeVisible();
    await candidate.goto("/events/demo/applications");
    await expect(candidate.locator(".ev-badge")).toContainText("待处理");
    const publicResponse = await candidate.request.get(
      "/api/events/demo/teams",
    );
    const publicText = await publicResponse.text();
    expect(publicText).not.toContain("I would like to join.");
    expect(publicText).not.toContain("@example.com");
    await page.getByRole("button", { name: "刷新状态" }).click();
    await expect(
      page.getByRole("heading", { name: "待我审批 (1)" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "同意加入", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认操作", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "待我审批 (0)" }),
    ).toBeVisible();
    await candidate.goto("/events/demo/my-team");
    await expect(
      candidate.getByRole("heading", { name: "Orbit Crew", exact: true }),
    ).toBeVisible();
    await expect(
      candidate.getByRole("button", { name: "编辑队伍" }),
    ).toHaveCount(0);
    const state = await (
      await candidate.request.get("/api/events/demo/center")
    ).json();
    expect(
      (
        await candidate.request.post("/api/events/demo/center", {
          headers: { Origin: baseURL! },
          data: {
            action: "dissolve",
            teamId: state.team.id,
            revision: state.team.revision,
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post("/api/events/demo/center", {
          headers: { Origin: "https://foreign.example" },
          data: {
            action: "dissolve",
            teamId: state.team.id,
            revision: state.team.revision,
          },
        })
      ).status(),
    ).toBe(403);
    await candidate.goto("/events/demo/materials");
    await candidate
      .getByLabel(/^项目名称/)
      .fill("Personal project after joining");
    await candidate
      .getByRole("button", { name: "保存草稿", exact: true })
      .click();
    await expect(candidate.locator('.ev-success[role="status"]')).toContainText(
      "草稿已保存",
    );
    await candidate.goto("/events/demo/my-team");
    await candidate.getByRole("button", { name: "退出团队" }).click();
    await candidate
      .getByRole("dialog")
      .getByRole("button", { name: "确认操作", exact: true })
      .click();
    await expect(candidate.getByRole("dialog")).not.toBeVisible();
    await expect(candidate.getByText("你还没有加入团队。")).toBeVisible();
    await candidate.goto("/events/demo/materials");
    await expect(candidate.getByLabel(/^项目名称/)).toHaveValue(
      "Personal project after joining",
    );
    await page.getByRole("button", { name: "刷新状态" }).click();
    await page.getByRole("button", { name: "编辑队伍" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "编辑队伍" })).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath("team-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/events/demo");
    await page.locator(".pc-menu-toggle").click();
    await page
      .locator("#participant-nav")
      .getByRole("link", { name: "我的团队", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Orbit Crew" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(
      page.getByRole("heading", { name: "My team", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath("team-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "切换为中文" }).click();
    await page.getByRole("button", { name: "解散团队" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认操作", exact: true })
      .click();
    await expect(page.getByText("你还没有加入团队。")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await other.close();
  }
});
test("public browsing, unavailable windows, unknown activity and mobile keyboard", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/events/demo/center")).status()).toBe(401);
  expect((await request.get("/api/events/unknown/teams")).status()).toBe(404);
  await page.goto("/events/past-demo/teams");
  await expect(
    page.getByRole("heading", { name: "招募大厅", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.locator(".pc-menu-toggle").click();
  await expect(page.locator("#participant-nav")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#participant-nav")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
