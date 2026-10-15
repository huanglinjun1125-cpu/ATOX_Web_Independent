import { test, expect, request, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { EventDefinition } from "../../src/modules/event-board/contracts";
import type {
  ContentRecord,
  HomepageContent,
} from "../../src/modules/content-management/contracts";
function token(name: string) {
  if (name === "normal") name = "content-normal";
  return JSON.parse(readFileSync(process.env.ADMIN_FIXTURE_FILE!, "utf8"))[name]
    .token as string;
}
async function signIn(
  context: BrowserContext,
  baseURL: string,
  name = "operator",
) {
  await context.addCookies([
    {
      name: "hackathon_session",
      value: token(name),
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("content permissions and same-origin protection", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!, "normal");
  expect((await page.request.get("/api/admin/content/events")).status()).toBe(
    403,
  );
  await page.goto("/admin/events");
  await expect(page.getByRole("heading", { name: "无权访问" })).toBeVisible();
  const client = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: `hackathon_session=${token("operator")}`,
      Origin: "https://outside.example",
    },
  });
  try {
    expect(
      (
        await client.post("/api/admin/content/events", {
          data: { id: "external-attempt" },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await client.dispose();
  }
});
test("event draft preview publication windows and withdrawal preserve records", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const id = "content-browser-event";
  await page.goto("/admin/events");
  await page.getByLabel("活动标识（小写字母、数字、连字符）").fill(id);
  await page.getByRole("button", { name: "新建草稿", exact: true }).click();
  await page
    .getByRole("link", { name: "编辑活动" })
    .filter({ hasText: "编辑活动" })
    .last()
    .waitFor();
  await page.goto("/admin/events/" + id);
  const url = "/api/admin/content/events/" + id;
  let record = (await (await page.request.get(url)).json())
    .content as ContentRecord<EventDefinition>;
  expect(record.state).toBe("draft");
  expect((await page.request.get("/api/events/" + id)).status()).toBe(404);
  const draft = structuredClone(record.draft);
  draft.name = { zh: "浏览器活动发布测试", en: "Browser publication test" };
  draft.startsAt = "2027-02-01T09:00:00+08:00";
  draft.endsAt = "2027-02-02T09:00:00+08:00";
  draft.registrationOpensAt = "2026-10-01T00:00:00+08:00";
  draft.registrationClosesAt = "2027-01-01T00:00:00+08:00";
  const saved = await page.request.put(url, {
    headers: { Origin: new URL(baseURL!).origin },
    data: { revision: record.revision, action: "save", draft },
  });
  expect(saved.status()).toBe(200);
  record = (await saved.json()).content;
  expect((await page.request.get("/api/events/" + id)).status()).toBe(404);
  await page.goto("/admin/events/" + id + "/preview");
  await expect(page.getByText("浏览器活动发布测试").first()).toBeVisible();
  await page.goto("/admin/events/" + id);
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("操作成功");
  const publicConfig = await (
    await page.request.get("/api/events/" + id)
  ).json();
  expect(publicConfig.startsAt).toBe(draft.startsAt);
  expect(publicConfig.registrationClosesAt).toBe(draft.registrationClosesAt);
  await page.getByRole("button", { name: "下架", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect
    .poll(async () => (await page.request.get("/api/events/" + id)).status())
    .toBe(404);
  expect((await page.request.get("/events/" + id)).status()).toBe(404);
  const retained = (await (await page.request.get(url)).json()).content;
  expect(retained.draft.name.zh).toBe(draft.name.zh);
  expect(retained.live.name.zh).toBe(draft.name.zh);
  expect(retained.state).toBe("withdrawn");
});
test("homepage draft isolated preview publish and baseline fallback", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const baseline = await (await page.request.get("/")).text();
  const url = "/api/admin/content/homepage";
  let record = (await (await page.request.get(url)).json())
    .content as ContentRecord<HomepageContent>;
  const draft = structuredClone(record.draft);
  draft.text.heroLineOne = {
    zh: "独立草稿发布验证",
    en: "Isolated draft publication",
  };
  const saved = await page.request.put(url, {
    headers: { Origin: new URL(baseURL!).origin },
    data: { revision: record.revision, action: "save", draft },
  });
  expect(saved.status()).toBe(200);
  record = (await saved.json()).content;
  expect(await (await page.request.get("/")).text()).not.toContain(
    "独立草稿发布验证",
  );
  await page.goto("/admin/content/homepage/preview");
  await expect(page.getByText("独立草稿发布验证").first()).toBeVisible();
  await page.goto("/admin/content/homepage");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await (await page.request.get("/")).text()).includes("独立草稿发布验证"),
    )
    .toBe(true);
  await page.getByRole("button", { name: "下架", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await (await page.request.get("/")).text()).includes("独立草稿发布验证"),
    )
    .toBe(false);
  expect(baseline).not.toContain("独立草稿发布验证");
});
test("conflict retains inputs locks writes and mobile bilingual content", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/content/homepage");
  const field = page
    .getByRole("group", { name: "首屏第一行", exact: true })
    .getByLabel("中文");
  await field.fill("保留未保存输入");
  await page.route("**/api/admin/content/homepage", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "REVISION_CONFLICT" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(field).toHaveValue("保留未保存输入");
  await expect(
    page.getByRole("button", { name: "保存草稿", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("输入已保留");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Homepage content" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Hero line one", exact: true })
      .getByLabel("中文"),
  ).toHaveValue("保留未保存输入");
});
