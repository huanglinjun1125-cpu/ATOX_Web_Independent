import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { eq } from "drizzle-orm";

let auth: typeof import("../src/modules/auth/service");
let database: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let temporaryDirectory: string;
let counter = 0;
const email = () => `participant-${++counter}@example.com`;
const expectCode = (code: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, code);
  return true;
};

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "hackathon-auth-"));
  process.env.DB_PATH = path.join(temporaryDirectory, "nested", "database");
  Object.assign(process.env, {
    NODE_ENV: "development",
    ENABLE_DEV_MAIL: "true",
    AUTH_SECRET: "integration-test-only-secret-with-32-characters",
  });
  auth = await import("../src/modules/auth/service");
  database = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  await database.getDb();
});

after(async () => {
  await database?.closeDb();
  if (temporaryDirectory)
    await rm(temporaryDirectory, { recursive: true, force: true });
});

async function sendAndRead(
  address: string,
  ip = address,
  language: "zh" | "en" = "zh",
) {
  const result = await auth.sendCode(address, language, ip);
  assert.equal(result.retryAfter, 60);
  const db = await database.getDb();
  const [mail] = await db
    .select()
    .from(schema.devMails)
    .where(eq(schema.devMails.email, address.trim().toLowerCase()));
  assert.ok(mail);
  assert.equal(mail.language, language);
  const code = mail.body.match(/\b\d{6}\b/)?.[0];
  assert.ok(code, "Development mail contains a six-digit code");
  assert.ok(
    !JSON.stringify(result).includes(code),
    "Response does not contain the code",
  );
  return code;
}

async function clearCooldown(address: string) {
  const db = await database.getDb();
  const previous = new Date(Date.now() - 61_000);
  await db
    .update(schema.sendEvents)
    .set({ createdAt: previous })
    .where(eq(schema.sendEvents.email, address));
  await db
    .update(schema.challenges)
    .set({ createdAt: previous })
    .where(eq(schema.challenges.email, address));
}

test("First verification registers, normalizes email, and creates a hashed session", async () => {
  const address = email();
  const code = await sendAndRead(`  ${address.toUpperCase()}  `);
  const { user, token } = await auth.verifyCode(address, code);
  assert.equal(user.email, address);
  assert.ok(token.length >= 32);
  const db = await database.getDb();
  const [challenge] = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.email, address));
  const [session] = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, user.id));
  assert.notEqual(challenge.codeHash, code);
  assert.notEqual(session.tokenHash, token);
  assert.ok(challenge.consumedAt);
  assert.equal((await auth.getUserByToken(token))?.id, user.id);
  await assert.rejects(
    auth.verifyCode(address, code),
    expectCode("INVALID_CODE"),
  );
});

test("Existing user login does not duplicate the user", async () => {
  const address = email();
  const firstCode = await sendAndRead(address);
  const first = await auth.verifyCode(address, firstCode);
  await clearCooldown(address);
  await auth.sendCode(address, "en", address);
  const mails = (await auth.listDevMails()).filter(
    (mail) => mail.email === address,
  );
  const code = mails[0].body.match(/\b\d{6}\b/)![0];
  const second = await auth.verifyCode(address, code);
  assert.equal(first.user.id, second.user.id);
  const rows = await (
    await database.getDb()
  )
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, address));
  assert.equal(rows.length, 1);
});

test("Concurrent verification consumes one code only once", async () => {
  const address = email();
  const code = await sendAndRead(address);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => auth.verifyCode(address, code)),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
});

test("Failed attempts persist and five failures lock a code", async () => {
  const address = email();
  const code = await sendAndRead(address);
  const wrong = code === "000000" ? "111111" : "000000";
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(auth.verifyCode(address, wrong));
  }
  const [challenge] = await (
    await database.getDb()
  )
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.email, address));
  assert.equal(challenge.attempts, 5);
  await assert.rejects(
    auth.verifyCode(address, code),
    expectCode("TOO_MANY_ATTEMPTS"),
  );
});

