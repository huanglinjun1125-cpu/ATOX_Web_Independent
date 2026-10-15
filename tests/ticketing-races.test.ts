import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { ticketingConfig } from "../src/modules/ticketing/config";
import type { AuthUser } from "../src/modules/auth/contracts";

let database: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let service: typeof import("../src/modules/ticketing/service");
let provider: typeof import("../src/modules/ticketing/provider");
let directory: string;
const originalConfig = structuredClone(ticketingConfig);

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "ticketing-races-"));
  Object.assign(process.env, {
    NODE_ENV: "development",
    ENABLE_TICKETING_PREVIEW: "true",
    TICKETING_WEBHOOK_SECRET: "race-test-only-secret-more-than-32-characters",
    DB_PATH: path.join(directory, "db"),
  });
  ticketingConfig.event.id = `races-${randomUUID()}`;
  for (const ticket of ticketingConfig.tickets) {
    ticket.opensAt = new Date(Date.now() - 3600000).toISOString();
    ticket.closesAt = new Date(Date.now() + 3600000).toISOString();
  }
  database = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/ticketing/service");
  provider = await import("../src/modules/ticketing/provider");
});

after(async () => {
  Object.assign(ticketingConfig, originalConfig);
  await database?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function purchase() {
  const buyer: AuthUser = {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    createdAt: new Date(),
  };
  const db = await database.getDb();
  await db.insert(schema.users).values(buyer);
  const input = {
    ticketId: "standard",
    quantity: 1,
    answers: {
      displayName: "Race buyer",
      country: "CN",
      source: "community",
      purposes: ["learn"],
      notes: "",
      acceptedPolicy: true,
    },
  };
  const quote = await service.quote(buyer, input);
  const order = await service.createOrder(buyer, {
    ...input,
    quoteVersion: quote.quoteVersion,
    idempotencyKey: randomUUID(),
  });
  return { buyer, order };
}

async function rows(orderId: string) {
  const db = await database.getDb();
  const [order] = await db
    .select()
    .from(schema.ticketOrders)
    .where(eq(schema.ticketOrders.id, orderId));
  const [reservation] = await db
    .select()
    .from(schema.ticketReservations)
    .where(eq(schema.ticketReservations.orderId, orderId));
  const attempts = await db
    .select()
    .from(schema.ticketPaymentAttempts)
    .where(eq(schema.ticketPaymentAttempts.orderId, orderId));
  const transactions = await db
    .select()
    .from(schema.mockPaymentTransactions)
    .where(eq(schema.mockPaymentTransactions.orderId, orderId));
  return { order, reservation, attempts, transactions };
}

test("Concurrent start/close retains financial rows and fences channel creation", async () => {
  for (let i = 0; i < 5; i++) {
    const { buyer, order } = await purchase();
    await Promise.allSettled([
      service.startPayment(buyer, order.id),
      service.closeOrder(buyer, order.id),
    ]);
    await service.closeOrder(buyer, order.id);
    const state = await rows(order.id);
    assert.equal(state.order.status, "closed");
    assert.equal(state.reservation.status, "released");
    assert.ok(state.attempts.length <= 1);
    assert.ok(
      state.transactions.every((transaction) => transaction.state === "closed"),
    );
    await assert.rejects(
      (await database.getDb())
        .delete(schema.users)
        .where(eq(schema.users.id, buyer.id)),
    );
  }
});

test("Channel close tombstone prevents an in-flight create from becoming payable", async () => {
  const { buyer, order } = await purchase();
  const [attempt] = await (
    await database.getDb()
  )
    .insert(schema.ticketPaymentAttempts)
    .values({ orderId: order.id, status: "creating" })
    .returning();
  const input = {
    attemptId: attempt.id,
    orderId: order.id,
    amount: order.totalAmount,
    currency: order.currency,
  };
  await provider.closeTransaction(input);
  const created = await provider.createTransaction(input);
  assert.equal(created.state, "closed");
  await service.closeOrder(buyer, order.id);
});

test("Unknown channel result survives expiry and concurrent close without releasing reservation", async () => {
  const { buyer, order } = await purchase();
  await service.startPayment(buyer, order.id);
  await service.simulatePayment(buyer, order.id, "unknown");
  await database.serializeDatabaseWrite(async () => {
    await (
      await database.getDb()
    )
      .update(schema.ticketOrders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.ticketOrders.id, order.id));
  });
  await Promise.all([
    service.closeOrder(buyer, order.id),
    service.getOrder(buyer, order.id),
    service.maintainOrders(),
  ]);
  const state = await rows(order.id);
  assert.equal(state.order.status, "pending");
  assert.equal(state.reservation.status, "held");
  assert.equal(state.transactions[0].state, "unknown");
  assert.equal(state.attempts.length, 1);
  // Resolve the uncertain channel outcome, then close so subsequent tests are isolated.
  await provider.simulateTransaction(state.attempts[0].id, "failure");
  await service.closeOrder(buyer, order.id);
});

test("Concurrent success notification and close converts or releases exactly once", async () => {
  const { buyer, order } = await purchase();
  await service.startPayment(buyer, order.id);
  const { attempts } = await rows(order.id);
  const transaction = await provider.simulateTransaction(
    attempts[0].id,
    "success",
  );
  const notification = provider.notificationFor(transaction);
  const raw = JSON.stringify(notification);
  await Promise.all([
    service.handleNotification(raw, provider.signNotification(raw)),
    service.handleNotification(raw, provider.signNotification(raw)),
    service.closeOrder(buyer, order.id),
  ]);
  const state = await rows(order.id);
  assert.equal(state.order.status, "paid");
  assert.equal(state.reservation.status, "converted");
  assert.equal(state.attempts[0].status, "succeeded");
  const notifications = await (
    await database.getDb()
  )
    .select()
    .from(schema.ticketPaymentNotifications)
    .where(
      and(
        eq(schema.ticketPaymentNotifications.eventId, notification.eventId),
        eq(schema.ticketPaymentNotifications.attemptId, attempts[0].id),
      ),
    );
  assert.equal(notifications.length, 1);
});
