import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import { mockPaymentTransactions } from "./schema";
import type { MockPaymentState } from "./schema";
import type { SimulationAction } from "./contracts";
import { TicketingError } from "./errors";

export interface ProviderInput {
  attemptId: string;
  orderId: string;
  amount: number;
  currency: string;
}
export interface PaymentNotification extends ProviderInput {
  eventId: string;
  transactionId: string;
  state: MockPaymentState;
  timestamp: number;
}
function webhookSecret() {
  const configured = process.env.TICKETING_WEBHOOK_SECRET;
  if (configured && configured.length >= 32) return configured;
  throw new TicketingError("PAYMENT_NOT_CONFIGURED", 503);
}
export function ensureProviderConfigured() {
  webhookSecret();
}
export function signNotification(rawBody: string) {
  return createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
}
export function verifyNotification(
  rawBody: string,
  signature: string,
): PaymentNotification {
  if (
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(signNotification(rawBody), "hex"),
    )
  )
    throw new TicketingError("INVALID_SIGNATURE", 403);
  try {
    const payload = JSON.parse(rawBody) as PaymentNotification;
    const id =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (
      !payload ||
      typeof payload !== "object" ||
      !id.test(payload.attemptId) ||
      !id.test(payload.orderId) ||
      !id.test(payload.transactionId) ||
      typeof payload.eventId !== "string" ||
      payload.eventId.length > 200 ||
      !payload.eventId ||
      !Number.isSafeInteger(payload.timestamp) ||
      !Number.isSafeInteger(payload.amount) ||
      payload.amount < 0 ||
      typeof payload.currency !== "string" ||
      ![
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        "closed",
        "unknown",
      ].includes(payload.state)
    )
      throw new Error();
    return payload;
  } catch {
    throw new TicketingError("INVALID_NOTIFICATION");
  }
}
/** Mock adapter has independent durable state. Call WITHOUT the business write lock. */
export async function createTransaction(input: ProviderInput) {
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(mockPaymentTransactions)
        .where(eq(mockPaymentTransactions.attemptId, input.attemptId))
        .limit(1);
      if (existing) return existing;
      const now = new Date();
      const [created] = await tx
        .insert(mockPaymentTransactions)
        .values({
          id: randomUUID(),
          ...input,
          state: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return created;
    }),
  );
}
export async function queryTransaction(attemptId: string) {
  const [transaction] = await (
    await getDb()
  )
    .select()
    .from(mockPaymentTransactions)
    .where(eq(mockPaymentTransactions.attemptId, attemptId))
    .limit(1);
  return transaction ?? null;
}
export async function closeTransaction(input: ProviderInput) {
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(mockPaymentTransactions)
        .where(eq(mockPaymentTransactions.attemptId, input.attemptId))
        .limit(1);
      if (!existing) {
        // A close tombstone fences a create call still in flight.
        const [closed] = await tx
          .insert(mockPaymentTransactions)
          .values({
            id: randomUUID(),
            ...input,
            state: "closed",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        return closed;
      }
      if (existing.state === "unknown" || existing.state === "succeeded")
        return existing;
      const [closed] = await tx
        .update(mockPaymentTransactions)
        .set({ state: "closed", updatedAt: new Date() })
        .where(eq(mockPaymentTransactions.id, existing.id))
        .returning();
      return closed;
    }),
  );
}
export async function simulateTransaction(
  attemptId: string,
  action: SimulationAction,
) {
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(mockPaymentTransactions)
        .where(eq(mockPaymentTransactions.attemptId, attemptId))
        .limit(1);
      if (!existing) throw new TicketingError("NOT_FOUND", 404);
      if (action === "duplicate") return existing;
      if (existing.state === "succeeded") return existing;
      if (existing.state === "closed" && action !== "late_success")
        return existing;
      if (
        ["failed", "cancelled"].includes(existing.state) &&
        action !== "late_success"
      )
        return existing;
      const state: MockPaymentState =
        action === "success" || action === "late_success"
          ? "succeeded"
          : action === "failure"
            ? "failed"
            : action === "cancel"
              ? "cancelled"
              : "unknown";
      const [changed] = await tx
        .update(mockPaymentTransactions)
        .set({ state, updatedAt: new Date() })
        .where(eq(mockPaymentTransactions.id, existing.id))
        .returning();
      return changed;
    }),
  );
}
export function notificationFor(
  transaction: typeof mockPaymentTransactions.$inferSelect,
  eventId: string = randomUUID(),
): PaymentNotification {
  return {
    eventId,
    attemptId: transaction.attemptId,
    transactionId: transaction.id,
    orderId: transaction.orderId,
    amount: transaction.amount,
    currency: transaction.currency,
    state: transaction.state,
    timestamp: Date.now(),
  };
}
