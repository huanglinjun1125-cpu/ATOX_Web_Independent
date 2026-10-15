import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import type { AuthUser } from "../src/modules/auth/contracts";
import type { EventDefinition } from "../src/modules/event-board/contracts";
import type { HomepageContent } from "../src/modules/content-management/contracts";
let dbm: typeof import("../src/lib/db"),
  schema: typeof import("../src/lib/schema"),
  service: typeof import("../src/modules/content-management/service"),
  store: typeof import("../src/modules/content-management/store"),
  participation: typeof import("../src/modules/event-participation/service");
let directory: string, operator: AuthUser;
const code = (wanted: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, wanted);
  return true;
};
async function user(role?: "operator" | "super_admin") {
  const u = {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    createdAt: new Date(),
  };
  const db = await dbm.getDb();
  await db.insert(schema.users).values(u);
  if (role)
    await db.insert(schema.administrators).values({
      userId: u.id,
      email: u.email,
      role,
      enabled: true,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: { source: "bootstrap", userId: null, label: "fixture" },
    });
  return u;
}
async function create(id: string) {
  const { content } = await service.createManagedEvent(operator, id);
  return content;
}
async function publish(id: string) {
  const content = (await service.getManagedContent(operator, "event", id))
    .content;
  return (
    await service.changeContent(operator, "event", id, {
      revision: content.revision,
      action: "publish",
    })
  ).content;
}
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "content-management-"));
  process.env.DB_PATH = path.join(directory, "db");
  dbm = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/content-management/service");
  store = await import("../src/modules/content-management/store");
  participation = await import("../src/modules/event-participation/service");
  operator = await user("operator");
});
after(async () => {
  await dbm?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("operator may manage content; ordinary and revoked actors cannot", async () => {
  await service.listManagedEvents(operator);
  await assert.rejects(
    service.listManagedEvents(await user()),
    code("FORBIDDEN"),
  );
  const revoked = await user("operator");
  const db = await dbm.getDb();
  await db
    .update(schema.administrators)
    .set({ enabled: false })
    .where(eq(schema.administrators.userId, revoked.id));
  await assert.rejects(
    service.createManagedEvent(revoked, "revoked-event"),
    code("FORBIDDEN"),
  );
  const admin = await import("../src/modules/admin/service");
  await assert.rejects(admin.listAudit(operator, 1), code("FORBIDDEN"));
});
test("baseline revision zero is virtual; new draft stays private; draft edits do not change live", async () => {
  const baseline = await store.readContent("event", "demo");
  assert.equal(baseline?.revision, 0);
  assert.equal(
    (await (await dbm.getDb()).select().from(schema.managedContent)).length,
    0,
  );
  const draft = await create("isolation-event");
  assert.equal(await store.readPublishedEvent(draft.id), null);
  const live = await publish(draft.id);
  assert.equal(
    (await store.readPublishedEvent(draft.id))?.name.en,
    "New event · Draft",
  );
  const changed = structuredClone(live.draft) as EventDefinition;
  changed.name.en = "Private revision";
  await service.changeContent(operator, "event", draft.id, {
    revision: live.revision,
    action: "save",
    draft: changed,
  });
  assert.equal(
    (await store.readPublishedEvent(draft.id))?.name.en,
    "New event · Draft",
  );
  await dbm.closeDb();
  assert.equal(
    ((await store.readContent("event", draft.id))?.draft as EventDefinition)
      .name.en,
    "Private revision",
  );
  assert.equal(
    (await store.readPublishedEvent(draft.id))?.name.en,
    "New event · Draft",
  );
});
test("system-owned publication and file settings cannot be forged; withdrawn state cannot be replayed", async () => {
  const c = await create("protected-fields");
  const draft = structuredClone(c.draft) as EventDefinition;
  draft.published = false;
  draft.target = "https://attacker.example";
  draft.fileRules = {
    imageMaxBytes: 999999999,
    documentMaxBytes: 999999999,
    maxScreenshots: 999,
  };
  const saved = (
    await service.changeContent(operator, "event", c.id, {
      revision: c.revision,
      action: "save",
      draft,
    })
  ).content;
  const config = saved.draft as EventDefinition;
  assert.equal(config.published, true);
  assert.equal(config.target, `/events/${c.id}`);
  assert.deepEqual(config.fileRules, (c.draft as EventDefinition).fileRules);
  await assert.rejects(
    service.changeContent(operator, "event", c.id, {
      revision: saved.revision,
      action: "withdraw",
    }),
    code("NOT_PUBLISHED"),
  );
  const live = await publish(c.id);
  const withdrawn = (
    await service.changeContent(operator, "event", c.id, {
      revision: live.revision,
      action: "withdraw",
    })
  ).content;
  await assert.rejects(
    service.changeContent(operator, "event", c.id, {
      revision: withdrawn.revision,
      action: "withdraw",
    }),
    code("NOT_PUBLISHED"),
  );
  assert.equal(await store.readPublishedEvent(c.id), null);
});

test("same revision concurrent saves commit exactly one audit and revision", async () => {
  const content = await create("race-event");
  const initial = (
    await service.getManagedContent(operator, "event", content.id)
  ).history.length;
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      service.changeContent(operator, "event", content.id, {
        revision: content.revision,
        action: "save",
        draft: content.draft,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failed = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(failed.reason.code, "REVISION_CONFLICT");
  const read = await service.getManagedContent(operator, "event", content.id);
  assert.equal(read.content.revision, 2);
  assert.equal(read.history.length, initial + 1);
});
test("audit failure rolls back publication atomically", async () => {
  const content = await create("audit-event");
  const db = await dbm.getDb();
  await db.execute(
    sql.raw(
      "CREATE FUNCTION fail_content_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$",
    ),
  );
  await db.execute(
    sql.raw(
      "CREATE TRIGGER fail_content_audit BEFORE INSERT ON business_audit_logs FOR EACH ROW EXECUTE FUNCTION fail_content_audit()",
    ),
  );
  try {
    await assert.rejects(publish(content.id));
    assert.equal((await store.readContent("event", content.id))?.revision, 1);
    assert.equal(await store.readPublishedEvent(content.id), null);
  } finally {
    await db.execute(
      sql.raw("DROP TRIGGER fail_content_audit ON business_audit_logs"),
    );
    await db.execute(sql.raw("DROP FUNCTION fail_content_audit()"));
  }
});
test("duplicate recommendation rejects publication, leaving draft and live intact", async () => {
  const c = await create("recommendation-event");
  const draft = structuredClone(c.draft) as EventDefinition;
  draft.recommended = true;
  const saved = await service.changeContent(operator, "event", c.id, {
    revision: c.revision,
    action: "save",
    draft,
  });
  await assert.rejects(
    service.changeContent(operator, "event", c.id, {
      revision: saved.content.revision,
      action: "publish",
    }),
    code("RECOMMENDATION_CONFLICT"),
  );
  assert.equal(await store.readPublishedEvent(c.id), null);
});
test("both official and draft track references protect publication without modifying materials", async () => {
  for (const source of ["official", "draft"] as const) {
    const c = await create(`track-${source}`);
    const config = c.draft as EventDefinition;
    const owner = await user();
    const payload = { trackId: config.tracks[0].id, projectName: "Original" };
    await (await dbm.getDb()).insert(schema.eventMaterials).values({
      id: randomUUID(),
      eventId: c.id,
      userId: owner.id,
      [source]: payload as never,
    });
    const draft = structuredClone(config);
    draft.tracks = [
      { id: "new-track", name: { zh: "新赛道", en: "New track" } },
    ];
    const saved = await service.changeContent(operator, "event", c.id, {
      revision: c.revision,
      action: "save",
      draft,
    });
    await assert.rejects(
      service.changeContent(operator, "event", c.id, {
        revision: saved.content.revision,
        action: "publish",
      }),
      code("TRACK_IN_USE"),
    );
    const [row] = await (
      await dbm.getDb()
    )
      .select()
      .from(schema.eventMaterials)
      .where(eq(schema.eventMaterials.eventId, c.id));
    assert.deepEqual(row[source], payload);
  }
});
test("published activities register independently; withdrawn activity is absent publicly but retained administratively", async () => {
  await create("registration-a");
  await create("registration-b");
  await publish("registration-a");
  await publish("registration-b");
  const owner = await user();
  for (const id of ["registration-a", "registration-b"]) {
    const config = (await store.readPublishedEvent(id))!;
    await participation
      .buildEventService(config, (reader) =>
        store.readPublishedEvent(id, reader),
      )
      .register(owner, {
        displayName: id,
        role: "developer",
        country: "CN",
        organization: "",
        contact: "",
        acceptedTerms: true,
      });
  }
  const rows = await (
    await dbm.getDb()
  )
    .select()
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.userId, owner.id));
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((r) => r.displayName)).size, 2);
  const c = (await store.readContent("event", "registration-a"))!;
  await service.changeContent(operator, "event", c.id, {
    revision: c.revision,
    action: "withdraw",
  });
  assert.equal(await store.readPublishedEvent(c.id), null);
  assert.equal(
    (await service.getManagedContent(operator, "event", c.id)).content.state,
    "withdrawn",
  );
  assert.equal(
    (await store.readPublishedEvent("registration-b"))?.id,
    "registration-b",
  );
});
test("homepage bilingual structure validates, publish separates draft and withdrawal restores baseline", async () => {
  const c = (await store.readContent("homepage", "homepage"))!;
  const baseline = await store.readPublishedHomepage();
  const draft = structuredClone(c.draft) as HomepageContent;
  draft.text.heroLineOne = { zh: "已发布中文", en: "Published English" };
  const saved = await service.changeContent(operator, "homepage", "homepage", {
    revision: c.revision,
    action: "save",
    draft,
  });
  assert.deepEqual(await store.readPublishedHomepage(), baseline);
  const published = await service.changeContent(
    operator,
    "homepage",
    "homepage",
    { revision: saved.content.revision, action: "publish" },
  );
  assert.deepEqual(
    (await store.readPublishedHomepage()).text.heroLineOne,
    draft.text.heroLineOne,
  );
  const invalid = structuredClone(draft);
  invalid.metadata.title.en = "";
  await assert.rejects(
    service.changeContent(operator, "homepage", "homepage", {
      revision: published.content.revision,
      action: "save",
      draft: invalid,
    }),
    code("INVALID_CONTENT"),
  );
  await service.changeContent(operator, "homepage", "homepage", {
    revision: published.content.revision,
    action: "withdraw",
  });
  assert.deepEqual(await store.readPublishedHomepage(), baseline);
});
test("unsafe ids, invalid dates, duplicate tracks and empty localized content cannot save", async () => {
  for (const id of ["../demo", "UPPER", "a/b", ""])
    await assert.rejects(
      service.createManagedEvent(operator, id),
      code("INVALID_ID"),
    );
  const c = await create("invalid-event");
  for (const mutate of [
    (d: EventDefinition) => {
      d.endsAt = d.startsAt;
    },
    (d: EventDefinition) => {
      d.name.en = "";
    },
    (d: EventDefinition) => {
      d.tracks.push(d.tracks[0]);
    },
  ]) {
    const draft = structuredClone(c.draft) as EventDefinition;
    mutate(draft);
    await assert.rejects(
      service.changeContent(operator, "event", c.id, {
        revision: c.revision,
        action: "save",
        draft,
      }),
    );
  }
  assert.equal((await store.readContent("event", c.id))?.revision, c.revision);
});
test("queued actor withdrawal is checked inside write transaction", async () => {
  const actor = await user("operator");
  let unlock!: () => void;
  const gate = new Promise<void>((r) => (unlock = r));
  const first = dbm.serializeDatabaseWrite(async () => {
    await gate;
    await (
      await dbm.getDb()
    )
      .update(schema.administrators)
      .set({ enabled: false })
      .where(eq(schema.administrators.userId, actor.id));
  });
  const request = service.createManagedEvent(actor, "queued-revoked");
  unlock();
  await first;
  await assert.rejects(request, code("FORBIDDEN"));
  assert.equal(await store.readContent("event", "queued-revoked"), null);
});
test("queued registration refreshes withdrawal and deadline from persisted live configuration", async () => {
  for (const action of ["withdraw", "close"] as const) {
    const id = `stale-${action}`;
    await create(id);
    await publish(id);
    const original = (await store.readPublishedEvent(id))!;
    const owner = await user();
    const bound = participation.buildEventService(original, (reader) =>
      store.readPublishedEvent(id, reader),
    );
    let unlock!: () => void;
    const gate = new Promise<void>((r) => (unlock = r));
    const first = dbm.serializeDatabaseWrite(async () => {
      await gate;
      const db = await dbm.getDb();
      if (action === "withdraw")
        await db
          .update(schema.managedContent)
          .set({ state: "withdrawn" })
          .where(eq(schema.managedContent.id, id));
      else {
        const live = structuredClone(original);
        live.registrationClosesAt = "2026-10-01T00:00:00+08:00";
        await db
          .update(schema.managedContent)
          .set({ live })
          .where(eq(schema.managedContent.id, id));
      }
    });
    const pending = bound.register(owner, {
      displayName: "Stale request",
      role: "developer",
      country: "CN",
      organization: "",
      contact: "",
      acceptedTerms: true,
    });
    unlock();
    await first;
    await assert.rejects(
      pending,
      code(action === "withdraw" ? "NOT_FOUND" : "CLOSED"),
    );
    assert.equal(
      (
        await (
          await dbm.getDb()
        )
          .select()
          .from(schema.eventRegistrations)
          .where(eq(schema.eventRegistrations.userId, owner.id))
      ).length,
      0,
    );
  }
});
