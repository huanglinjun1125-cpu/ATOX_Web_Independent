import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

const date = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export type TicketOrderStatus = "pending" | "paid" | "closed";
export type TicketReservationStatus = "held" | "converted" | "released";
export type TicketPaymentStatus =
  "creating" | "pending" | "succeeded" | "failed" | "cancelled" | "closed";
export type MockPaymentState =
  "pending" | "succeeded" | "failed" | "cancelled" | "closed" | "unknown";

export const ticketInventory = pgTable(
  "ticket_inventory",
  {
    eventId: text("event_id").notNull(),
    ticketId: text("ticket_id").notNull(),
    total: integer("total").notNull(),
    sold: integer("sold").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    updatedAt: date("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("ticket_inventory_event_ticket_unique").on(
      table.eventId,
      table.ticketId,
    ),
    check(
      "ticket_inventory_nonnegative",
      sql`${table.total} >= 0 AND ${table.sold} >= 0 AND ${table.reserved} >= 0`,
    ),
    check(
      "ticket_inventory_capacity",
      sql`${table.sold} + ${table.reserved} <= ${table.total}`,
    ),
  ],
);

export const ticketOrders = pgTable(
  "ticket_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventId: text("event_id").notNull(),
    ticketId: text("ticket_id").notNull(),
    status: text("status")
      .$type<TicketOrderStatus>()
      .notNull()
      .default("pending"),
    quantity: integer("quantity").notNull(),
    currency: text("currency").notNull(),
    unitAmount: integer("unit_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    answers: jsonb("answers").$type<unknown>().notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    quoteVersion: text("quote_version").notNull(),
    expiresAt: date("expires_at").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
    updatedAt: date("updated_at").notNull().defaultNow(),
    paidAt: date("paid_at"),
    closedAt: date("closed_at"),
    closeReason: text("close_reason"),
    reconciliationRequired: boolean("reconciliation_required")
      .notNull()
      .default(false),
  },
  (table) => [
    unique("ticket_orders_user_event_idempotency_unique").on(
      table.userId,
      table.eventId,
      table.idempotencyKey,
    ),
    uniqueIndex("ticket_orders_user_event_pending_unique")
      .on(table.userId, table.eventId)
      .where(sql`${table.status} = 'pending'`),
    index("ticket_orders_status_expiry_idx").on(table.status, table.expiresAt),
    index("ticket_orders_user_created_idx").on(table.userId, table.createdAt),
    check("ticket_orders_positive_quantity", sql`${table.quantity} > 0`),
    check(
      "ticket_orders_nonnegative_amounts",
      sql`${table.unitAmount} >= 0 AND ${table.totalAmount} >= 0`,
    ),
    check(
      "ticket_orders_status_valid",
      sql`${table.status} IN ('pending', 'paid', 'closed')`,
    ),
  ],
);

export const ticketOrderKeys = pgTable(
  "ticket_order_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventId: text("event_id").notNull(),
    key: text("key").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ticketOrders.id, { onDelete: "restrict" }),
    requestHash: text("request_hash").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("ticket_order_keys_user_event_key_unique").on(
      table.userId,
      table.eventId,
      table.key,
    ),
    index("ticket_order_keys_order_idx").on(table.orderId),
  ],
);

export const ticketReservations = pgTable(
  "ticket_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => ticketOrders.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    status: text("status")
      .$type<TicketReservationStatus>()
      .notNull()
      .default("held"),
    expiresAt: date("expires_at").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ticket_reservations_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
    check("ticket_reservations_positive_quantity", sql`${table.quantity} > 0`),
    check(
      "ticket_reservations_status_valid",
      sql`${table.status} IN ('held', 'converted', 'released')`,
    ),
  ],
);

export const ticketPaymentAttempts = pgTable(
  "ticket_payment_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ticketOrders.id, { onDelete: "restrict" }),
    providerTransactionId: text("provider_transaction_id").unique(),
    status: text("status")
      .$type<TicketPaymentStatus>()
      .notNull()
      .default("creating"),
    createdAt: date("created_at").notNull().defaultNow(),
    updatedAt: date("updated_at").notNull().defaultNow(),
    failureCode: text("failure_code"),
  },
  (table) => [
    index("ticket_payment_attempts_order_created_idx").on(
      table.orderId,
      table.createdAt,
    ),
    check(
      "ticket_payment_attempts_status_valid",
      sql`${table.status} IN ('creating', 'pending', 'succeeded', 'failed', 'cancelled', 'closed')`,
    ),
  ],
);

export const ticketPaymentNotifications = pgTable(
  "ticket_payment_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull().unique(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => ticketPaymentAttempts.id, { onDelete: "restrict" }),
    receivedAt: date("received_at").notNull().defaultNow(),
    payload: jsonb("payload").$type<unknown>().notNull(),
  },
  (table) => [
    index("ticket_payment_notifications_attempt_idx").on(table.attemptId),
  ],
);

export const mockPaymentTransactions = pgTable(
  "mock_payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .unique()
      .references(() => ticketPaymentAttempts.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ticketOrders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    state: text("state").$type<MockPaymentState>().notNull().default("pending"),
    createdAt: date("created_at").notNull().defaultNow(),
    updatedAt: date("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("mock_payment_transactions_order_idx").on(table.orderId),
    check(
      "mock_payment_transactions_nonnegative_amount",
      sql`${table.amount} >= 0`,
    ),
    check(
      "mock_payment_transactions_state_valid",
      sql`${table.state} IN ('pending', 'succeeded', 'failed', 'cancelled', 'closed', 'unknown')`,
    ),
  ],
);
