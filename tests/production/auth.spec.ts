import { test, expect } from "@playwright/test";

test("Production disables development mail and protects account routes", async ({
  request,
}) => {
  expect((await request.get("/dev/mail")).status()).toBe(404);
  const login = await request.get("/login");
  expect(login.status()).toBe(200);
  expect(await login.text()).not.toContain('href="/dev/mail"');
  for (const endpoint of ["send-code", "verify-code"]) {
    const result = await request.post(`/api/auth/${endpoint}`, {
      headers: { Origin: "http://127.0.0.1:3101" },
      data: { email: "production@example.com", language: "zh", code: "123456" },
    });
    expect(result.status()).toBe(503);
    expect((await result.json()).error).toBe("MAIL_DISABLED");
  }
  const me = await request.get("/api/auth/me");
  expect(me.status()).toBe(401);
  expect(me.headers()["cache-control"]).toContain("no-store");
  const account = await request.get("/account", { maxRedirects: 0 });
  expect(account.status()).toBe(307);
  expect(account.headers().location).toBe("/login");
  expect((await request.get("/api/events/demo")).status()).toBe(200);
  expect((await request.get("/events")).status()).toBe(200);
  const homepage = await request.get("/");
  expect(homepage.status()).toBe(200);
  expect(await homepage.text()).toContain("组织官网演示站点");
  const projects = await request.get("/projects");
  expect(projects.status()).toBe(200);
  expect(await projects.text()).toContain("每一个想法");
  const projectList = await request.get("/api/projects");
  expect(projectList.status()).toBe(200);
  expect((await projectList.json()).total).toBe(12);
  expect((await request.get("/projects/submit")).status()).toBe(200);
  const board = await request.get("/api/events");
  expect(board.status()).toBe(200);
  expect((await board.json()).events).toHaveLength(3);
  expect((await request.get("/events/upcoming-demo")).status()).toBe(200);
  expect((await request.get("/events/demo/teams")).status()).toBe(200);
  expect((await request.get("/api/events/demo/teams")).status()).toBe(200);
  expect((await request.get("/api/events/demo/center")).status()).toBe(401);
  for (const suffix of ["my-team", "applications"]) {
    const response = await request.get(`/events/demo/${suffix}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/login?next=");
  }
  expect((await request.get("/api/events/not-an-event")).status()).toBe(404);
  for (const endpoint of ["participation", "materials", "review"]) {
    expect((await request.get(`/api/events/demo/${endpoint}`)).status()).toBe(
      401,
    );
  }
  const materials = await request.get("/events/demo/materials", {
    maxRedirects: 0,
  });
  expect(materials.status()).toBe(307);
  expect(materials.headers().location).toBe(
    "/login?next=%2Fevents%2Fdemo%2Fmaterials",
  );
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
    "/api/preview/ticketing/demo/orders",
    "/api/preview/ticketing/demo/payments/notify",
    "/api/preview/ticketing/demo/quote",
    "/api/preview/ticketing/demo/orders/00000000-0000-0000-0000-000000000000/payments",
    "/api/preview/ticketing/demo/orders/00000000-0000-0000-0000-000000000000/close",
    "/api/preview/ticketing/demo/orders/00000000-0000-0000-0000-000000000000/simulate",
  ]) {
    expect((await request.post(path, { data: {} })).status()).toBe(404);
  }
});