test("Expiry and resending invalidate previous challenges", async () => {
  const address = email();
  const old = await sendAndRead(address);
  const db = await database.getDb();
  await db
    .update(schema.challenges)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.challenges.email, address));
  await assert.rejects(
    auth.verifyCode(address, old),
    expectCode("CODE_EXPIRED"),
  );
  await clearCooldown(address);
  await auth.sendCode(address, "en", address);
  const challenges = await db
    .select()
    .from(schema.challenges)
    .where(eq(schema.challenges.email, address));
  assert.equal(
    challenges.filter((challenge) => !challenge.consumedAt).length,
    1,
  );
  assert.equal(challenges.length, 2);
});

test("Email cooldown, hourly email limit, and IP limit are server enforced", async () => {
  const address = email();
  await sendAndRead(address);
  await assert.rejects(
    auth.sendCode(address, "zh", address),
    expectCode("RATE_LIMITED"),
  );
  for (let attempt = 1; attempt < 5; attempt++) {
    await clearCooldown(address);
    await auth.sendCode(address, "zh", address);
  }
  await clearCooldown(address);
  await assert.rejects(
    auth.sendCode(address, "zh", address),
    expectCode("RATE_LIMITED"),
  );
  const sharedIp = "203.0.113.8";
  for (let attempt = 0; attempt < 20; attempt++)
    await auth.sendCode(email(), "zh", sharedIp);
  await assert.rejects(
    auth.sendCode(email(), "zh", sharedIp),
    expectCode("RATE_LIMITED"),
  );
});

test("Sessions persist across database reopen, expire, and are revoked on logout", async () => {
  const address = email();
  const code = await sendAndRead(address);
  const { user, token } = await auth.verifyCode(address, code);
  await database.closeDb();
  const restartedProcess = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      "import {getUserByToken} from './src/modules/auth/service'; import {closeDb} from './src/lib/db'; (async()=>{ try { const user=await getUserByToken(process.env.TEST_SESSION_TOKEN); if(user?.id!==process.env.TEST_USER_ID) process.exitCode=1; } finally {await closeDb();} })()",
    ],
    {
      env: { ...process.env, TEST_SESSION_TOKEN: token, TEST_USER_ID: user.id },
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  assert.equal(
    restartedProcess.status,
    0,
    "A fresh Node process can restore the stored session",
  );
  assert.equal((await auth.getUserByToken(token))?.id, user.id);
  await auth.revokeSession(token);
  assert.equal(await auth.getUserByToken(token), null);
  const db = await database.getDb();
  await clearCooldown(address);
  await auth.sendCode(address, "zh", address);
  const mail = (await auth.listDevMails()).find(
    (item) => item.email === address,
  )!;
  const next = await auth.verifyCode(address, mail.body.match(/\b\d{6}\b/)![0]);
  await db
    .update(schema.sessions)
    .set({ expiresAt: new Date(Date.now() - 1_000) })
    .where(eq(schema.sessions.userId, user.id));
  assert.equal(await auth.getUserByToken(next.token), null);
});

test("Invalid input and production development-mail restrictions", async () => {
  await assert.rejects(
    auth.sendCode("not-an-email", "zh", "local"),
    expectCode("INVALID_EMAIL"),
  );
  const address = email();
  await assert.rejects(
    auth.verifyCode(address, "123"),
    expectCode("INVALID_CODE"),
  );
  const previous = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "production" });
  try {
    assert.equal(auth.isDevMailEnabled(), false);
    await assert.rejects(
      auth.sendCode(address, "zh", "local"),
      expectCode("MAIL_DISABLED"),
    );
    await assert.rejects(
      auth.verifyCode(address, "123456"),
      expectCode("MAIL_DISABLED"),
    );
    assert.deepEqual(await auth.listDevMails(), []);
  } finally {
    Object.assign(process.env, { NODE_ENV: previous });
  }
});
