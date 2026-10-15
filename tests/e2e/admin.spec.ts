import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type {
  AdminPage,
  AdministratorDto,
} from "../../src/modules/admin/contracts";

type Fixture = { id: string; email: string; token: string };
function identity(name: string): Fixture {
  return JSON.parse(readFileSync(process.env.ADMIN_FIXTURE_FILE!, "utf8"))[
    name
  ];
}
async function signIn(
  context: BrowserContext,
  baseURL: string,
  name = "super",
) {
  const value = identity(name);
  await context.addCookies([
    {
      name: "hackathon_session",
      value: value.token,
      domain: new URL(baseURL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return value;
}
async function record(page: Page, id: string): Promise<AdministratorDto> {
  let pageNumber = 1;
  while (true) {
    const response = await page.request.get(
      `/api/admin/administrators?page=${pageNumber}`,
    );
    expect(response.status()).toBe(200);
    const value: AdminPage<AdministratorDto> = await response.json();
    const found = value.items.find((item) => item.userId === id);
    if (found) return found;
    if (++pageNumber > value.totalPages)
      throw new Error("Administrator not found");
  }
}
function headers(baseURL: string) {
  return { Origin: new URL(baseURL).origin };
}

test("Anonymous and ordinary users cannot access admin data or grant themselves roles", async ({
  page,
  context,
  baseURL,
}) => {
  for (const path of ["me", "administrators", "audit"]) {
    const response = await page.request.get(`/api/admin/${path}`);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  await page.goto("/admin/audit");
  await expect(page).toHaveURL(/login\?next=%2Fadmin%2Faudit$/);
  await signIn(context, baseURL!, "normal");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "无权访问", exact: true }),
  ).toBeVisible();
  const forged = await page.request.post("/api/admin/administrators", {
    headers: headers(baseURL!),
    data: { email: identity("normal").email, role: "super_admin" },
  });
  expect(forged.status()).toBe(403);
  for (const path of ["me", "administrators", "audit"])
    expect((await page.request.get(`/api/admin/${path}`)).status()).toBe(403);
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "管理后台", exact: true }),
  ).toHaveCount(0);
});

test("Email login returns to admin and an operator cannot manage permissions", async ({
  page,
  context,
}) => {
  await page.goto("/admin/administrators");
  await expect(page).toHaveURL(/login\?next=%2Fadmin%2Fadministrators$/);
  const email = identity("operator").email;
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByLabel("6 位验证码")).toBeVisible();
  const mail = await context.newPage();
  await mail.goto("/dev/mail");
  const body = await mail
    .locator("article")
    .filter({ hasText: email })
    .first()
    .locator("pre")
    .innerText();
  await mail.close();
  await page.getByLabel("6 位验证码").fill(body.match(/\b\d{6}\b/)![0]);
  await page.getByRole("button", { name: "验证并登录" }).click();
  await expect(page).toHaveURL("/admin/administrators");
  await expect(
    page.getByRole("heading", { name: "无权访问", exact: true }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "管理权限已开通" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "管理后台", exact: true }),
  ).toBeVisible();
  for (const path of ["administrators", "audit"])
    expect((await page.request.get(`/api/admin/${path}`)).status()).toBe(403);
  expect((await page.request.get("/api/events/demo/review")).status()).toBe(
    200,
  );
  await page.goto("/admin/audit");
  await expect(
    page.getByRole("heading", { name: "无权访问", exact: true }),
  ).toBeVisible();
});

