/** Test-only preparation: close the private DB before starting Next.js. */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../../src/lib/db";
import { sendCode, verifyCode } from "../../src/modules/auth/service";
import { devMails, sendEvents } from "../../src/lib/schema";
import {
  bootstrapAdministrator,
  grantAdministrator,
} from "../../src/modules/admin/service";

async function main() {
  Object.assign(process.env, { NODE_ENV: "development" });
  const fixtureFile = path.resolve(process.env.ADMIN_FIXTURE_FILE || "");
  const directory = path.dirname(fixtureFile);
  if (
    !/^admin-e2e-\d+$/.test(path.basename(directory)) ||
    path.dirname(directory) !== path.resolve(".data") ||
    path.resolve(process.env.DB_PATH || "") !== path.join(directory, "db")
  )
    throw new Error("Fixtures must use a dedicated admin-e2e directory");
  const identities: Record<
    string,
    { id: string; email: string; token: string }
  > = {};
  try {
    const db = await getDb();
    for (const name of [
      "super",
      "operator",
      "normal",
      "network",
      "material-normal",
      "material-network",
      "content-normal",
      "other-super",
      ...Array.from({ length: 21 }, (_, i) => `fixture-${i}`),
    ]) {
      const email = `${name}@admin-tests.example.com`;
      await sendCode(email, "zh", email);
      const [mail] = await db
        .select()
        .from(devMails)
        .where(eq(devMails.email, email));
      const code = mail.body.match(/\b\d{6}\b/)?.[0];
      if (!code) throw new Error("Fixture email was not generated");
      const verified = await verifyCode(email, code);
      identities[name] = { ...verified.user, token: verified.token };
      // One real browser-login test can request another code immediately.
      await db
        .update(sendEvents)
        .set({ createdAt: new Date(Date.now() - 61_000) })
        .where(eq(sendEvents.email, email));
    }
    const superUser = identities.super;
    await bootstrapAdministrator(superUser.email, "isolated-browser-fixture");
    for (const [name, identity] of Object.entries(identities)) {
      if (
        name === "super" ||
        name === "normal" ||
        name === "network" ||
        name.startsWith("material-") ||
        name === "content-normal"
      )
        continue;
      await grantAdministrator(
        { ...superUser, createdAt: new Date() },
        {
          email: identity.email,
          role: name === "other-super" ? "super_admin" : "operator",
        },
      );
    }
    await mkdir(directory, { recursive: true });
    await writeFile(fixtureFile, JSON.stringify(identities), { mode: 0o600 });
  } finally {
    await closeDb();
  }
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { stdio: "inherit", env: process.env },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => process.exit(code ?? 1));
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Fixture setup failed",
  );
  process.exitCode = 1;
});
