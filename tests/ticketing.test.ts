import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { and, eq } from "drizzle-orm";
import { ticketingConfig } from "../src/modules/ticketing/config";
import { isTicketingEnabled } from "../src/modules/ticketing/policy";
import type {
  BuyerAnswers,
  OrderDto,
} from "../src/modules/ticketing/contracts";
import type { AuthUser } from "../src/modules/auth/contracts";

let service: typeof import("../src/modules/ticketing/service");
let database: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let directory: string;
const originalConfig = JSON.parse(JSON.stringify(ticketingConfig));
const secret = "ticketing-unit-test-only-secret-more-than-32-characters";
const answers: BuyerAnswers = {
  displayName: "Test Buyer",
  country: "China",
  source: "community",
  purposes: ["learn"],
  notes: "",
  acceptedPolicy: true,
};
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "hackathon-ticketing-"));
  Object.assign(process.env, {
    NODE_ENV: "development",
    ENABLE_TICKETING_PREVIEW: "true",
    TICKETING_WEBHOOK_SECRET: secret,
    DB_PATH: path.join(directory, "db"),
  });
  database = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/ticketing/service");
});
beforeEach(() => {
  Object.assign(ticketingConfig, JSON.parse(JSON.stringify(originalConfig)));
  ticketingConfig.event.id = `test-${randomUUID()}`;
  for (const ticket of ticketingConfig.tickets) {
    ticket.opensAt = new Date(Date.now() - 3600_000).toISOString();
    ticket.closesAt = new Date(Date.now() + 3600_000).toISOString();
  }
});
after(async () => {
  Object.assign(ticketingConfig, originalConfig);
  await database?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function user(): Promise<AuthUser> {
  const value = {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    createdAt: new Date(),
  };
  await (await database.getDb()).insert(schema.users).values(value);
  return value;
}
async function order(
  buyer: AuthUser,
  quantity = 1,
  idempotencyKey = randomUUID(),
) {
  const input = { ticketId: "standard", quantity, answers };
  const quote = await service.quote(buyer, input);
  return service.createOrder(buyer, {
    ...input,
    quoteVersion: quote.quoteVersion,
    idempotencyKey,
  });
}
async function inventory() {
  return (
    await (
      await database.getDb()
    )
      .select()
      .from(schema.ticketInventory)
      .where(
        and(
          eq(schema.ticketInventory.eventId, ticketingConfig.event.id),
          eq(schema.ticketInventory.ticketId, "standard"),
        ),
      )
  )[0];
}
async function expire(value: OrderDto) {
  const past = new Date(Date.now() - 1000);
  await database.serializeDatabaseWrite(async () => {
    const db = await database.getDb();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.ticketOrders)
        .set({ expiresAt: past })
        .where(eq(schema.ticketOrders.id, value.id));
      await tx
        .update(schema.ticketReservations)
        .set({ expiresAt: past })
        .where(eq(schema.ticketReservations.orderId, value.id));
    });
  });
}
test("Order list pages account-owned history, preserves snapshots and excludes private fields", async () => {
  const buyer = await user();
  const other = await user();
  const historical = [];
  for (let i = 0; i < 12; i++) {
    const value = await order(buyer);
    await service.closeOrder(buyer, value.id);
    await (
      await database.getDb()
    )
      .update(schema.ticketOrders)
      .set({ createdAt: new Date(1700000000000 + i * 1000) })
      .where(eq(schema.ticketOrders.id, value.id));
    historical.push(value);
  }
  await order(other);
  const eventId = ticketingConfig.event.id;
  ticketingConfig.event.id = "other-event-" + randomUUID();
  await order(buyer);
  ticketingConfig.event.id = eventId;
  ticketingConfig.event.name = { zh: "新活动名称", en: "Changed name" };
  ticketingConfig.tickets.find((t) => t.id === "standard")!.unitAmount = 50000;
  const first = await service.listOrders(buyer);
  const second = await service.listOrders(buyer, 2);
  assert.equal(first.total, 12);
  assert.equal(first.orders.length, 10);
  assert.equal(second.orders.length, 2);
  assert.deepEqual(
    [...first.orders, ...second.orders].map((o) => o.id),
    historical.toReversed().map((o) => o.id),
  );
  assert.deepEqual(first.orders[0].eventName, historical[0].eventName);
  assert.equal(first.orders[0].totalAmount, 9900);
  assert.equal((await service.listOrders(buyer, 9)).orders.length, 0);
  assert.equal((await service.listOrders(other)).total, 1);
  assert.deepEqual(
    Object.keys(first.orders[0]).sort(),
    [
      "id",
      "eventId",
      "eventName",
      "ticketName",
      "quantity",
      "totalAmount",
      "currency",
      "createdAt",
      "status",
      "paymentStatus",
      "reconciliationRequired",
      "canPay",
      "timeZone",
    ].sort(),
  );
  for (const page of [0, -1, 1.1, NaN, Infinity])
    await assert.rejects(service.listOrders(buyer, page));
});

