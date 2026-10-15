import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

test.setTimeout(120_000);

async function login(
  page: Page,
  context: BrowserContext,
  email: string,
  target: string,
) {
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByLabel("6 位验证码")).toBeVisible();
  const mailbox = await context.newPage();
  await mailbox.goto("/dev/mail");
  const text = await mailbox
    .locator("article")
    .filter({ hasText: email })
    .first()
    .locator("pre")
    .innerText();
  const code = text.match(/\b\d{6}\b/)![0];
  await mailbox.close();
  await page.getByLabel("6 位验证码").fill(code);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page).toHaveURL(new RegExp(target.replace(/\//g, "\\/") + "$"));
}

async function register(page: Page) {
  await page.goto("/events/demo/register");
  await page.getByLabel(/^姓名/).fill("Browser Builder");
  await page.getByLabel(/^参赛角色/).selectOption("developer");
  await page.getByLabel(/^国家 \/ 地区/).fill("China");
  await page.locator("#reg-terms").check();
  await page.getByRole("button", { name: "确认报名" }).click();
  await expect(page.getByRole("heading", { name: "报名成功" })).toBeVisible();
  await page.getByRole("link", { name: "前往材料提交" }).click();
  await expect(page.getByRole("heading", { name: "项目材料" })).toBeVisible();
}

test("User registers and submits; reviewer requests changes then processes latest materials", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const address = `event-browser-${Date.now()}@example.com`;
  await login(page, context, address, "/events/demo/materials");
  await expect(
    page.getByRole("link", { name: "先完成个人报名" }),
  ).toBeVisible();
  await register(page);
  expect((await page.request.get("/api/events/demo/review")).status()).toBe(
    403,
  );
  expect(
    (
      await page.request.put("/api/events/demo/materials/draft", {
        headers: { Origin: "https://foreign.example" },
        data: { revision: 0, payload: {} },
      })
    ).status(),
  ).toBe(403);
  await page.getByLabel(/^项目名称/).fill("Browser Test Project");
  await page.getByLabel(/^一句话介绍/).fill("A useful demo project");
  await page
    .getByLabel(/^项目介绍/)
    .fill("This project demonstrates the submission workflow.");
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#a688ff" },
  })
    .png()
    .toBuffer();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await page
    .getByLabel("项目封面", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: image });
  await expect(
    page.getByRole("link", { name: "cover.png" }).first(),
  ).toBeVisible();
  await page.getByLabel("项目说明 PDF", { exact: true }).setInputFiles({
    name: "project.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.getByRole("link", { name: "project.pdf" }).first(),
  ).toBeVisible();
  await page.locator("#material-original").check();
  await page.locator("#material-usageAuthorized").check();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿");
  expect(
    (await (await page.request.get("/api/events/demo/materials")).json())
      .official,
  ).toBeNull();
  await page.getByRole("button", { name: "保存并正式提交" }).click();
  await expect(page.getByRole("status")).toContainText("正式提交");
  let materials = await (
    await page.request.get("/api/events/demo/materials")
  ).json();
  expect(materials.status).toBe("pending");
  expect(materials.draft).toBeNull();
  const document = materials.assets.find(
    (asset: { purpose: string }) => asset.purpose === "document",
  );
  const downloaded = await page.request.get(document.url);
  expect(downloaded.status()).toBe(200);
  expect(downloaded.headers()["content-disposition"]).toContain("attachment");
  expect(downloaded.headers()["cache-control"]).toContain("no-store");

  const reviewerContext = await browser.newContext({ baseURL });
  try {
    const reviewer = await reviewerContext.newPage();
    const admin = JSON.parse(
      readFileSync(process.env.ADMIN_FIXTURE_FILE!, "utf8"),
    ).operator;
    await reviewerContext.addCookies([
      {
        name: "hackathon_session",
        value: admin.token,
        domain: new URL(baseURL!).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await reviewer.goto("/review/events/demo");
    let card = reviewer.locator(".ev-review-card").filter({ hasText: address });
    await card
      .getByLabel("给参赛者的审核意见（必填）")
      .fill("Please clarify the project description.");
    await card
      .getByLabel("内部备注（仅审核人员可见，选填）")
      .fill("SECRET-INTERNAL-REVIEW");
    await card.getByRole("radio", { name: "需补充", exact: true }).check();
    await card.getByRole("button", { name: "提交审核决定" }).click();
    await expect(card.locator(".ev-status-row")).toContainText("驳回");
    await page.reload();
    await expect(
      page.getByText("Please clarify the project description.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain(
      "SECRET-INTERNAL-REVIEW",
    );
    expect(
      JSON.stringify(
        await (await page.request.get("/api/events/demo/materials")).json(),
      ),
    ).not.toContain("SECRET-INTERNAL-REVIEW");
    // A rejected review is final for that formal revision. Resubmit before
    // starting another review; the administrator must not edit that decision.
    await page.getByLabel(/^项目介绍/).fill("Clarified after rejection.");
    await page.getByRole("button", { name: "保存并正式提交" }).click();
    await expect(page.getByRole("status")).toContainText("正式提交");
    await reviewer.getByRole("button", { name: "刷新列表" }).click();
    card = reviewer.locator(".ev-review-card").filter({ hasText: address });
    await card
      .getByLabel("给参赛者的审核意见（必填）")
      .fill("Keep my unsent review note");
    await page
      .getByLabel(/^项目介绍/)
      .fill("Updated, clarified project description.");
    await page.getByRole("button", { name: "保存并正式提交" }).click();
    await expect(page.getByRole("status")).toContainText("正式提交");
    await reviewer.getByRole("button", { name: "刷新列表" }).click();
    card = reviewer.locator(".ev-review-card").filter({ hasText: address });
    await expect(card).toContainText("Updated, clarified project description.");
    await expect(card.getByLabel("给参赛者的审核意见（必填）")).toHaveValue(
      "Keep my unsent review note",
    );
    await expect(
      card.getByRole("button", { name: "提交审核决定" }),
    ).toBeDisabled();
    reviewer.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "丢弃本地修改并重新加载" }).click();
    await card
      .getByLabel("给参赛者的审核意见（必填）")
      .fill("Materials received.");
    await card.getByRole("radio", { name: "已受理", exact: true }).check();
    await card.getByRole("button", { name: "提交审核决定" }).click();
    await expect(card.locator(".ev-status-row")).toContainText("通过");
    await page.reload();
    await expect(
      page.getByText("Materials received.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "保存草稿", exact: true }),
    ).toHaveCount(0);
    materials = await (
      await page.request.get("/api/events/demo/materials")
    ).json();
    expect(materials.status).toBe("processed");
    expect(materials.result).toBe("accepted");
    expect(materials.submittedRevision).toBe(3);
  } finally {
    await reviewerContext.close();
  }
  expect(errors).toEqual([]);
});

test("Old browser tabs preserve local input on revision conflicts", async ({
  page,
  context,
}) => {
  await login(
    page,
    context,
    `conflict-${Date.now()}@example.com`,
    "/events/demo/register",
  );
  await register(page);
  const other = await context.newPage();
  await other.goto("/events/demo/materials");
  await page.getByLabel(/^项目名称/).fill("Latest saved draft");
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿");
  await other.getByLabel(/^项目名称/).fill("Preserve my local edits");
  other.once("dialog", (dialog) => dialog.dismiss());
  await other.getByRole("link", { name: "赛事大厅", exact: true }).click();
  await expect(other).toHaveURL(/\/events\/demo\/materials$/);
  await expect(other.getByLabel(/^项目名称/)).toHaveValue(
    "Preserve my local edits",
  );
  await other.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(other.locator('.event-module [role="alert"]')).toContainText(
    "本地输入已保留",
  );
  await expect(other.getByLabel(/^项目名称/)).toHaveValue(
    "Preserve my local edits",
  );
  const latest = await (
    await page.request.get("/api/events/demo/materials")
  ).json();
  expect(latest.draft.name).toBe("Latest saved draft");
});

test("Public event is bilingual and mobile, while user/reviewer APIs require identity", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/events/demo");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "演示活动",
  );
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Demo Event",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/event-mobile.png",
    fullPage: true,
  });
  for (const endpoint of ["participation", "materials", "review"]) {
    expect((await request.get(`/api/events/demo/${endpoint}`)).status()).toBe(
      401,
    );
  }
  expect((await request.get("/api/events/demo")).status()).toBe(200);
});
