import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

test("Controlled bootstrap CLI binds a verified account once without altering auth records", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "admin-cli-"));
  Object.assign(process.env, {
    DB_PATH: path.join(directory, "db"),
    NODE_ENV: "development",
    ENABLE_DEV_MAIL: "true",
    AUTH_SECRET: "admin-cli-test-only-secret-with-at-least-32-characters",
  });
  const database = await import("../src/lib/db");
  const auth = await import("../src/modules/auth/service");
  const schema = await import("../src/lib/schema");
  const run = (args: string[]) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/admin-bootstrap.ts", ...args],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        timeout: 60_000,
      },
    );
  try {
    const address = "verified-admin@cli-tests.example.com";
    await auth.sendCode(address, "zh", "cli-test");
    const db = await database.getDb();
    const [mail] = await db
      .select()
      .from(schema.devMails)
      .where(eq(schema.devMails.email, address));
    const verified = await auth.verifyCode(
      address,
      mail.body.match(/\b\d{6}\b/)![0],
    );
    const usersBefore = await db.select().from(schema.users);
    const sessionsBefore = await db.select().from(schema.sessions);
    await database.closeDb();
    assert.equal(run([]).status, 1);
    assert.equal(run(["--email", "missing@cli-tests.example.com"]).status, 1);
    const initialized = run(["--email", address]);
    assert.equal(initialized.status, 0, initialized.stderr);
    assert.equal(run(["--email", address]).status, 0);
    assert.equal(run(["--email", "other@cli-tests.example.com"]).status, 1);
    const reopened = await database.getDb();
    const accounts = await reopened.select().from(schema.administrators);
    const audits = await reopened.select().from(schema.adminAuditLogs);
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].userId, verified.user.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actor.source, "bootstrap");
    assert.equal(audits[0].actor.label, os.userInfo().username);
    assert.deepEqual(await reopened.select().from(schema.users), usersBefore);
    assert.deepEqual(
      await reopened.select().from(schema.sessions),
      sessionsBefore,
    );
    assert.equal(
      (await auth.getUserByToken(verified.token))?.id,
      verified.user.id,
    );
  } finally {
    await database.closeDb();
    await rm(directory, { recursive: true, force: true });
  }
});
