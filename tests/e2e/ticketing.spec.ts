import { test, expect, type Page, type BrowserContext } from "@playwright/test";
const root = "/preview/ticketing/demo";
const api = "/api/preview/ticketing/demo";
test.setTimeout(90_000);
async function finishLogin(page: Page, context: BrowserContext, email: string) {
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
  await expect(page).toHaveURL(/\/preview\/ticketing\/demo\/checkout/);
}
async function fill(page: Page) {
  await page.getByLabel(/^姓名/).fill("Browser Ticket Buyer");
  await page.getByLabel(/^国家 \/ 地区/).fill("China");
  await page.getByLabel(/^你从哪里/).selectOption("community");
  await page.getByRole("checkbox", { name: "学习交流", exact: true }).check();
  await page.getByLabel(/^备注/).fill("Preserve this questionnaire");
  await page.getByRole("checkbox", { name: /^我已阅读并同意/ }).check();
}
async function create(page: Page) {
  await expect(
    page.getByRole("button", { name: /确认订单并模拟支付/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "确认订单并模拟支付" }),
  ).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith(api + "/orders") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "确认订单并模拟支付" }).click(),
  ]);
  expect(response.status()).toBe(200);
  const order = await response.json();
  await expect(page).toHaveURL(new RegExp("orderId=" + order.id));
  await expect(page.getByText("支付处理中", { exact: true })).toBeVisible();
  return order;
}
test("Ticket selection survives email login; questionnaire survives editing; failed and unknown payments recover to one paid order", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(root);
  await page.getByRole("radio", { name: /标准票/ }).check();
  await page.getByLabel("购买数量").fill("2");
  await page.getByRole("button", { name: "登录并继续" }).click();
  await finishLogin(page, context, `ticket-browser-${Date.now()}@example.com`);
  await expect(page).toHaveURL(/ticketId=standard&quantity=2/);
  await fill(page);
  await page.getByRole("button", { name: "修改票种或数量" }).click();
  await expect(page).toHaveURL(/\/preview\/ticketing\/demo\?/);
  await expect(page.getByLabel("购买数量")).toHaveValue("2");
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByLabel(/^姓名/)).toHaveValue("Browser Ticket Buyer");
  await expect(page.getByLabel(/^备注/)).toHaveValue(
    "Preserve this questionnaire",
  );
  const order = await create(page);
  expect(order.totalAmount).toBe(19800);
  await page.goto(root + "/checkout?ticketId=standard&quantity=2");
  await expect(page.getByLabel(/^姓名/)).toHaveValue("Browser Ticket Buyer");
  await page.getByRole("link", { name: /继续处理已有订单/ }).click();
  await expect(page).toHaveURL(new RegExp("orderId=" + order.id));
  await expect(page.getByText(/预留倒计时/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^姓名/)).toHaveValue("Browser Ticket Buyer");
  await expect(page.getByLabel(/^姓名/)).toBeDisabled();
  await expect(page.getByRole("button", { name: "继续模拟支付" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "模拟失败", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "继续模拟支付" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续模拟支付" }).click();
  await page.getByRole("button", { name: "模拟未知结果" }).click();
  await expect(page.getByText(/支付结果尚未确定/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "继续模拟支付" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "模拟成功", exact: true }).click();
  await expect(page.getByText("模拟购票成功", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "模拟重复回调" }).click();
  const actual = await (
    await page.request.get(api + "/orders/" + order.id)
  ).json();
  expect(actual.status).toBe("paid");
  expect(actual.quantity).toBe(2);
  await page.screenshot({
    path: "test-results/ticketing-checkout-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/ticketing-checkout-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText("模拟购票成功", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Changing selection closes unpaid order; late payment requires reconciliation and order IDs do not bypass ownership", async ({
  page,
  context,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root + "/checkout?ticketId=early&quantity=1");
  await finishLogin(page, context, `ticket-late-${Date.now()}@example.com`);
  await fill(page);
  const order = await create(page);
  await page.getByRole("button", { name: "修改票种或数量" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "修改票种或数量" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "修改票种或数量" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认关闭并修改" })
    .click();
  await expect(page).toHaveURL(/\/preview\/ticketing\/demo\?/);
  await page.goto(root + "/checkout?orderId=" + order.id);
  await expect(page.locator(".tk-order-state")).toHaveText("订单已关闭");
  await page.getByText("开发模拟支付面板", { exact: true }).click();
  await page.getByRole("button", { name: "模拟迟到成功" }).click();
  await expect(
    page.getByText(/需要人工核对；当前不代表购票成功/),
  ).toBeVisible();
  await expect(page.getByText("模拟购票成功", { exact: true })).toHaveCount(0);
  expect((await request.get(api + "/orders/" + order.id)).status()).toBe(401);
  const other = await context
    .browser()!
    .newContext({ baseURL: test.info().project.use.baseURL });
  try {
    const another = await other.newPage();
    await another.goto(root + "/checkout?ticketId=standard&quantity=1");
    await finishLogin(another, other, `ticket-other-${Date.now()}@example.com`);
    expect(
      (await another.request.get(api + "/orders/" + order.id)).status(),
    ).toBe(403);
  } finally {
    await other.close();
  }
});

test("Independent preview is bilingual and mobile; user operations and notification signatures are protected", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(root);
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
    path: "test-results/ticketing-mobile.png",
    fullPage: true,
  });
  expect(
    (
      await request.post(api + "/quote", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {},
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post(api + "/orders", {
        headers: { Origin: "https://foreign.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post(api + "/payments/notify", { data: {} })).status(),
  ).toBe(403);
  await page.goto("/");
  const ticketEntry = page.locator(".sn-ticketing-link");
  await expect(ticketEntry).toBeHidden();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(ticketEntry).toBeVisible();
  await expect(ticketEntry).toHaveAttribute("href", "/preview/ticketing/demo");
});
