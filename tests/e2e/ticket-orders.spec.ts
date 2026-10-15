import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
const root = "/preview/ticketing/demo";
const api = "/api/preview/ticketing/demo";
test("Menu, login return, historical orders, status refresh, pagination and payment recovery", async ({
  page,
  context,
  baseURL,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "购票（模拟）", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "打开菜单", exact: true }).click();
  await page.getByRole("link", { name: "购票（模拟）", exact: true }).click();
  await expect(page).toHaveURL(root);
  await page.getByRole("link", { name: "我的订单", exact: true }).click();
  await expect(page).toHaveURL(
    /login\?next=%2Fpreview%2Fticketing%2Fdemo%2Forders$/,
  );
  const email = `orders-${Date.now()}@example.com`;
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
  await expect(page).toHaveURL(root + "/orders");
  await expect(page.getByRole("heading", { name: "还没有订单" })).toBeVisible();
  const post = async (path: string, data = {}) => {
    const response = await page.request.post(api + path, {
      headers: { Origin: new URL(baseURL!).origin },
      data,
    });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const create = async () => {
    const input = {
      ticketId: "standard",
      quantity: 1,
      answers: {
        displayName: "Order Buyer",
        country: "China",
        source: "community",
        purposes: ["learn"],
        notes: "private questionnaire",
        acceptedPolicy: true,
      },
    };
    const quote = await post("/quote", input);
    return post("/orders", {
      ...input,
      quoteVersion: quote.quoteVersion,
      idempotencyKey: randomUUID(),
    });
  };
  let lateId = "";
  for (let i = 0; i < 12; i++) {
    const order = await create();
    if (i === 0) {
      lateId = order.id;
      await post(`/orders/${order.id}/payments`);
    }
    await post(`/orders/${order.id}/close`);
    if (i === 0)
      await post(`/orders/${order.id}/simulate`, { action: "late_success" });
  }
  const paid = await create();
  await post(`/orders/${paid.id}/payments`);
  await post(`/orders/${paid.id}/simulate`, { action: "success" });
  const pending = await create();
  await page.getByRole("button", { name: "刷新列表", exact: true }).click();
  await expect(page.locator(".tk-order-card")).toHaveCount(10);
  await expect(page.locator(".tk-order-count")).toHaveText("14 笔订单");
  const card = page.locator(`[data-order-id="${pending.id}"]`);
  await expect(card.locator(".tk-order-state")).toHaveText("待支付");
  await card.getByRole("link", { name: /继续支付/ }).click();
  await expect(page).toHaveURL(new RegExp(`orderId=${pending.id}$`));
  await expect(
    page.getByRole("button", { name: "继续模拟支付", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "我的订单", exact: true }).click();
  await post(`/orders/${pending.id}/payments`);
  await post(`/orders/${pending.id}/simulate`, { action: "unknown" });
  await page.getByRole("button", { name: "刷新列表", exact: true }).click();
  await expect(card.locator(".tk-order-state")).toHaveText("确认中");
  await expect(card.getByRole("link", { name: /继续支付/ })).toHaveCount(0);
  await expect(
    page.locator(`[data-order-id="${paid.id}"] .tk-order-state`),
  ).toHaveText("已支付");
  await page.screenshot({
    path: info.outputPath("orders-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/orders\?page=2$/);
  await expect(page.locator(".tk-order-card")).toHaveCount(4);
  await expect(
    page.locator(`[data-order-id="${lateId}"] .tk-order-state`),
  ).toHaveText("待对账");
  await page.reload();
  await expect(page.locator(".tk-order-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My orders");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".tk-order-card")).toHaveCount(4);
  await expect(
    page.locator(`[data-order-id="${lateId}"] .tk-order-state`),
  ).toHaveText("Reconciliation required");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("orders-mobile.png"),
    fullPage: true,
  });
  const response = await page.request.get(api + "/orders");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const data = await response.json();
  for (const order of data.orders) {
    expect(order).not.toHaveProperty("email");
    expect(order).not.toHaveProperty("answers");
    expect(order).not.toHaveProperty("providerTransactionId");
  }
  expect(
    (await page.request.get(api + "/orders?userId=someone-else")).status(),
  ).toBe(400);
  expect((await page.request.get(api + "/orders?page=-1")).status()).toBe(400);
  await page.route("**/api/preview/ticketing/demo/orders?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"UNAVAILABLE"}',
    }),
  );
  await page.getByRole("button", { name: "Refresh list", exact: true }).click();
  await expect(page.locator(".tk-orders").getByRole("alert")).toContainText(
    "could not be loaded",
  );
  await page.unroute("**/api/preview/ticketing/demo/orders?*");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".tk-order-card")).toHaveCount(4);
  await context.clearCookies();
  expect((await page.request.get(api + "/orders")).status()).toBe(401);
  await page.getByRole("button", { name: "Refresh list", exact: true }).click();
  await expect(page).toHaveURL(
    /login\?next=%2Fpreview%2Fticketing%2Fdemo%2Forders%3Fpage%3D2$/,
  );
  expect(errors).toEqual([]);
});
