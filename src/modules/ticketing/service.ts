import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import type { AuthUser } from "../auth/contracts";
import type {
  BuyerAnswers,
  CatalogDto,
  CreateOrderInput,
  OrderDto,
  OrderListDto,
  QuoteDto,
  QuoteInput,
  SimulationAction,
  TicketState,
} from "./contracts";
import { ticketingConfig } from "./config";
import { isTicketingEnabled } from "./policy";
import { TicketingError } from "./errors";
import {
  ticketInventory,
  ticketOrders,
  ticketOrderKeys,
  ticketReservations,
  ticketPaymentAttempts,
  ticketPaymentNotifications,
} from "./schema";
import * as provider from "./provider";

type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Db | Tx;
type Order = typeof ticketOrders.$inferSelect;
type Attempt = typeof ticketPaymentAttempts.$inferSelect;
interface Snapshot {
  eventName: { zh: string; en: string };
  ticketName: { zh: string; en: string };
  policy: { zh: string; en: string };
  policyVersion: string;
  event: typeof ticketingConfig.event;
  ticket: (typeof ticketingConfig.tickets)[number];
  questions: typeof ticketingConfig.questions;
  maxPerAccount: number;
  reservationMinutes: number;
  currency: string;
}

export function requireTicketing() {
  if (!isTicketingEnabled()) throw new TicketingError("NOT_FOUND", 404);
}
function invalid(): never {
  throw new TicketingError("INVALID_INPUT");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string" || value.length > max || /\u0000/.test(value))
    invalid();
  const result = value.trim();
  if (required && !result) invalid();
  return result;
}
function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    invalid();
  return value;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function hash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