test("Listing synchronizes only the caller's pending order and safely expires its reservation", async () => {
  const buyer = await user();
  const other = await user();
  const current = await order(buyer);
  const foreign = await order(other);
  await expire(current);
  await expire(foreign);
  const result = await service.listOrders(buyer);
  assert.equal(result.orders[0].status, "closed");
  const [untouched] = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketOrders)
    .where(eq(schema.ticketOrders.id, foreign.id));
  assert.equal(untouched.status, "pending");
  assert.equal((await inventory()).reserved, 1);
});

test("Order history keeps paid, uncertain and late-receipt states without duplicating payment", async () => {
  const buyer = await user();
  const paid = await order(buyer);
  await service.startPayment(buyer, paid.id);
  await service.simulatePayment(buyer, paid.id, "success");
  const late = await order(buyer);
  await service.startPayment(buyer, late.id);
  await service.closeOrder(buyer, late.id);
  await service.simulatePayment(buyer, late.id, "late_success");
  const unknown = await order(buyer);
  await service.startPayment(buyer, unknown.id);
  await service.simulatePayment(buyer, unknown.id, "unknown");
  await expire(unknown);
  const before = await inventory();
  await service.listOrders(buyer);
  const result = await service.listOrders(buyer);
  assert.equal(result.orders.find((o) => o.id === paid.id)!.status, "paid");
  assert.equal(
    result.orders.find((o) => o.id === late.id)!.reconciliationRequired,
    true,
  );
  assert.equal(result.orders.find((o) => o.id === late.id)!.status, "closed");
  assert.equal(
    result.orders.find((o) => o.id === unknown.id)!.paymentStatus,
    "unknown",
  );
  assert.equal(result.orders.find((o) => o.id === unknown.id)!.canPay, false);
  const after = await inventory();
  assert.equal(after.sold, before.sold);
  assert.equal(after.reserved, before.reserved);
  assert.equal(
    (
      await (
        await database.getDb()
      )
        .select()
        .from(schema.ticketPaymentAttempts)
        .where(eq(schema.ticketPaymentAttempts.orderId, unknown.id))
    ).length,
    1,
  );
});
test("Preview gate requires explicit development enablement", () => {
  assert.equal(isTicketingEnabled(), true);
  process.env.ENABLE_TICKETING_PREVIEW = "false";
  assert.equal(isTicketingEnabled(), false);
  process.env.ENABLE_TICKETING_PREVIEW = "true";
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal(isTicketingEnabled(), false);
  Object.assign(process.env, { NODE_ENV: "development" });
});
test("Quote validates answers and quantity; price/policy changes require reconfirmation", async () => {
  const buyer = await user();
  await assert.rejects(
    service.quote(buyer, {
      ticketId: "standard",
      quantity: 1,
      answers: { ...answers, acceptedPolicy: false },
    }),
  );
  await assert.rejects(
    service.quote(buyer, { ticketId: "standard", quantity: 0, answers }),
  );
  await assert.rejects(
    service.quote(buyer, {
      ticketId: "standard",
      quantity: 1,
      answers: { ...answers, purposes: ["invented"] },
    }),
  );
  const input = { ticketId: "standard", quantity: 2, answers };
  const quote = await service.quote(buyer, input);
  assert.equal(quote.totalAmount, 19800);
  ticketingConfig.tickets[1].unitAmount = 10900;
  await assert.rejects(
    service.createOrder(buyer, {
      ...input,
      quoteVersion: quote.quoteVersion,
      idempotencyKey: randomUUID(),
    }),
    (error: unknown) => (error as { status: number }).status === 409,
  );
  const latest = await service.quote(buyer, input);
  assert.equal(latest.totalAmount, 21800);
  ticketingConfig.policyVersion = "new-policy";
  await assert.rejects(
    service.createOrder(buyer, {
      ...input,
      quoteVersion: latest.quoteVersion,
      idempotencyKey: randomUUID(),
    }),
  );
});
test("Creation is idempotent, has one pending order, and rejects changed idempotency payload", async () => {
  const buyer = await user();
  const key = randomUUID();
  const input = { ticketId: "standard", quantity: 1, answers };
  const quote = await service.quote(buyer, input);
  const request = {
    ...input,
    quoteVersion: quote.quoteVersion,
    idempotencyKey: key,
  };
  const results = await Promise.all([
    service.createOrder(buyer, request),
    service.createOrder(buyer, request),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal((await inventory()).reserved, 1);
  await assert.rejects(service.createOrder(buyer, { ...request, quantity: 2 }));
  const alias = randomUUID();
  const other = await service.createOrder(buyer, {
    ...request,
    idempotencyKey: alias,
  });
  assert.equal(other.id, results[0].id);
  await assert.rejects(
    service.quote(buyer, input),
    (error: unknown) => (error as { orderId?: string }).orderId === other.id,
  );
  await service.closeOrder(buyer, other.id);
  const replayed = await service.createOrder(buyer, {
    ...request,
    idempotencyKey: alias,
  });
  assert.equal(replayed.id, other.id);
  assert.equal(replayed.status, "closed");
});
test("Last ticket cannot oversell; active reservations and paid tickets count toward limits", async () => {
  ticketingConfig.tickets[1].inventory = 1;
  const buyers = await Promise.all([user(), user()]);
  const results = await Promise.allSettled(buyers.map((buyer) => order(buyer)));
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal((await inventory()).reserved, 1);
  const winner = results.findIndex((result) => result.status === "fulfilled");
  await service.closeOrder(
    buyers[winner],
    (results[winner] as PromiseFulfilledResult<OrderDto>).value.id,
  );
  assert.equal((await inventory()).reserved, 0);
  ticketingConfig.tickets[1].inventory = 100;
  const buyer = await user();
  const purchase = await order(buyer, 5);
  await service.startPayment(buyer, purchase.id);
  await service.simulatePayment(buyer, purchase.id, "success");
  await assert.rejects(order(buyer));
  ticketingConfig.tickets[1].inventory = 4;
  await assert.rejects(service.getCatalog());
});
test("Sale boundaries, disabled states and expiry enforce purchase availability", async () => {
  const buyer = await user();
  ticketingConfig.tickets[1].opensAt = new Date(
    Date.now() + 60_000,
  ).toISOString();
  assert.equal(
    (await service.getCatalog()).tickets.find(
      (ticket) => ticket.id === "standard",
    )!.state,
    "not_open",
  );
  await assert.rejects(order(buyer));
  ticketingConfig.tickets[1].opensAt = new Date(
    Date.now() - 60_000,
  ).toISOString();
  ticketingConfig.tickets[1].closesAt = new Date(Date.now()).toISOString();
  assert.equal(
    (await service.getCatalog()).tickets.find(
      (ticket) => ticket.id === "standard",
    )!.state,
    "ended",
  );
  await assert.rejects(order(buyer));
  ticketingConfig.tickets[1].closesAt = new Date(
    Date.now() + 60_000,
  ).toISOString();
  ticketingConfig.tickets[1].enabled = false;
  assert.equal(
    (await service.getCatalog()).tickets.find(
      (ticket) => ticket.id === "standard",
    )!.state,
    "disabled",
  );
  ticketingConfig.tickets[1].enabled = true;
  const purchase = await order(buyer);
  assert.ok(
    Date.parse(purchase.expiresAt) <=
      Date.parse(ticketingConfig.tickets[1].closesAt),
  );
  await expire(purchase);
  assert.equal((await service.getOrder(buyer, purchase.id)).status, "closed");
  assert.equal((await inventory()).reserved, 0);
  await assert.rejects(service.startPayment(buyer, purchase.id));
});
test("Payment creation is concurrency-safe; success and repeated notifications convert inventory once", async () => {
  const buyer = await user();
  const purchase = await order(buyer, 2);
  await Promise.all([
    service.startPayment(buyer, purchase.id),
    service.startPayment(buyer, purchase.id),
  ]);
  const attempts = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  assert.equal(attempts.length, 1);
  const success = await service.simulatePayment(buyer, purchase.id, "success");
  assert.equal(success.status, "paid");
  assert.equal(success.totalAmount, 19800);
  await service.simulatePayment(buyer, purchase.id, "duplicate");
  const stock = await inventory();
  assert.equal(stock.sold, 2);
  assert.equal(stock.reserved, 0);
  assert.equal((await service.getOrder(buyer, purchase.id)).canPay, false);
  const oldName = success.eventName;
  ticketingConfig.event.name = { zh: "改变后的名称", en: "Changed event" };
  assert.deepEqual(
    (await service.getOrder(buyer, purchase.id)).eventName,
    oldName,
  );
  const beforeQuestions = success.questions;
  ticketingConfig.questions.sources = [];
  assert.deepEqual(
    (await service.getOrder(buyer, purchase.id)).questions,
    beforeQuestions,
  );
});
test("Failed or cancelled attempts allow retry, while unknown results keep reservation and block parallel payment", async () => {
  const buyer = await user();
  const purchase = await order(buyer);
  await service.startPayment(buyer, purchase.id);
  let current = await service.simulatePayment(buyer, purchase.id, "failure");
  assert.equal(current.status, "pending");
  assert.equal(current.canPay, true);
  await service.startPayment(buyer, purchase.id);
  current = await service.simulatePayment(buyer, purchase.id, "cancel");
  assert.equal(current.canPay, true);
  await service.startPayment(buyer, purchase.id);
  current = await service.simulatePayment(buyer, purchase.id, "unknown");
  assert.equal(current.canPay, false);
  const before = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  await Promise.allSettled([
    service.startPayment(buyer, purchase.id),
    service.closeOrder(buyer, purchase.id),
  ]);
  await expire(purchase);
  current = await service.getOrder(buyer, purchase.id);
  assert.equal(current.status, "pending");
  assert.equal((await inventory()).reserved, 1);
  const after = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  assert.equal(before.length, after.length);
});
test("Late success after confirmed close is recorded for reconciliation without issuing tickets or overselling", async () => {
  const buyer = await user();
  const purchase = await order(buyer);
  await service.startPayment(buyer, purchase.id);
  assert.equal((await service.closeOrder(buyer, purchase.id)).status, "closed");
  const late = await service.simulatePayment(
    buyer,
    purchase.id,
    "late_success",
  );
  assert.equal(late.status, "closed");
  assert.equal(late.reconciliationRequired, true);
  assert.equal((await inventory()).sold, 0);
  assert.equal((await inventory()).reserved, 0);
});
test("Order ownership and signed notification binding reject forged or mismatched payments", async () => {
  const buyer = await user();
  const other = await user();
  const purchase = await order(buyer);
  await assert.rejects(service.getOrder(other, purchase.id));
  await assert.rejects(service.startPayment(other, purchase.id));
  await assert.rejects(service.simulatePayment(other, purchase.id, "success"));
  await service.startPayment(buyer, purchase.id);
  const [attempt] = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  const [transaction] = await (
    await database.getDb()
  )
    .select()
    .from(schema.mockPaymentTransactions)
    .where(eq(schema.mockPaymentTransactions.attemptId, attempt.id));
  const raw = JSON.stringify({
    eventId: randomUUID(),
    attemptId: attempt.id,
    transactionId: transaction.id,
    orderId: purchase.id,
    amount: purchase.totalAmount + 1,
    currency: purchase.currency,
    state: "succeeded",
    timestamp: Date.now(),
  });
  await assert.rejects(service.handleNotification(raw, "invalid-signature"));
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  await assert.rejects(service.handleNotification(raw, signature));
  assert.equal((await service.getOrder(buyer, purchase.id)).status, "pending");
});
test("Orders, reservations and simulated channel transactions survive database reopen", async () => {
  const buyer = await user();
  const purchase = await order(buyer);
  await service.startPayment(buyer, purchase.id);
  await database.closeDb();
  const restored = await service.getOrder(buyer, purchase.id);
  assert.equal(restored.status, "pending");
  assert.equal(restored.email, buyer.email);
  assert.equal(restored.answers.displayName, answers.displayName);
  assert.equal((await inventory()).reserved, 1);
  assert.equal(
    (await service.simulatePayment(buyer, purchase.id, "success")).status,
    "paid",
  );
});

test("Zero amount orders confirm directly without creating a channel transaction", async () => {
  ticketingConfig.tickets[1].unitAmount = 0;
  const buyer = await user();
  const purchase = await order(buyer);
  assert.equal(purchase.status, "paid");
  assert.equal(purchase.totalAmount, 0);
  const attempts = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  assert.equal(attempts.length, 0);
  assert.equal((await inventory()).sold, 1);
});

test("Missing webhook configuration blocks payments while allowing catalog and leaves reservation intact", async () => {
  const buyer = await user();
  const purchase = await order(buyer);
  delete process.env.TICKETING_WEBHOOK_SECRET;
  try {
    assert.ok((await service.getCatalog()).tickets.length);
    await assert.rejects(
      service.startPayment(buyer, purchase.id),
      (error: unknown) => (error as { status: number }).status === 503,
    );
    await assert.rejects(
      service.simulatePayment(buyer, purchase.id, "success"),
    );
    assert.equal((await inventory()).reserved, 1);
  } finally {
    process.env.TICKETING_WEBHOOK_SECRET = secret;
  }
});

test("Signed browser claims and stale notifications cannot invent payment success; known event replays are idempotent", async () => {
  const buyer = await user();
  const purchase = await order(buyer);
  await service.startPayment(buyer, purchase.id);
  const [attempt] = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, purchase.id));
  const [transaction] = await (
    await database.getDb()
  )
    .select()
    .from(schema.mockPaymentTransactions)
    .where(eq(schema.mockPaymentTransactions.attemptId, attempt.id));
  const notification = {
    eventId: randomUUID(),
    attemptId: attempt.id,
    transactionId: transaction.id,
    orderId: purchase.id,
    amount: purchase.totalAmount,
    currency: purchase.currency,
    state: "succeeded",
    timestamp: Date.now(),
  };
  const forged = JSON.stringify(notification);
  await service.handleNotification(
    forged,
    createHmac("sha256", secret).update(forged).digest("hex"),
  );
  assert.equal((await service.getOrder(buyer, purchase.id)).status, "pending");
  const stale = JSON.stringify({
    ...notification,
    state: "pending",
    timestamp: Date.now() - 600_000,
  });
  await assert.rejects(
    service.handleNotification(
      stale,
      createHmac("sha256", secret).update(stale).digest("hex"),
    ),
  );
  assert.equal((await service.getOrder(buyer, purchase.id)).status, "pending");
  await service.simulatePayment(buyer, purchase.id, "success");
  const [seen] = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentNotifications)
    .where(eq(schema.ticketPaymentNotifications.attemptId, attempt.id));
  const known = JSON.stringify(seen.payload);
  const actualNow = Date.now;
  try {
    Date.now = () => actualNow() + 600_000;
    assert.deepEqual(
      await service.handleNotification(
        known,
        createHmac("sha256", secret).update(known).digest("hex"),
      ),
      { ok: true },
    );
  } finally {
    Date.now = actualNow;
  }
  const failure = JSON.stringify({
    ...notification,
    eventId: randomUUID(),
    state: "failed",
    timestamp: Date.now(),
  });
  await Promise.allSettled([
    service.handleNotification(
      failure,
      createHmac("sha256", secret).update(failure).digest("hex"),
    ),
  ]);
  assert.equal((await service.getOrder(buyer, purchase.id)).status, "paid");
  assert.equal((await inventory()).sold, 1);
});
