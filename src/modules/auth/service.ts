import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, serializeDatabaseWrite as serialized } from "../../lib/db";
import { challenges, devMails, sendEvents, sessions, users } from "./schema";
import { createDevMail, isDevMailEnabled } from "./mail";
export { isDevMailEnabled, listDevMails } from "./mail";

import { AuthError } from "./errors";
import { AUTH_POLICY, SESSION_SECONDS } from "./policy";
import type { AuthLanguage, AuthUser, SendCodeResponse } from "./contracts";
export { AuthError } from "./errors";
export { SESSION_COOKIE, SESSION_SECONDS } from "./policy";
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthError("INVALID_EMAIL");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthError("INVALID_EMAIL");
  return email;
}
function secret() {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;
  throw new AuthError("INTERNAL_ERROR", 500);
}
function hashCode(id: string, email: string, code: string) {
  return createHmac("sha256", secret())
    .update(JSON.stringify([id, email, code]))
    .digest("hex");
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function requireMail() {
  if (!isDevMailEnabled()) throw new AuthError("MAIL_DISABLED", 503);
}

export async function sendCode(
  input: string,
  language: AuthLanguage,
  ip: string,
): Promise<SendCodeResponse> {
  requireMail();
  const email = normalizeEmail(input);
  if (language !== "zh" && language !== "en")
    throw new AuthError("INVALID_REQUEST");
  return serialized(async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const now = new Date();
      const windowMs = AUTH_POLICY.rateWindowSeconds * 1000;
      const cooldownMs = AUTH_POLICY.resendIntervalSeconds * 1000;
      const since = new Date(now.getTime() - windowMs);
      const emailEvents = await tx
        .select()
        .from(sendEvents)
        .where(
          and(eq(sendEvents.email, email), gt(sendEvents.createdAt, since)),
        )
        .orderBy(desc(sendEvents.createdAt));
      const ipEvents = await tx
        .select()
        .from(sendEvents)
        .where(and(eq(sendEvents.ip, ip), gt(sendEvents.createdAt, since)))
        .orderBy(desc(sendEvents.createdAt));
      const latest = emailEvents[0];
      if (latest && now.getTime() - latest.createdAt.getTime() < cooldownMs)
        throw new AuthError(
          "RATE_LIMITED",
          429,
          Math.ceil(
            (cooldownMs - now.getTime() + latest.createdAt.getTime()) / 1000,
          ),
        );
      if (
        emailEvents.length >= AUTH_POLICY.emailSendsPerWindow ||
        ipEvents.length >= AUTH_POLICY.ipSendsPerWindow
      ) {
        const blocked =
          emailEvents.length >= AUTH_POLICY.emailSendsPerWindow
            ? emailEvents[emailEvents.length - AUTH_POLICY.emailSendsPerWindow]
            : ipEvents[ipEvents.length - AUTH_POLICY.ipSendsPerWindow];
        throw new AuthError(
          "RATE_LIMITED",
          429,
          Math.max(
            1,
            Math.ceil(
              (blocked.createdAt.getTime() + windowMs - now.getTime()) / 1000,
            ),
          ),
        );
      }
      const id = randomUUID();
      const code = String(randomInt(0, 1000000)).padStart(6, "0");
      const codeHash = hashCode(id, email, code);
      await tx
        .update(challenges)
        .set({ consumedAt: now })
        .where(and(eq(challenges.email, email), isNull(challenges.consumedAt)));
      await tx.insert(challenges).values({
        id,
        email,
        codeHash,
        attempts: 0,
        createdAt: now,
        expiresAt: new Date(
          now.getTime() + AUTH_POLICY.codeLifetimeSeconds * 1000,
        ),
      });
      await tx
        .insert(sendEvents)
        .values({ id: randomUUID(), email, ip, createdAt: now });
      await tx
        .insert(devMails)
        .values(createDevMail(email, language, code, now));
      return {
        ok: true as const,
        retryAfter: AUTH_POLICY.resendIntervalSeconds,
        expiresIn: AUTH_POLICY.codeLifetimeSeconds,
      };
    });
  });
}

export async function verifyCode(input: string, code: string) {
  requireMail();
  const email = normalizeEmail(input);
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    throw new AuthError("INVALID_CODE");
  const outcome = await serialized(async () => {
    return (await getDb()).transaction(async (tx) => {
      const now = new Date();
      const [challenge] = await tx
        .select()
        .from(challenges)
        .where(eq(challenges.email, email))
        .orderBy(desc(challenges.createdAt))
        .limit(1);
      if (!challenge || challenge.consumedAt)
        return { error: new AuthError("INVALID_CODE") };
      if (challenge.expiresAt <= now)
        return { error: new AuthError("CODE_EXPIRED") };
      if (challenge.attempts >= AUTH_POLICY.maxCodeAttempts)
        return { error: new AuthError("TOO_MANY_ATTEMPTS", 429) };
      const expected = Buffer.from(challenge.codeHash, "hex");
      const actual = Buffer.from(hashCode(challenge.id, email, code), "hex");
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      ) {
        await tx
          .update(challenges)
          .set({ attempts: challenge.attempts + 1 })
          .where(eq(challenges.id, challenge.id));
        return {
          error: new AuthError(
            challenge.attempts + 1 >= AUTH_POLICY.maxCodeAttempts
              ? "TOO_MANY_ATTEMPTS"
              : "INVALID_CODE",
            challenge.attempts + 1 >= AUTH_POLICY.maxCodeAttempts ? 429 : 400,
          ),
        };
      }
      await tx
        .update(challenges)
        .set({ consumedAt: now })
        .where(eq(challenges.id, challenge.id));
      const [user] = await tx
        .insert(users)
        .values({ id: randomUUID(), email, createdAt: now })
        .onConflictDoUpdate({ target: users.email, set: { email } })
        .returning();
      const token = randomBytes(32).toString("hex");
      await tx.insert(sessions).values({
        id: randomUUID(),
        userId: user.id,
        tokenHash: hashToken(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
      });
      return { user, token };
    });
  });
  if ("error" in outcome) throw outcome.error;
  return outcome;
}

export async function revokeSession(token: string) {
  await serialized(async () => {
    await (
      await getDb()
    )
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
  });
}
export async function getUserByToken(
  token: string | undefined,
): Promise<AuthUser | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [result] = await (
    await getDb()
  )
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return result ?? null;
}

/** Read-only integration lookup. Never creates an account or grants privileges. */
export async function findRegisteredUserByEmail(
  email: string,
): Promise<AuthUser | null> {
  const normalized = normalizeEmail(email);
  const [user] = await (
    await getDb()
  )
    .select({ id: users.id, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  return user ?? null;
}
