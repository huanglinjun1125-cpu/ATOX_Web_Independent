import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { count, eq, sql } from "drizzle-orm";
import type { AuthUser } from "../src/modules/auth/contracts";
let dbModule: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let service: typeof import("../src/modules/admin/service");
let auth: typeof import("../src/modules/auth/service");
let directory: string;
let owner: AuthUser;
const hasCode = (code: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, code);
  return true;
};
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "admin-rbac-"));
  process.env.DB_PATH = path.join(directory, "db");
  dbModule = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/admin/service");
  auth = await import("../src/modules/auth/service");
  owner = await user("owner@example.com");
});
after(async () => {
  await dbModule?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function user(email = `${randomUUID()}@example.com`): Promise<AuthUser> {
  const user = { id: randomUUID(), email, createdAt: new Date() };
  await (await dbModule.getDb()).insert(schema.users).values(user);
  return user;
}
async function audits() {
  return (
    await (
      await dbModule.getDb()
    )
      .select({ total: count() })
      .from(schema.adminAuditLogs)
  )[0].total;
}
test("Bootstrap binds an existing normalized email exactly once, records local actor and never registers users", async () => {
  const before = (
    await (await dbModule.getDb()).select({ total: count() }).from(schema.users)
  )[0].total;
  await assert.rejects(
    service.bootstrapAdministrator("missing@example.com", "local-user"),
    hasCode("USER_NOT_FOUND"),
  );
  assert.equal(
    (
      await (
        await dbModule.getDb()
      )
        .select({ total: count() })
        .from(schema.users)
    )[0].total,
    before,
  );
  assert.equal(
    await auth.findRegisteredUserByEmail("missing@example.com"),
    null,
  );
  const results = await Promise.all([
    service.bootstrapAdministrator(" OWNER@EXAMPLE.COM ", "machine-user"),
    service.bootstrapAdministrator(owner.email, "machine-user"),
  ]);
  assert.equal(results[0].userId, owner.id);
  assert.equal(results[1].userId, owner.id);
  assert.equal(await audits(), 1);
  assert.deepEqual(results[0].updatedBy, {
    source: "bootstrap",
    userId: null,
    label: "machine-user",
  });
  await assert.rejects(
    service.bootstrapAdministrator("another@example.com", "machine-user"),
    hasCode("ALREADY_INITIALIZED"),
  );
  assert.equal((await service.listAudit(owner)).items[0].action, "bootstrap");
});
test("Operator has business permissions without role management; ordinary users have no administrator identity", async () => {
  const operator = await user(),
    ordinary = await user();
  await service.grantAdministrator(owner, {
    email: operator.email,
    role: "operator",
  });
  assert.deepEqual((await service.getAdministrator(operator))?.permissions, [
    "admin:access",
    "admin:materials",
    "admin:content",
  ]);
  assert.equal(await service.getAdministrator(ordinary), null);
  await assert.rejects(
    service.listAdministrators(operator),
    hasCode("FORBIDDEN"),
  );
  await assert.rejects(service.listAudit(operator), hasCode("FORBIDDEN"));
  await assert.rejects(
    service.grantAdministrator(operator, {
      email: ordinary.email,
      role: "super_admin",
    }),
    hasCode("FORBIDDEN"),
  );
});
test("Unknown fields, missing users, duplicate grants and invalid pagination cannot change permissions", async () => {
  const target = await user();
  const before = await audits();
  await assert.rejects(
    service.grantAdministrator(owner, {
      email: target.email,
      role: "operator",
      enabled: false,
    } as never),
    hasCode("INVALID_INPUT"),
  );
  await assert.rejects(
    service.grantAdministrator(owner, {
      email: "unknown@example.com",
      role: "operator",
    }),
    hasCode("USER_NOT_FOUND"),
  );
  assert.equal(await audits(), before);
  assert.equal(await service.getAdministrator(target), null);
  const created = await service.grantAdministrator(owner, {
    email: target.email,
    role: "operator",
  });
  await assert.rejects(
    service.grantAdministrator(owner, {
      email: target.email,
      role: "super_admin",
    }),
    hasCode("ALREADY_ADMINISTRATOR"),
  );
  await assert.rejects(
    service.updateAdministrator(owner, target.id, {
      role: "super_admin",
      enabled: true,
      revision: created.revision,
      permissions: ["admin:manage"],
    } as never),
    hasCode("INVALID_INPUT"),
  );
  for (const page of [0, -1, 1.5, 1_000_001])
    await assert.rejects(
      service.listAdministrators(owner, page),
      hasCode("INVALID_INPUT"),
    );
});
test("Concurrent stale updates commit one revision and one audit only", async () => {
  const target = await user(),
    current = await service.grantAdministrator(owner, {
      email: target.email,
      role: "operator",
    }),
    before = await audits();
  const results = await Promise.allSettled([
    service.updateAdministrator(owner, target.id, {
      role: "operator",
      enabled: false,
      revision: current.revision,
    }),
    service.updateAdministrator(owner, target.id, {
      role: "super_admin",
      enabled: true,
      revision: current.revision,
    }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "REVISION_CONFLICT");
  assert.equal(await audits(), before + 1);
  const [saved] = await (
    await dbModule.getDb()
  )
    .select()
    .from(schema.administrators)
    .where(eq(schema.administrators.userId, target.id));
  assert.equal(saved.revision, 2);
});
test("Queued mutation rechecks actor permission after downgrade; existing identity loses permission immediately", async () => {
  const second = await user(),
    target = await user();
  const current = await service.grantAdministrator(owner, {
    email: second.email,
    role: "super_admin",
  });
  const revoked = service.updateAdministrator(owner, second.id, {
    role: "operator",
    enabled: true,
    revision: current.revision,
  });
  const queued = service.grantAdministrator(second, {
    email: target.email,
    role: "operator",
  });
  await revoked;
  await assert.rejects(queued, hasCode("FORBIDDEN"));
  assert.deepEqual((await service.getAdministrator(second))?.permissions, [
    "admin:access",
    "admin:materials",
    "admin:content",
  ]);
  assert.equal(await service.getAdministrator(target), null);
});
test("Self-disable and self-demotion are forbidden; bootstrap replay does not restore a disabled account", async () => {
  const [current] = await (
    await dbModule.getDb()
  )
    .select()
    .from(schema.administrators)
    .where(eq(schema.administrators.userId, owner.id));
  await assert.rejects(
    service.updateAdministrator(owner, owner.id, {
      role: "operator",
      enabled: true,
      revision: current.revision,
    }),
    hasCode("SELF_CHANGE_FORBIDDEN"),
  );
  await assert.rejects(
    service.updateAdministrator(owner, owner.id, {
      role: "super_admin",
      enabled: false,
      revision: current.revision,
    }),
    hasCode("SELF_CHANGE_FORBIDDEN"),
  );
  const second = await user();
  await service.grantAdministrator(owner, {
    email: second.email,
    role: "super_admin",
  });
  const disabled = await service.updateAdministrator(second, owner.id, {
    role: "operator",
    enabled: false,
    revision: current.revision,
  });
  assert.equal(await service.getAdministrator(owner), null);
  const before = await audits();
  const replay = await service.bootstrapAdministrator(
    owner.email,
    "different-local-user",
  );
  assert.deepEqual(replay, disabled);
  assert.equal(await audits(), before);
  await service.updateAdministrator(second, owner.id, {
    role: "super_admin",
    enabled: true,
    revision: disabled.revision,
  });
});
test("Audit insertion failure rolls back the administrator grant", async () => {
  const target = await user(),
    db = await dbModule.getDb(),
    before = await audits();
  await db.execute(
    sql`CREATE FUNCTION reject_admin_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$`,
  );
  await db.execute(
    sql`CREATE TRIGGER reject_admin_audit_test BEFORE INSERT ON admin_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_test()`,
  );
  try {
    await assert.rejects(
      service.grantAdministrator(owner, {
        email: target.email,
        role: "operator",
      }),
    );
    assert.equal(await service.getAdministrator(target), null);
    assert.equal(await audits(), before);
  } finally {
    await db.execute(
      sql`DROP TRIGGER reject_admin_audit_test ON admin_audit_logs`,
    );
    await db.execute(sql`DROP FUNCTION reject_admin_audit_test()`);
  }
});
test("Accounts and immutable audit snapshots survive database reopen with stable pagination", async () => {
  const before = await service.listAdministrators(owner),
    log = await service.listAudit(owner);
  await dbModule.closeDb();
  assert.deepEqual(await service.listAdministrators(owner), before);
  assert.deepEqual(await service.listAudit(owner), log);
  assert.equal(before.pageSize, 20);
  assert.equal(before.totalPages, Math.ceil(before.total / 20));
});
test("Two super administrators cannot concurrently disable each other and leave no active super", async () => {
  const db = await dbModule.getDb();
  const all = await db.select().from(schema.administrators);
  for (const administrator of all) {
    if (
      administrator.userId !== owner.id &&
      administrator.enabled &&
      administrator.role === "super_admin"
    )
      await service.updateAdministrator(owner, administrator.userId, {
        role: "operator",
        enabled: true,
        revision: administrator.revision,
      });
  }
  const second = await user();
  const granted = await service.grantAdministrator(owner, {
    email: second.email,
    role: "super_admin",
  });
  const currentOwner = (await service.listAdministrators(owner)).items.find(
    (value) => value.userId === owner.id,
  )!;
  const before = await audits();
  const outcomes = await Promise.allSettled([
    service.updateAdministrator(owner, second.id, {
      role: "super_admin",
      enabled: false,
      revision: granted.revision,
    }),
    service.updateAdministrator(second, owner.id, {
      role: "super_admin",
      enabled: false,
      revision: currentOwner.revision,
    }),
  ]);
  assert.equal(
    outcomes.filter((value) => value.status === "fulfilled").length,
    1,
  );
  assert.equal(
    (
      outcomes.find(
        (value) => value.status === "rejected",
      ) as PromiseRejectedResult
    ).reason.code,
    "FORBIDDEN",
  );
  const remaining = (await db.select().from(schema.administrators)).filter(
    (value) => value.enabled && value.role === "super_admin",
  );
  assert.equal(remaining.length, 1);
  assert.equal(await audits(), before + 1);
  const active = remaining[0].userId === owner.id ? owner : second;
  await assert.rejects(
    service.updateAdministrator(active, active.id, {
      role: "operator",
      enabled: true,
      revision: remaining[0].revision,
    }),
    hasCode("SELF_CHANGE_FORBIDDEN"),
  );
});