test("Super admin navigation, pagination, bilingual refresh and responsive layout", async ({
  page,
  context,
  baseURL,
}, info) => {
  await signIn(context, baseURL!);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.getByRole("link", { name: "管理后台", exact: true }).click();
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/administrators");
  await expect(page.locator("[data-admin-user-id]")).toHaveCount(20);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator("[data-admin-user-id]")).toHaveCount(4);
  await page.goto("/admin/audit");
  await expect(page.locator("[data-admin-audit-id]")).toHaveCount(20);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator("[data-admin-audit-id]")).toHaveCount(4);
  await expect(
    page.locator("[data-admin-audit-id]").filter({ hasText: "受控初始化" }),
  ).toHaveCount(1);
  await page.goto("/admin/administrators");
  await expect(page.locator("[data-admin-user-id]")).toHaveCount(20);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(
    page.getByRole("button", { name: "后台菜单", exact: false }),
  ).toBeHidden();
  await page.screenshot({ path: info.outputPath("admin-desktop.png") });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath("admin-mobile.png") });
  await page.getByRole("button", { name: "后台菜单", exact: false }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "后台菜单", exact: false }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "Grant admin access", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Grant admin access", exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Grant, stale edits, confirmed reload, disabling and restoring preserve roles and audit", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  const target = identity("normal");
  await page.goto("/admin/administrators");
  await page.getByLabel("已有账号邮箱").fill(target.email);
  const grant = page.getByRole("button", {
    name: "授予管理员权限",
    exact: true,
  });
  await grant.click();
  await expect(
    page.getByRole("dialog", { name: "确认权限变更" }),
  ).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(grant).toBeFocused();
  expect((await page.request.get("/api/admin/administrators")).status()).toBe(
    200,
  );
  await grant.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认操作", exact: true })
    .dblclick();
  await expect(
    page.getByRole("status").filter({ hasText: "权限已保存" }),
  ).toBeVisible();
  const card = page.locator(`[data-admin-user-id="${target.id}"]`);
  await card.getByRole("button", { name: "调整权限" }).click();
  await page
    .getByRole("combobox", { name: "角色", exact: true })
    .selectOption("super_admin");
  const original = await record(page, target.id);
  const otherContext = await browser.newContext();
  await signIn(otherContext, baseURL!, "other-super");
  const other = await otherContext.request.patch(
    `/api/admin/administrators/${target.id}`,
    {
      headers: headers(baseURL!),
      data: { role: "operator", enabled: false, revision: original.revision },
    },
  );
  expect(other.status()).toBe(200);
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认操作", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "当前输入已保留" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "角色", exact: true }),
  ).toHaveValue("super_admin");
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "读取最新状态", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "读取最新状态", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "已核实最新记录" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "角色", exact: true }),
  ).toHaveValue("operator");
  await page.getByRole("checkbox", { name: "启用", exact: true }).check();
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认操作", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "权限已保存" }),
  ).toBeVisible();
  const targetContext = await browser.newContext();
  await signIn(targetContext, baseURL!, "normal");
  expect((await targetContext.request.get("/api/admin/me")).status()).toBe(200);
  const current = await record(page, target.id);
  const disabled = await page.request.patch(
    `/api/admin/administrators/${target.id}`,
    {
      headers: headers(baseURL!),
      data: { role: "operator", enabled: false, revision: current.revision },
    },
  );
  expect(disabled.status()).toBe(200);
  expect((await targetContext.request.get("/api/admin/me")).status()).toBe(403);
  expect((await targetContext.request.get("/api/auth/me")).status()).toBe(200);
  const logs = await (await page.request.get("/api/admin/audit")).json();
  const latest = logs.items.find(
    (item: { targetUserId: string }) => item.targetUserId === target.id,
  );
  expect(latest.before.enabled).toBe(true);
  expect(latest.after.enabled).toBe(false);
  expect(latest.actor.label).toBe(identity("super").email);
  await otherContext.close();
  await targetContext.close();
});

test("Server rejects cross-origin writes, unknown fields and self-demotion without extra audits", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await signIn(context, baseURL!);
  const current = await record(page, user.id);
  const auditBefore = await (await page.request.get("/api/admin/audit")).json();
  const badOrigin = await page.request.patch(
    `/api/admin/administrators/${user.id}`,
    {
      headers: { Origin: "https://elsewhere.example" },
      data: { role: "operator", enabled: true, revision: current.revision },
    },
  );
  expect(badOrigin.status()).toBe(403);
  const demotion = await page.request.patch(
    `/api/admin/administrators/${user.id}`,
    {
      headers: headers(baseURL!),
      data: { role: "operator", enabled: true, revision: current.revision },
    },
  );
  expect(demotion.status()).toBe(409);
  expect((await demotion.json()).error).toBe("SELF_CHANGE_FORBIDDEN");
  const escalation = await page.request.post("/api/admin/administrators", {
    headers: headers(baseURL!),
    data: { email: "new@example.com", role: "super_admin", userId: user.id },
  });
  expect(escalation.status()).toBe(400);
  expect(
    (await (await page.request.get("/api/admin/audit")).json()).total,
  ).toBe(auditBefore.total);
});

test("A lost grant response blocks repeat writes and reconciles the existing record", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(context, baseURL!);
  await page.goto("/admin/administrators");
  const target = identity("network");
  let writes = 0;
  await page.route("**/api/admin/administrators", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    writes++;
    await route.fetch();
    await route.abort("failed");
  });
  await page.getByLabel("已有账号邮箱").fill(target.email);
  await page
    .getByRole("button", { name: "授予管理员权限", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认操作", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "已停止重复提交" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "授予管理员权限", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("已有账号邮箱")).toHaveValue(target.email);
  await page.getByRole("button", { name: "读取最新状态", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "读取最新状态", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "已核实最新记录" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存修改", exact: true }),
  ).toBeDisabled();
  expect(writes).toBe(1);
  const current = await record(page, target.id);
  expect(current.revision).toBe(1);
  expect(current.role).toBe("operator");
});
