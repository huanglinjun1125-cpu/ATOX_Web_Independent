import { test, expect } from "@playwright/test";
test("Development preview disabled returns 404 for both pages and every API entry", async ({
  request,
}) => {
  expect(await (await request.get("/")).text()).not.toContain("购票（模拟）");
  for (const path of [
    "/preview/ticketing/demo",
    "/preview/ticketing/demo/checkout",
    "/preview/ticketing/demo/orders",
    "/api/preview/ticketing/demo/orders",
    "/api/preview/ticketing/demo",
    "/api/preview/ticketing/demo/orders/00000000-0000-0000-0000-000000000000",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  for (const path of [
    "quote",
    "orders",
    "payments/notify",
    "orders/00000000-0000-0000-0000-000000000000/payments",
    "orders/00000000-0000-0000-0000-000000000000/close",
    "orders/00000000-0000-0000-0000-000000000000/simulate",
  ]) {
    expect(
      (
        await request.post("/api/preview/ticketing/demo/" + path, { data: {} })
      ).status(),
    ).toBe(404);
  }
});
