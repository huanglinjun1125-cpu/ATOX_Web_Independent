import {
  test,
  expect,
  request,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedMaterialSubmission } from "../fixtures/material-submission";
import type {
  MaterialPayload,
  MaterialsDto,
} from "../../src/modules/event-participation/contracts";
import type { MaterialReviewDetail } from "../../src/modules/material-review/contracts";

type Identity = { id: string; email: string; token: string };
function identity(name: string): Identity {
  return JSON.parse(readFileSync(process.env.ADMIN_FIXTURE_FILE!, "utf8"))[
    name === "normal"
      ? "material-normal"
      : name === "network"
        ? "material-network"
        : name
  ];
}
async function signIn(
  context: BrowserContext,
  baseURL: string,
  name = "operator",
) {
  await context.addCookies([
    {
      name: "hackathon_session",
      value: identity(name).token,
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
async function api(baseURL: string, name: string) {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Cookie: `hackathon_session=${identity(name).token}`,
      Origin: new URL(baseURL).origin,
    },
  });
}
const submissions: Record<string, MaterialsDto> = {};
const payloads: Record<string, MaterialPayload> = {};
async function details(page: Page, id: string): Promise<MaterialReviewDetail> {
  const response = await page.request.get(`/api/admin/materials/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()).material;
}
async function review(page: Page) {
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认审核", exact: true })
    .click();
}
async function reloadLatest(page: Page) {
  await page.getByRole("button", { name: "读取最新状态", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "读取最新状态", exact: true })
    .click();
}

test.beforeAll(async ({ baseURL }) => {
  test.setTimeout(180_000);
  for (const name of [
    "normal",
    "network",
    ...Array.from({ length: 21 }, (_, i) => `fixture-${i}`),
  ]) {
    const client = await api(baseURL!, name);
    try {
      const seeded = await seedMaterialSubmission(client, name);
      submissions[name] = seeded.material;
      payloads[name] = seeded.payload;
    } finally {
      await client.dispose();
    }
  }
});

test("Material admin pages and private APIs reject anonymous and ordinary accounts", async ({
  page,
  context,
  baseURL,
}) => {
  expect((await page.request.get("/api/admin/materials")).status()).toBe(401);
  await page.goto("/admin/materials");
  await expect(page).toHaveURL(/login\?next=%2Fadmin%2Fmaterials$/);
  await signIn(context, baseURL!, "normal");
  await page.goto("/admin/materials");
  await expect(
    page.getByRole("heading", { name: "无权访问", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/materials")).status()).toBe(403);
  expect(
    (
      await page.request.get(`/api/admin/materials/${submissions.network.id}`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(
        `/api/events/demo/files/${payloads.network.documentId}`,
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(
        `/api/admin/materials/${submissions.network.id}/files/${payloads.network.documentId}`,
      )
    ).status(),
  ).toBe(403);
  const owner = await page.request.get("/api/events/demo/materials");
  expect(owner.status()).toBe(200);
  expect(await owner.json()).not.toHaveProperty("internalNote");
});

test("Operator list filters, pagination, bilingual state and mobile layouts", async ({
  page,
  context,
  baseURL,
}, info) => {
  await signIn(context, baseURL!);
  await page.goto("/admin/materials");
  const all = await (await page.request.get("/api/admin/materials")).json();
  expect(all.total).toBeGreaterThanOrEqual(23);
  await expect(page.locator("[data-material-id]")).toHaveCount(20);
  for (let pageNumber = 2; pageNumber <= all.totalPages; pageNumber++) {
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`page=${pageNumber}$`));
    await expect(page.locator("[data-material-id]")).toHaveCount(
      pageNumber === all.totalPages ? all.total - (pageNumber - 1) * 20 : 20,
    );
  }
  await page
    .getByRole("combobox", { name: "审核状态", exact: true })
    .selectOption("approved");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  const approved = await (
    await page.request.get("/api/admin/materials?status=approved")
  ).json();
  await expect(page.locator("[data-material-id]")).toHaveCount(
    approved.items.length,
  );
  await page
    .getByRole("combobox", { name: "审核状态", exact: true })
    .selectOption("pending");
  await page
    .getByRole("combobox", { name: "活动", exact: true })
    .selectOption("upcoming-demo");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page.locator("[data-material-id]")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "活动", exact: true })
    .selectOption("demo");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page.locator("[data-material-id]")).toHaveCount(20);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("materials-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("materials-mobile.png") });
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Participant material review",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Participant material review",
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("Rejection requires feedback; private notes and audit survive resubmission and approval", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const id = submissions.normal.id!;
  await page.goto(`/admin/materials/${id}`);
  await expect(
    page.getByRole("heading", { name: "Official normal", exact: true }).first(),
  ).toBeVisible();
  const attachment = await page.request.get(
    `/api/admin/materials/${id}/files/${payloads.normal.documentId}`,
  );
  expect(attachment.status()).toBe(200);
  expect(attachment.headers()["cache-control"]).toContain("no-store");
  await page.getByRole("radio", { name: "驳回", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "给选手的审核说明", exact: true })
    .fill("Please clarify the demo.");
  await page
    .getByRole("textbox", { name: "内部备注", exact: true })
    .fill("PRIVATE-M009-NOTE");
  await page.getByRole("button", { name: "提交审核", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "确认审核决定",
    exact: true,
  });
  await expect(dialog).toContainText("不会公开发布材料");
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeFocused();
  await review(page);
  await expect(
    page.getByRole("status").filter({ hasText: "审核决定已保存" }),
  ).toBeVisible();
  await expect(page.locator("[data-material-audit-id]")).toHaveCount(1);
  const owner = await api(baseURL!, "normal");
  try {
    const mine = await owner.get("/api/events/demo/materials");
    const current: MaterialsDto = await mine.json();
    expect(current.canEdit).toBe(true);
    expect(current.publicNote).toBe("Please clarify the demo.");
    expect(JSON.stringify(current)).not.toContain("PRIVATE-M009-NOTE");
    const payload = {
      ...payloads.normal,
      name: "Resubmitted normal",
      description: "Updated demonstration and clarified materials.",
    };
    const draft = await owner.put("/api/events/demo/materials/draft", {
      data: { revision: current.revision, payload },
    });
    expect(draft.status()).toBe(200);
    await reloadLatest(page);
    await expect(
      page
        .getByRole("heading", { name: "Official normal", exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("Resubmitted normal", { exact: true }),
    ).toHaveCount(0);
    const submit = await owner.post("/api/events/demo/materials/submit", {
      data: { revision: (await draft.json()).revision },
    });
    expect(submit.status()).toBe(200);
    await reloadLatest(page);
    await expect(
      page.getByRole("button", { name: "提交审核", exact: true }),
    ).toBeEnabled();
    await review(page);
    await expect(
      page.getByRole("status").filter({ hasText: "审核决定已保存" }),
    ).toBeVisible();
    await expect(page.locator("[data-material-audit-id]")).toHaveCount(2);
    const final = await details(page, id);
    expect(final.status).toBe("approved");
    expect(final.history[0].before?.status).toBe("pending");
    expect(final.history[0].after.status).toBe("approved");
  } finally {
    await owner.dispose();
  }
});

test("Concurrent review preserves stale input until a confirmed reload", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const id = submissions["fixture-0"].id!;
  await page.goto(`/admin/materials/${id}`);
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "驳回", exact: true }).check();
  await page
    .getByRole("textbox", { name: "给选手的审核说明", exact: true })
    .fill("MY-STALE-FEEDBACK");
  const old = await details(page, id);
  const other = await api(baseURL!, "other-super");
  try {
    const response = await other.post(`/api/admin/materials/${id}/decision`, {
      data: {
        revision: old.revision,
        submittedRevision: old.submittedRevision,
        action: "approved",
        reason: "Reviewed by another administrator",
        internalNote: "Other review",
      },
    });
    expect(response.status()).toBe(200);
  } finally {
    await other.dispose();
  }
  await review(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "当前输入已保留" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "给选手的审核说明", exact: true }),
  ).toHaveValue("MY-STALE-FEEDBACK");
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "读取最新状态", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: "给选手的审核说明", exact: true }),
  ).toHaveValue("MY-STALE-FEEDBACK");
  await reloadLatest(page);
  await expect(
    page.getByText("当前正式提交已处理；本阶段仅审核待审核的正式提交。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("[data-material-audit-id]")).toHaveCount(1);
});

test("Unknown network outcome is reconciled without repeating a committed decision", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const id = submissions.network.id!;
  await page.goto(`/admin/materials/${id}`);
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeVisible();
  let writes = 0;
  await page.route(`**/api/admin/materials/${id}/decision`, async (route) => {
    writes++;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await review(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "未能确认操作结果" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  await reloadLatest(page);
  await expect(
    page.getByText("当前正式提交已处理；本阶段仅审核待审核的正式提交。", {
      exact: true,
    }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.locator("[data-material-audit-id]")).toHaveCount(1);
});

test("An uncommitted server failure keeps input locked until the latest pending state is confirmed", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const id = submissions["fixture-1"].id!;
  await page.goto(`/admin/materials/${id}`);
  await page
    .getByRole("textbox", { name: "给选手的审核说明", exact: true })
    .fill("PRESERVED-FAILED-INPUT");
  let writes = 0;
  const pattern = `**/api/admin/materials/${id}/decision`;
  await page.route(pattern, async (route) => {
    writes++;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "INTERNAL_ERROR" }),
    });
  });
  await review(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "未能确认操作结果" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "给选手的审核说明", exact: true }),
  ).toHaveValue("PRESERVED-FAILED-INPUT");
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeDisabled();
  await reloadLatest(page);
  await expect(
    page.getByRole("button", { name: "提交审核", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "给选手的审核说明", exact: true }),
  ).toHaveValue("");
  expect(writes).toBe(1);
  await expect(page.locator("[data-material-audit-id]")).toHaveCount(0);
  await page.unroute(pattern);
  await review(page);
  await expect(
    page.getByRole("status").filter({ hasText: "审核决定已保存" }),
  ).toBeVisible();
  await expect(page.locator("[data-material-audit-id]")).toHaveCount(1);
});