function validateAnswers(value: unknown, currentOptions = true): BuyerAnswers {
  const input = record(value);
  const source = text(input.source, 100, true);
  if (
    (currentOptions &&
      !ticketingConfig.questions.sources.some((item) => item.id === source)) ||
    !Array.isArray(input.purposes) ||
    !input.purposes.length ||
    input.purposes.length >
      (currentOptions ? ticketingConfig.questions.purposes.length : 100) ||
    input.acceptedPolicy !== true
  )
    invalid();
  const purposes = input.purposes.map((value) => text(value, 100, true));
  if (
    new Set(purposes).size !== purposes.length ||
    (currentOptions &&
      purposes.some(
        (id) =>
          !ticketingConfig.questions.purposes.some((item) => item.id === id),
      ))
  )
    invalid();
  return {
    displayName: text(input.displayName, 100, true),
    country: text(input.country, 100, true),
    source,
    purposes: [...purposes].sort(),
    notes: text(input.notes, 2000),
    acceptedPolicy: true,
  };
}
function validateInput(value: unknown) {
  const input = record(value);
  const ticketId = text(input.ticketId, 100, true);
  if (
    !Number.isSafeInteger(input.quantity) ||
    (input.quantity as number) < 1 ||
    (input.quantity as number) > ticketingConfig.maxPerAccount
  )
    invalid();
  const ticket = ticketingConfig.tickets.find(
    (ticket) => ticket.id === ticketId,
  );
  if (!ticket) invalid();
  return {
    ticket,
    ticketId,
    quantity: input.quantity as number,
    answers: validateAnswers(input.answers),
  };
}
function ticketState(
  ticket: (typeof ticketingConfig.tickets)[number],
  available: number,
  now = new Date(),
): TicketState {
  if (!ticket.enabled) return "disabled";
  if (now.getTime() < Date.parse(ticket.opensAt)) return "not_open";
  if (now.getTime() >= Date.parse(ticket.closesAt)) return "ended";
  if (available < 1) return "sold_out";
  return "on_sale";
}
function requireSale(
  ticket: (typeof ticketingConfig.tickets)[number],
  available: number,
  quantity: number,
) {
  const state = ticketState(ticket, available);
  if (state !== "on_sale")
    throw new TicketingError(
      state === "sold_out"
        ? "SOLD_OUT"
        : state === "not_open"
          ? "NOT_OPEN"
          : state === "ended"
            ? "ENDED"
            : "DISABLED",
      409,
    );
  if (available < quantity) throw new TicketingError("INSUFFICIENT_STOCK", 409);
}
function version(ticket: (typeof ticketingConfig.tickets)[number]) {
  return hash({
    event: ticketingConfig.event,
    policyVersion: ticketingConfig.policyVersion,
    currency: ticketingConfig.currency,
    ticket: {
      id: ticket.id,
      name: ticket.name,
      unitAmount: ticket.unitAmount,
      opensAt: ticket.opensAt,
      closesAt: ticket.closesAt,
    },
    maxPerAccount: ticketingConfig.maxPerAccount,
    questions: ticketingConfig.questions,
  });
}
async function seedInventory(tx: Tx) {
  for (const ticket of ticketingConfig.tickets) {
    if (
      !Number.isSafeInteger(ticket.inventory) ||
      ticket.inventory < 0 ||
      !Number.isSafeInteger(ticket.unitAmount) ||
      ticket.unitAmount < 0 ||
      !Number.isSafeInteger(ticket.unitAmount * ticketingConfig.maxPerAccount)
    )
      throw new TicketingError("INVALID_CONFIGURATION", 503);
    await tx
      .insert(ticketInventory)
      .values({
        eventId: ticketingConfig.event.id,
        ticketId: ticket.id,
        total: ticket.inventory,
        sold: 0,
        reserved: 0,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
    const [existing] = await tx
      .select()
      .from(ticketInventory)
      .where(inventoryScope(ticket.id));
    if (existing.sold + existing.reserved > ticket.inventory)
      throw new TicketingError("INVALID_CONFIGURATION", 503);
    if (existing.total !== ticket.inventory)
      await tx
        .update(ticketInventory)
        .set({ total: ticket.inventory, updatedAt: new Date() })
        .where(inventoryScope(ticket.id));
  }
}
function inventoryScope(ticketId: string) {
  return and(
    eq(ticketInventory.eventId, ticketingConfig.event.id),
    eq(ticketInventory.ticketId, ticketId),
  );
}
async function orderById(db: Reader, id: string) {
  const [order] = await db
    .select()
    .from(ticketOrders)
    .where(
      and(
        eq(ticketOrders.id, id),
        eq(ticketOrders.eventId, ticketingConfig.event.id),
      ),
    )
    .limit(1);
  if (!order) throw new TicketingError("NOT_FOUND", 404);
  return order;
}
async function ownedOrder(user: AuthUser, id: string) {
  uuid(id);
  const order = await orderById(await getDb(), id);
  if (order.userId !== user.id) throw new TicketingError("FORBIDDEN", 403);
  return order;
}
async function attemptsFor(db: Reader, orderId: string) {
  return db
    .select()
    .from(ticketPaymentAttempts)
    .where(eq(ticketPaymentAttempts.orderId, orderId))
    .orderBy(desc(ticketPaymentAttempts.createdAt));
}
async function dto(order: Order): Promise<OrderDto> {
  const attempts = await attemptsFor(await getDb(), order.id);
  const latest = attempts[0];
  const snapshot = order.snapshot as Snapshot;
  let paymentStatus: OrderDto["paymentStatus"] = latest?.status ?? "idle";
  if (latest?.failureCode === "PROVIDER_UNKNOWN") paymentStatus = "unknown";
  if (order.status === "paid") paymentStatus = "succeeded";
  if (order.status === "closed" && !latest) paymentStatus = "closed";
  return {
    id: order.id,
    event: snapshot.event,
    questions: snapshot.questions,
    eventId: order.eventId,
    eventName: snapshot.eventName,
    ticketId: order.ticketId,
    ticketName: snapshot.ticketName,
    quantity: order.quantity,
    unitAmount: order.unitAmount,
    totalAmount: order.totalAmount,
    currency: order.currency,
    answers: order.answers as BuyerAnswers,
    email: order.email,
    status: order.status,
    paymentStatus,
    expiresAt: order.expiresAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    closeReason: order.closeReason,
    reconciliationRequired: order.reconciliationRequired,
    canPay:
      order.status === "pending" &&
      !order.closeReason &&
      order.expiresAt.getTime() > Date.now() &&
      paymentStatus !== "unknown",
    canClose: order.status === "pending",
    policy: snapshot.policy,
  };
}
export async function getCatalog(): Promise<CatalogDto> {
  requireTicketing();
  await maintainOrders();
  await serializeDatabaseWrite(async () =>
    (await getDb()).transaction(seedInventory),
  );
  const inventory = await (
    await getDb()
  )
    .select()
    .from(ticketInventory)
    .where(eq(ticketInventory.eventId, ticketingConfig.event.id));
  return {
    event: ticketingConfig.event,
    tickets: ticketingConfig.tickets.map((ticket) => {
      const row = inventory.find((row) => row.ticketId === ticket.id)!;
      const available = row.total - row.sold - row.reserved;
      return {
        id: ticket.id,
        name: ticket.name,
        unitAmount: ticket.unitAmount,
        currency: ticketingConfig.currency,
        opensAt: ticket.opensAt,
        closesAt: ticket.closesAt,
        state: ticketState(ticket, available),
        available,
      };
    }),
    questions: ticketingConfig.questions,
    maxPerAccount: ticketingConfig.maxPerAccount,
    reservationMinutes: ticketingConfig.reservationMinutes,
    serverNow: new Date().toISOString(),
  };
}
export async function quote(
  user: AuthUser,
  input: QuoteInput,
): Promise<QuoteDto> {
  requireTicketing();
  const { ticket, ticketId, quantity } = validateInput(input);
  await maintainOrders();
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const accountOrders = await tx
        .select()
        .from(ticketOrders)
        .where(
          and(
            eq(ticketOrders.eventId, ticketingConfig.event.id),
            eq(ticketOrders.userId, user.id),
            inArray(ticketOrders.status, ["paid", "pending"]),
          ),
        );
      const pending = accountOrders.find((order) => order.status === "pending");
      if (pending)
        throw new TicketingError("PENDING_ORDER_EXISTS", 409, pending.id);
      await seedInventory(tx);
      const [stock] = await tx
        .select()
        .from(ticketInventory)
        .where(inventoryScope(ticketId));
      requireSale(ticket, stock.total - stock.sold - stock.reserved, quantity);
      if (
        accountOrders.reduce((total, order) => total + order.quantity, 0) +
          quantity >
        ticketingConfig.maxPerAccount
      )
        throw new TicketingError("ACCOUNT_LIMIT", 409);
      return {
        ticketId,
        quantity,
        quoteVersion: version(ticket),
        unitAmount: ticket.unitAmount,
        totalAmount: ticket.unitAmount * quantity,
        currency: ticketingConfig.currency,
        ticketName: ticket.name,
        policy: ticketingConfig.event.policy,
      };
    }),
  );
}
export async function createOrder(
  user: AuthUser,
  value: CreateOrderInput,
): Promise<OrderDto> {
  requireTicketing();
  const input = record(value);
  // Normalize request shape independently of current configuration: historical
  // idempotency keys must keep working after question/ticket configuration changes.
  const ticketId = text(input.ticketId, 100, true);
  const quantity = input.quantity as number;
  if (!Number.isSafeInteger(quantity) || quantity < 1) invalid();
  const answers = validateAnswers(input.answers, false);
  const quoteVersion = text(input.quoteVersion, 128, true);
  const idempotencyKey = text(input.idempotencyKey, 128, true);
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) invalid();
  const requestHash = hash({ ticketId, quantity, answers, quoteVersion });
  await maintainOrders();
  const order = await serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const keyScope = and(
        eq(ticketOrderKeys.userId, user.id),
        eq(ticketOrderKeys.eventId, ticketingConfig.event.id),
        eq(ticketOrderKeys.key, idempotencyKey),
      );
      const [mapping] = await tx
        .select()
        .from(ticketOrderKeys)
        .where(keyScope)
        .limit(1);
      if (mapping) {
        if (mapping.requestHash !== requestHash)
          throw new TicketingError("IDEMPOTENCY_CONFLICT", 409);
        return orderById(tx, mapping.orderId);
      }
      const remember = async (order: Order) => {
        await tx.insert(ticketOrderKeys).values({
          id: randomUUID(),
          userId: user.id,
          eventId: ticketingConfig.event.id,
          key: idempotencyKey,
          orderId: order.id,
          requestHash,
          createdAt: new Date(),
        });
        return order;
      };
      const [previous] = await tx
        .select()
        .from(ticketOrders)
        .where(
          and(
            eq(ticketOrders.eventId, ticketingConfig.event.id),
            eq(ticketOrders.userId, user.id),
            eq(ticketOrders.idempotencyKey, idempotencyKey),
          ),
        )
        .limit(1);
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new TicketingError("IDEMPOTENCY_CONFLICT", 409);
        return remember(previous);
      }
      const { ticket } = validateInput(input);
      if (version(ticket) !== quoteVersion)
        throw new TicketingError("QUOTE_CHANGED", 409, undefined, {
          ticketId,
          quantity,
          quoteVersion: version(ticket),
          unitAmount: ticket.unitAmount,
          totalAmount: ticket.unitAmount * quantity,
          currency: ticketingConfig.currency,
          ticketName: ticket.name,
          policy: ticketingConfig.event.policy,
        });
      await seedInventory(tx);
      const accountOrders = await tx
        .select()
        .from(ticketOrders)
        .where(
          and(
            eq(ticketOrders.eventId, ticketingConfig.event.id),
            eq(ticketOrders.userId, user.id),
            inArray(ticketOrders.status, ["paid", "pending"]),
          ),
        );
      const pending = accountOrders.find((order) => order.status === "pending");
      if (pending) {
        if (pending.requestHash === requestHash) return remember(pending);
        throw new TicketingError("PENDING_ORDER_EXISTS", 409, pending.id);
      }
      if (
        accountOrders.reduce((total, order) => total + order.quantity, 0) +
          quantity >
        ticketingConfig.maxPerAccount
      )
        throw new TicketingError("ACCOUNT_LIMIT", 409);
      const [stock] = await tx
        .select()
        .from(ticketInventory)
        .where(inventoryScope(ticketId));
      requireSale(ticket, stock.total - stock.sold - stock.reserved, quantity);
      const now = new Date();
      const expiresAt = new Date(
        Math.min(
          now.getTime() + ticketingConfig.reservationMinutes * 60000,
          Date.parse(ticket.closesAt),
        ),
      );
      const snapshot: Snapshot = structuredClone({
        eventName: ticketingConfig.event.name,
        ticketName: ticket.name,
        policy: ticketingConfig.event.policy,
        policyVersion: ticketingConfig.policyVersion,
        event: ticketingConfig.event,
        ticket,
        questions: ticketingConfig.questions,
        maxPerAccount: ticketingConfig.maxPerAccount,
        reservationMinutes: ticketingConfig.reservationMinutes,
        currency: ticketingConfig.currency,
      });
      const [created] = await tx
        .insert(ticketOrders)
        .values({
          id: randomUUID(),
          userId: user.id,
          eventId: ticketingConfig.event.id,
          ticketId,
          status: "pending",
          quantity,
          currency: ticketingConfig.currency,
          unitAmount: ticket.unitAmount,
          totalAmount: ticket.unitAmount * quantity,
          snapshot,
          answers,
          displayName: answers.displayName,
          email: user.email,
          idempotencyKey,
          requestHash,
          quoteVersion,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await tx.insert(ticketReservations).values({
        id: randomUUID(),
        orderId: created.id,
        quantity,
        status: ticket.unitAmount === 0 ? "converted" : "held",
        expiresAt,
        createdAt: now,
      });
      if (ticket.unitAmount === 0) {
        await tx
          .update(ticketInventory)
          .set({ sold: stock.sold + quantity, updatedAt: now })
          .where(inventoryScope(ticketId));
        const [paid] = await tx
          .update(ticketOrders)
          .set({ status: "paid", paidAt: now, updatedAt: now })
          .where(eq(ticketOrders.id, created.id))
          .returning();
        return remember(paid);
      }
      await tx
        .update(ticketInventory)
        .set({ reserved: stock.reserved + quantity, updatedAt: now })
        .where(inventoryScope(ticketId));
      return remember(created);
    }),
  );
  return dto(order);
}
/** All provider calls happen outside the business write lock. */
async function applyProvider(
  transaction: NonNullable<
    Awaited<ReturnType<typeof provider.queryTransaction>>
  >,
  notification?: provider.PaymentNotification,
) {
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(ticketPaymentAttempts)
        .where(eq(ticketPaymentAttempts.id, transaction.attemptId))
        .limit(1);
      if (!attempt) throw new TicketingError("INVALID_NOTIFICATION");
      const order = await orderById(tx, attempt.orderId);
      if (
        transaction.orderId !== order.id ||
        transaction.amount !== order.totalAmount ||
        transaction.currency !== order.currency ||
        (attempt.providerTransactionId &&
          attempt.providerTransactionId !== transaction.id)
      )
        throw new TicketingError("INVALID_NOTIFICATION");
      if (notification) {
        if (
          notification.attemptId !== attempt.id ||
          notification.transactionId !== transaction.id ||
          notification.orderId !== order.id ||
          notification.amount !== order.totalAmount ||
          notification.currency !== order.currency
        )
          throw new TicketingError("INVALID_NOTIFICATION");
        const [seen] = await tx
          .select()
          .from(ticketPaymentNotifications)
          .where(eq(ticketPaymentNotifications.eventId, notification.eventId))
          .limit(1);
        if (seen) {
          if (
            seen.attemptId !== attempt.id ||
            hash(seen.payload) !== hash(notification)
          )
            throw new TicketingError("INVALID_NOTIFICATION");
          return;
        }
        await tx.insert(ticketPaymentNotifications).values({
          id: randomUUID(),
          eventId: notification.eventId,
          attemptId: attempt.id,
          receivedAt: new Date(),
          payload: notification,
        });
      }
      const state = transaction.state;
      const now = new Date();
      if (attempt.status === "succeeded" && state !== "succeeded") return;
      await tx
        .update(ticketPaymentAttempts)
        .set({
          providerTransactionId: transaction.id,
          status:
            state === "unknown"
              ? attempt.status === "creating"
                ? "pending"
                : attempt.status
              : state,
          failureCode:
            state === "unknown"
              ? "PROVIDER_UNKNOWN"
              : state === "failed"
                ? "SIMULATED_FAILURE"
                : null,
          updatedAt: now,
        })
        .where(eq(ticketPaymentAttempts.id, attempt.id));
      if (state !== "succeeded") return;
      if (order.status === "closed") {
        await tx
          .update(ticketOrders)
          .set({ reconciliationRequired: true, updatedAt: now })
          .where(eq(ticketOrders.id, order.id));
        return;
      }
      if (order.status === "paid") {
        if (attempt.status !== "succeeded")
          await tx
            .update(ticketOrders)
            .set({ reconciliationRequired: true, updatedAt: now })
            .where(eq(ticketOrders.id, order.id));
        return;
      }
      const [reservation] = await tx
        .select()
        .from(ticketReservations)
        .where(eq(ticketReservations.orderId, order.id));
      if (!reservation || reservation.status !== "held")
        throw new TicketingError("INTERNAL_ERROR", 500);
      const [stock] = await tx
        .select()
        .from(ticketInventory)
        .where(
          and(
            eq(ticketInventory.eventId, order.eventId),
            eq(ticketInventory.ticketId, order.ticketId),
          ),
        );
      if (!stock || stock.reserved < order.quantity)
        throw new TicketingError("INTERNAL_ERROR", 500);
      await tx
        .update(ticketReservations)
        .set({ status: "converted" })
        .where(eq(ticketReservations.id, reservation.id));
      await tx
        .update(ticketInventory)
        .set({
          reserved: stock.reserved - order.quantity,
          sold: stock.sold + order.quantity,
          updatedAt: now,
        })
        .where(
          and(
            eq(ticketInventory.eventId, order.eventId),
            eq(ticketInventory.ticketId, order.ticketId),
          ),
        );
      await tx
        .update(ticketOrders)
        .set({ status: "paid", paidAt: now, closeReason: null, updatedAt: now })
        .where(eq(ticketOrders.id, order.id));
    }),
  );
}
function providerInput(order: Order, attempt: Attempt): provider.ProviderInput {
  return {
    attemptId: attempt.id,
    orderId: order.id,
    amount: order.totalAmount,
    currency: order.currency,
  };
}
async function refreshOrder(id: string) {
  const db = await getDb();
  const order = await orderById(db, id);
  if (order.status !== "pending") return order;
  if (order.expiresAt.getTime() <= Date.now() || order.closeReason)
    return closeInternal(
      id,
      order.expiresAt.getTime() <= Date.now() ? "expired" : "cancelled",
    );
  for (const attempt of await attemptsFor(db, id)) {
    const transaction = await provider.queryTransaction(attempt.id);
    if (transaction) await applyProvider(transaction);
  }
  return orderById(await getDb(), id);
}
export async function getOrder(user: AuthUser, id: string) {
  requireTicketing();
  await ownedOrder(user, id);
  return dto(await refreshOrder(id));
}
export async function listOrders(
  user: AuthUser,
  page = 1,
): Promise<OrderListDto> {
  requireTicketing();
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > Math.floor(Number.MAX_SAFE_INTEGER / 10)
  )
    invalid();
  const db = await getDb();
  const scope = and(
    eq(ticketOrders.userId, user.id),
    eq(ticketOrders.eventId, ticketingConfig.event.id),
  );
  const pending = await db
    .select({ id: ticketOrders.id })
    .from(ticketOrders)
    .where(and(scope, eq(ticketOrders.status, "pending")));
  // The provider is queried outside the shared write lock; only this buyer's
  // current event is refreshed, never the global maintenance operation.
  for (const order of pending) await refreshOrder(order.id);
  const [totals, rows] = await Promise.all([
    db.select({ total: count() }).from(ticketOrders).where(scope),
    db
      .select()
      .from(ticketOrders)
      .where(scope)
      .orderBy(desc(ticketOrders.createdAt), desc(ticketOrders.id))
      .limit(10)
      .offset((page - 1) * 10),
  ]);
  const orders = await Promise.all(
    rows.map(async (row) => {
      const value = await dto(row);
      return {
        id: value.id,
        eventId: value.eventId,
        eventName: value.eventName,
        ticketName: value.ticketName,
        quantity: value.quantity,
        totalAmount: value.totalAmount,
        currency: value.currency,
        createdAt: value.createdAt,
        status: value.status,
        paymentStatus: value.paymentStatus,
        reconciliationRequired: value.reconciliationRequired,
        canPay: value.canPay,
        timeZone: value.event.timeZone,
      };
    }),
  );
  const total = totals[0].total;
  return {
    orders,
    total,
    page,
    pageSize: 10,
    totalPages: Math.ceil(total / 10),
  };
}
export async function startPayment(user: AuthUser, id: string) {
  requireTicketing();
  provider.ensureProviderConfigured();
  await ownedOrder(user, id);
  await refreshOrder(id);
  const prepared = await serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const order = await orderById(tx, id);
      if (
        order.status !== "pending" ||
        order.expiresAt.getTime() <= Date.now() ||
        order.closeReason
      )
        throw new TicketingError("ORDER_NOT_PAYABLE", 409);
      const latest = (await attemptsFor(tx, id))[0];
      if (latest && ["creating", "pending"].includes(latest.status))
        return { order, attempt: latest };
      const now = new Date(
        Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1),
      );
      const [attempt] = await tx
        .insert(ticketPaymentAttempts)
        .values({
          id: randomUUID(),
          orderId: id,
          status: "creating",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return { order, attempt };
    }),
  );
  const transaction = await provider.createTransaction(
    providerInput(prepared.order, prepared.attempt),
  );
  await applyProvider(transaction);
  return dto(await orderById(await getDb(), id));
}
async function closeInternal(id: string, reason: string): Promise<Order> {
  const prepared = await serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const order = await orderById(tx, id);
      if (order.status !== "pending")
        return { order, attempts: [] as Attempt[] };
      await tx
        .update(ticketOrders)
        .set({ closeReason: `closing:${reason}`, updatedAt: new Date() })
        .where(eq(ticketOrders.id, id));
      return { order, attempts: await attemptsFor(tx, id) };
    }),
  );
  if (prepared.order.status !== "pending") return prepared.order;
  let unknown = false;
  for (const attempt of prepared.attempts) {
    const queried = await provider.queryTransaction(attempt.id);
    const transaction =
      queried?.state === "succeeded"
        ? queried
        : await provider.closeTransaction(
            providerInput(prepared.order, attempt),
          );
    await applyProvider(transaction);
    if (transaction.state === "unknown") unknown = true;
  }
  if (unknown) return orderById(await getDb(), id);
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const order = await orderById(tx, id);
      if (order.status !== "pending") return order;
      const [reservation] = await tx
        .select()
        .from(ticketReservations)
        .where(eq(ticketReservations.orderId, id));
      if (!reservation || reservation.status !== "held")
        throw new TicketingError("INTERNAL_ERROR", 500);
      const [stock] = await tx
        .select()
        .from(ticketInventory)
        .where(
          and(
            eq(ticketInventory.eventId, order.eventId),
            eq(ticketInventory.ticketId, order.ticketId),
          ),
        );
      await tx
        .update(ticketInventory)
        .set({
          reserved: stock.reserved - order.quantity,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ticketInventory.eventId, order.eventId),
            eq(ticketInventory.ticketId, order.ticketId),
          ),
        );
      await tx
        .update(ticketReservations)
        .set({ status: "released" })
        .where(eq(ticketReservations.id, reservation.id));
      const [closed] = await tx
        .update(ticketOrders)
        .set({
          status: "closed",
          closeReason: reason,
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(ticketOrders.id, id))
        .returning();
      return closed;
    }),
  );
}
export async function closeOrder(user: AuthUser, id: string) {
  requireTicketing();
  const order = await ownedOrder(user, id);
  return dto(
    await closeInternal(
      id,
      order.expiresAt.getTime() <= Date.now() ? "expired" : "cancelled",
    ),
  );
}
export async function simulatePayment(
  user: AuthUser,
  id: string,
  action: SimulationAction,
) {
  requireTicketing();
  provider.ensureProviderConfigured();
  if (
    ![
      "success",
      "failure",
      "cancel",
      "unknown",
      "duplicate",
      "late_success",
    ].includes(action)
  )
    invalid();
  await ownedOrder(user, id);
  if (action === "late_success") {
    const existing = await attemptsFor(await getDb(), id);
    if (!existing.length) await startPayment(user, id);
    await closeInternal(id, "cancelled");
  } else {
    const order = await orderById(await getDb(), id);
    if (order.status === "pending" && order.expiresAt.getTime() <= Date.now())
      await closeInternal(id, "expired");
  }
  const latest = (await attemptsFor(await getDb(), id))[0];
  if (!latest) throw new TicketingError("PAYMENT_NOT_STARTED", 409);
  const transaction = await provider.simulateTransaction(latest.id, action);
  const payload = provider.notificationFor(
    transaction,
    action === "duplicate" ? `duplicate-${transaction.id}` : randomUUID(),
  );
  const raw = JSON.stringify(payload);
  await handleNotification(raw, provider.signNotification(raw));
  if (action === "duplicate")
    await handleNotification(raw, provider.signNotification(raw));
  return dto(await orderById(await getDb(), id));
}
export async function handleNotification(rawBody: string, signature: string) {
  requireTicketing();
  provider.ensureProviderConfigured();
  if (typeof rawBody !== "string" || Buffer.byteLength(rawBody) > 65536)
    invalid();
  const notification = provider.verifyNotification(rawBody, signature);
  const [seen] = await (
    await getDb()
  )
    .select()
    .from(ticketPaymentNotifications)
    .where(eq(ticketPaymentNotifications.eventId, notification.eventId))
    .limit(1);
  if (seen) {
    if (
      seen.attemptId !== notification.attemptId ||
      hash(seen.payload) !== hash(notification)
    )
      throw new TicketingError("INVALID_NOTIFICATION");
    return { ok: true as const };
  }
  if (Math.abs(Date.now() - notification.timestamp) > 5 * 60000)
    throw new TicketingError("INVALID_NOTIFICATION");
  const transaction = await provider.queryTransaction(notification.attemptId);
  if (!transaction) throw new TicketingError("INVALID_NOTIFICATION");
  await applyProvider(transaction, notification);
  return { ok: true as const };
}
export async function maintainOrders() {
  requireTicketing();
  const orders = await (
    await getDb()
  )
    .select()
    .from(ticketOrders)
    .where(
      and(
        eq(ticketOrders.eventId, ticketingConfig.event.id),
        eq(ticketOrders.status, "pending"),
      ),
    );
  const result = { checked: orders.length, closed: 0, paid: 0, unknown: 0 };
  for (const order of orders) {
    const current = await refreshOrder(order.id);
    if (current.status === "closed") result.closed++;
    if (current.status === "paid") result.paid++;
    if (
      current.status === "pending" &&
      (await attemptsFor(await getDb(), order.id)).some(
        (attempt) => attempt.failureCode === "PROVIDER_UNKNOWN",
      )
    )
      result.unknown++;
  }
  return result;
}
