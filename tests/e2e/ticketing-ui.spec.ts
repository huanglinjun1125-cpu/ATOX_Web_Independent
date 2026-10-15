import { test, expect, type Page, type BrowserContext } from "@playwright/test";
const root = "/preview/ticketing/demo";
const api = "/api/preview/ticketing/demo";
test.setTimeout(90000);
async function login(page: Page, context: BrowserContext) {
  await page.goto(root + "/checkout?ticketId=standard&quantity=1");
  const email = `ticket-ui-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
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
  await expect(page).toHaveURL(/checkout\?ticketId=standard&quantity=1/);
  await page.getByLabel(/^姓名/).fill("UI Buyer");
  await page.getByLabel(/^国家 \/ 地区/).fill("China");
  await page.getByLabel(/^你从哪里/).selectOption("community");
  await page.getByRole("checkbox", { name: "学习交流", exact: true }).check();
}
const confirm = (page: Page) =>
  page.getByRole("button", { name: /确认订单并模拟支付/ });
const agreement = (page: Page) =>
  page.getByRole("checkbox", { name: /^我已阅读并同意/ });

test("Shared dark navigation, debounced quotes, stale response isolation and quote retry", async ({
  page,
  context,
}, info) => {
  await login(page, context);
  const header = page.locator(".site-header");
  await expect(header).toContainText("HACKATHON");
  await expect(header.getByRole("link", { name: /我的账户/ })).toBeVisible();
  await expect(page.locator(".tk-header, .tk-language")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "查看报价并确认" }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".tk-card")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(26, 26, 32)");
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    firstStarted = resolve;
  });
  await page.route("**/api/preview/ticketing/demo/quote", async (route) => {
    calls++;
    if (calls === 1) {
      const response = await route.fetch();
      const quote = await response.json();
      firstStarted();
      await gate;
      await route
        .fulfill({ json: { ...quote, totalAmount: 77700 } })
        .catch(() => {});
    } else await route.continue();
  });
  await page.getByLabel(/^备注/).fill("first");
  await agreement(page).check();
  await started;
  await expect(confirm(page)).toBeDisabled();
  await page.getByLabel(/^备注/).fill("second");
  await page.getByLabel(/^备注/).fill("latest");
  await expect(confirm(page)).toBeEnabled();
  expect(calls).toBe(2);
  release();
  await expect(page.locator(".tk-summary .tk-total")).toContainText("99.00");
  await expect(page.locator(".tk-summary .tk-total")).not.toContainText(
    "777.00",
  );
  expect((await (await page.request.get(api + "/orders")).json()).total).toBe(
    0,
  );
  await page.unroute("**/api/preview/ticketing/demo/quote");
  await page.route("**/api/preview/ticketing/demo/quote", (route) =>
    route.fulfill({ status: 503, json: { error: "INTERNAL_ERROR" } }),
  );
  await page.getByLabel(/^备注/).fill("network retry");
  await expect(
    page.getByRole("button", { name: "重新获取报价" }),
  ).toBeVisible();
  await expect(confirm(page)).toBeDisabled();
  await page.unroute("**/api/preview/ticketing/demo/quote");
  await page.getByRole("button", { name: "重新获取报价" }).click();
  await expect(confirm(page)).toBeEnabled();
  await expect(page.getByLabel(/^备注/)).toHaveValue("network retry");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: info.outputPath("checkout-dark-desktop.png"),
    fullPage: true,
  });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: info.outputPath("checkout-dark-mobile.png"),
    fullPage: true,
  });
  await header.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("button", { name: /Confirm order & simulate payment/ }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("button", { name: /Confirm order & simulate payment/ }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "My orders", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("My orders");
  await expect(header.getByRole("link", { name: /My account/ })).toBeVisible();
});

test("One confirmation creates one order and starts payment once despite double click and refresh", async ({
  page,
  context,
}, info) => {
  await login(page, context);
  await agreement(page).check();
  await expect(confirm(page)).toBeEnabled();
  let creates = 0,
    payments = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith(api + "/orders"))
      creates++;
    if (
      request.method() === "POST" &&
      /\/orders\/[^/]+\/payments$/.test(request.url())
    )
      payments++;
  });
  await confirm(page).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByText("支付处理中", { exact: true })).toBeVisible();
  await expect(page.locator(".tk-simulator")).toHaveAttribute("open", "");
  await expect(page.getByText("模拟购票成功", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("支付处理中", { exact: true })).toBeVisible();
  expect(creates).toBe(1);
  expect(payments).toBe(1);
  await page.getByRole("button", { name: "模拟取消", exact: true }).click();
  await page.getByRole("button", { name: "继续模拟支付", exact: true }).click();
  await page.getByRole("button", { name: "模拟成功", exact: true }).click();
  await expect(page.getByText("模拟购票成功", { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath("payment-dark-result.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "我的订单", exact: true }).click();
  await expect(page.locator(".tk-order-card")).toHaveCount(1);
  await expect(page.locator(".tk-order-state")).toHaveText("已支付");
});

test("Lost creation response survives refresh and recovers without automatic payment", async ({
  page,
  context,
}) => {
  await login(page, context);
  await agreement(page).check();
  await expect(confirm(page)).toBeEnabled();
  let originalKey = "";
  await page.route("**/api/preview/ticketing/demo/orders", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    originalKey = route.request().postDataJSON().idempotencyKey;
    await route.fetch();
    await route.abort("failed");
  });
  await confirm(page).click();
  await expect(
    page.getByRole("button", { name: "核对下单结果" }),
  ).toBeVisible();
  await expect(page.getByLabel(/^姓名/)).toBeDisabled();
  await page.unroute("**/api/preview/ticketing/demo/orders");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "核对下单结果" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      Object.entries(sessionStorage).find(([key]) =>
        key.endsWith(":operation"),
      )?.[1],
  );
  expect(JSON.parse(saved!).idempotencyKey).toBe(originalKey);
  await page.getByRole("button", { name: "核对下单结果" }).click();
  await expect(page).toHaveURL(/checkout\?orderId=/);
  await expect(
    page.getByRole("button", { name: "继续模拟支付", exact: true }),
  ).toBeEnabled();
  const list = await (await page.request.get(api + "/orders")).json();
  expect(list.total).toBe(1);
  expect(list.orders[0].paymentStatus).toBe("idle");
});

test("Unsent creation and lost payment response preserve idempotency and require a status query", async ({
  page,
  context,
}) => {
  await login(page, context);
  await agreement(page).check();
  await expect(confirm(page)).toBeEnabled();
  let key = "";
  await page.route("**/api/preview/ticketing/demo/orders", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    key = route.request().postDataJSON().idempotencyKey;
    await route.abort("failed");
  });
  await confirm(page).click();
  await expect(
    page.getByRole("button", { name: "核对下单结果" }),
  ).toBeVisible();
  await page.unroute("**/api/preview/ticketing/demo/orders");
  let recoveryKey = "";
  await page.route("**/api/preview/ticketing/demo/orders", async (route) => {
    if (route.request().method() === "POST")
      recoveryKey = route.request().postDataJSON().idempotencyKey;
    await route.continue();
  });
  await page.getByRole("button", { name: "核对下单结果" }).click();
  await expect(
    page.getByRole("button", { name: "继续模拟支付", exact: true }),
  ).toBeVisible();
  expect(recoveryKey).toBe(key);
  await page.route(
    "**/api/preview/ticketing/demo/orders/*/payments",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
  );
  await page.getByRole("button", { name: "继续模拟支付", exact: true }).click();
  await expect(page.getByText(/支付结果尚未确定/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "继续模拟支付", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/preview/ticketing/demo/orders/*/payments");
  await page.getByRole("button", { name: "刷新订单状态", exact: true }).click();
  await expect(page.getByText("支付处理中", { exact: true })).toBeVisible();
  expect((await (await page.request.get(api + "/orders")).json()).total).toBe(
    1,
  );
});

test("Changed quotes require another confirmation and changed policies require agreement again", async ({
  page,
  context,
}) => {
  await login(page, context);
  let first = true;
  await page.route("**/api/preview/ticketing/demo/quote", async (route) => {
    const response = await route.fetch();
    const quote = await response.json();
    await route.fulfill({
      json: {
        ...quote,
        quoteVersion: first ? "outdated-version" : quote.quoteVersion,
      },
    });
    first = false;
  });
  await agreement(page).check();
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.locator(".tk-module").getByRole("alert")).toContainText(
    "价格或报价已变化",
  );
  expect((await (await page.request.get(api + "/orders")).json()).total).toBe(
    0,
  );
  await expect(confirm(page)).toBeEnabled();
  await page.route("**/api/preview/ticketing/demo/orders", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const quote = await (
      await page.request.post(api + "/quote", {
        headers: { Origin: new URL(page.url()).origin },
        data: route.request().postDataJSON(),
      })
    ).json();
    await route.fulfill({
      status: 409,
      json: {
        error: "QUOTE_CHANGED",
        quote: {
          ...quote,
          policy: {
            zh: "更新后的演示政策，请再次确认。",
            en: "Updated demo policy; confirm again.",
          },
        },
      },
    });
  });
  await confirm(page).click();
  await expect(agreement(page)).not.toBeChecked();
  await expect(page.locator(".tk-policy-inline")).toContainText(
    "更新后的演示政策",
  );
  await expect(confirm(page)).toBeDisabled();
  expect((await (await page.request.get(api + "/orders")).json()).total).toBe(
    0,
  );
});

test("A definite rejection retries unchanged purchase details with the original idempotency key", async ({
  page,
  context,
}) => {
  await login(page, context);
  await agreement(page).check();
  await expect(confirm(page)).toBeEnabled();
  const keys: string[] = [];
  await page.route("**/api/preview/ticketing/demo/orders", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().postDataJSON().idempotencyKey);
    if (keys.length === 1)
      await route.fulfill({
        status: 409,
        json: { error: "INSUFFICIENT_STOCK" },
      });
    else await route.continue();
  });
  await confirm(page).click();
  await expect(page.locator(".tk-module").getByRole("alert")).toContainText(
    "剩余门票不足",
  );
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect(page.getByText("支付处理中", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect((await (await page.request.get(api + "/orders")).json()).total).toBe(
    1,
  );
});
