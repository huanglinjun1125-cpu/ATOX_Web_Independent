import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  demoEventConfig,
  upcomingEventConfig,
} from "../src/modules/event-board/config";
import type { AuthUser } from "../src/modules/auth/contracts";
import type { TeamInput } from "../src/modules/participant-center/contracts";
let database: typeof import("../src/lib/db"),
  service: typeof import("../src/modules/participant-center/service"),
  participation: typeof import("../src/modules/event-participation/service");
let dir: string;
const original = structuredClone(demoEventConfig);
const values: TeamInput = {
  name: "Builders",
  description: "Team description",
  trackId: "open",
  skills: "Design, coding",
  recruitment: "Build together",
  capacity: 2,
};
const code = (expected: string) => (e: unknown) => {
  assert.equal((e as { code: string }).code, expected);
  return true;
};
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "participant-center-"));
  process.env.DB_PATH = path.join(dir, "db");
  database = await import("../src/lib/db");
  service = await import("../src/modules/participant-center/service");
  participation = await import("../src/modules/event-participation/service");
});
beforeEach(() => {
  Object.assign(demoEventConfig, {
    registrationOpensAt: new Date(Date.now() - 60000).toISOString(),
    registrationClosesAt: new Date(Date.now() + 3600000).toISOString(),
    submissionOpensAt: new Date(Date.now() - 60000).toISOString(),
    submissionClosesAt: new Date(Date.now() + 3600000).toISOString(),
  });
});
afterEach(() => Object.assign(demoEventConfig, structuredClone(original)));
after(async () => {
  await database?.closeDb();
  if (dir) await rm(dir, { recursive: true, force: true });
});
const center = () => service.forCenter("demo");
async function user(registered = true) {
  const u = {
    id: randomUUID(),
    email: randomUUID() + "@example.com",
    createdAt: new Date(),
  };
  await (await database.getDb()).insert(database.schema.users).values(u);
  if (registered)
    await participation
      .forEvent("demo")
      .register(u, {
        displayName: "Builder " + u.id.slice(0, 6),
        role: "developer",
        country: "China",
        organization: "",
        contact: "PRIVATE-CONTACT",
        acceptedTerms: true,
      });
  return u;
}
async function create(u: AuthUser, capacity = 2) {
  return (
    await center().execute(u, {
      action: "create",
      input: { ...values, capacity },
    })
  ).team!;
}
async function apply(u: AuthUser, id: string) {
  return (
    await center().execute(u, {
      action: "apply",
      teamId: id,
      skills: "Private skills",
      message: "Private application",
    })
  ).applications[0];
}
test("registration gate, one membership, pending gate, withdraw and retry", async () => {
  const unregistered = await user(false);
  await assert.rejects(
    center().execute(unregistered, { action: "create", input: values }),
    code("NOT_REGISTERED"),
  );
  const captain = await user(),
    applicant = await user();
  const team = await create(captain);
  await assert.rejects(
    center().execute(captain, { action: "create", input: values }),
    code("ALREADY_MEMBER"),
  );
  const a = await apply(applicant, team.id);
  await assert.rejects(
    center().execute(applicant, { action: "create", input: values }),
    code("PENDING_APPLICATION"),
  );
  await assert.rejects(apply(applicant, team.id), code("PENDING_APPLICATION"));
  await center().execute(applicant, {
    action: "withdraw",
    applicationId: a.id,
  });
  assert.equal(
    (await center().get(applicant)).applications[0].status,
    "withdrawn",
  );
  await apply(applicant, team.id);
});
test("last-place concurrent approvals cannot overfill, expire remaining applications", async () => {
  const captain = await user(),
    a = await user(),
    b = await user(),
    team = await create(captain);
  const aa = await apply(a, team.id),
    bb = await apply(b, team.id);
  const result = await Promise.allSettled(
    [aa, bb].map((v) =>
      center().execute(captain, {
        action: "approve",
        teamId: team.id,
        revision: team.revision,
        applicationId: v.id,
      }),
    ),
  );
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const mine = await center().get(captain);
  assert.equal(mine.team?.count, 2);
  assert.equal(mine.team?.stage, "full");
  assert.equal(mine.incoming.length, 0);
  const states = await Promise.all(
    [a, b].map(async (u) => (await center().get(u)).applications[0].status),
  );
  assert.deepEqual(states.sort(), ["accepted", "expired"]);
});
test("database enforces membership and pending application uniqueness across teams", async () => {
  const c1 = await user(),
    c2 = await user(),
    a = await user();
  const t1 = await create(c1),
    t2 = await create(c2);
  const db = await database.getDb();
  const attempts = await Promise.allSettled(
    [t1, t2].map((t) =>
      database.serializeDatabaseWrite(() =>
        db
          .insert(database.schema.teamMembers)
          .values({
            eventId: "demo",
            teamId: t.id,
            userId: a.id,
            displayName: "Member",
            role: "developer",
          }),
      ),
    ),
  );
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  const b = await user();
  const requests = await Promise.allSettled(
    [t1, t2].map((t) => apply(b, t.id)),
  );
  assert.equal(requests.filter((a) => a.status === "fulfilled").length, 1);
});
test("captain permissions, cross-event isolation and public/private projections", async () => {
  const captain = await user(),
    a = await user(),
    outsider = await user();
  const team = await create(captain);
  const app = await apply(a, team.id);
  await assert.rejects(
    center().execute(outsider, {
      action: "approve",
      teamId: team.id,
      revision: 0,
      applicationId: app.id,
    }),
    code("FORBIDDEN"),
  );
  const elsewhere = service.forCenter(upcomingEventConfig.id);
  const prior = {
    opens: upcomingEventConfig.registrationOpensAt,
    closes: upcomingEventConfig.registrationClosesAt,
  };
  upcomingEventConfig.registrationOpensAt = demoEventConfig.registrationOpensAt;
  upcomingEventConfig.registrationClosesAt =
    demoEventConfig.registrationClosesAt;
  try {
    await participation
      .forEvent(upcomingEventConfig.id)
      .register(captain, {
        displayName: "Elsewhere",
        role: "developer",
        country: "CN",
        organization: "",
        contact: "",
        acceptedTerms: true,
      });
    await assert.rejects(
      elsewhere.execute(captain, {
        action: "edit",
        teamId: team.id,
        revision: 0,
        input: values,
        recruiting: true,
      }),
      code("NOT_FOUND"),
    );
  } finally {
    upcomingEventConfig.registrationOpensAt = prior.opens;
    upcomingEventConfig.registrationClosesAt = prior.closes;
  }
  const pub = JSON.stringify(await center().list());
  assert.ok(!pub.includes("Private application"));
  assert.ok(!pub.includes(captain.email));
  assert.ok(!pub.includes("PRIVATE-CONTACT"));
  assert.equal((await center().get(outsider)).incoming.length, 0);
  assert.equal((await center().get(outsider)).applications.length, 0);
  assert.equal(
    (await center().get(captain)).incoming[0].message,
    "Private application",
  );
});
test("pause blocks new requests but allows existing approval; transfer, exit and dissolution retain personal data", async () => {
  const captain = await user(),
    a = await user(),
    b = await user();
  let team = await create(captain, 4);
  const app = await apply(a, team.id);
  team = (
    await center().execute(captain, {
      action: "edit",
      teamId: team.id,
      revision: team.revision,
      input: { ...values, capacity: 4 },
      recruiting: false,
    })
  ).team!;
  await assert.rejects(apply(b, team.id), code("NOT_RECRUITING"));
  team = (
    await center().execute(captain, {
      action: "approve",
      teamId: team.id,
      revision: team.revision,
      applicationId: app.id,
    })
  ).team!;
  assert.equal((await center().get(a)).incoming.length, 0);
  await assert.rejects(
    center().execute(captain, {
      action: "leave",
      teamId: team.id,
      revision: team.revision,
    }),
    code("TRANSFER_FIRST"),
  );
  await center().execute(captain, {
    action: "transfer",
    teamId: team.id,
    revision: team.revision,
    userId: a.id,
  });
  team = (await center().get(a)).team!;
  await assert.rejects(
    center().execute(captain, {
      action: "dissolve",
      teamId: team.id,
      revision: team.revision,
    }),
    code("FORBIDDEN"),
  );
  await center().execute(captain, {
    action: "leave",
    teamId: team.id,
    revision: team.revision,
  });
  team = (await center().get(a)).team!;
  await center().execute(a, {
    action: "dissolve",
    teamId: team.id,
    revision: team.revision,
  });
  assert.equal((await center().get(a)).team, null);
  assert.equal((await center().get(a)).applications[0].stillMember, false);
  assert.ok(
    (await participation.forEvent("demo").getParticipation(a)).registration,
  );
  assert.equal(
    (await participation.forEvent("demo").getParticipation(a)).canEdit,
    true,
  );
});
test("stale edits, invalid capacities, reject/reapply and remove member", async () => {
  const captain = await user(),
    a = await user();
  let team = await create(captain);
  const app = await apply(a, team.id);
  team = (
    await center().execute(captain, {
      action: "reject",
      teamId: team.id,
      revision: team.revision,
      applicationId: app.id,
    })
  ).team!;
  await assert.rejects(
    center().execute(captain, {
      action: "edit",
      teamId: team.id,
      revision: 0,
      input: values,
      recruiting: true,
    }),
    code("REVISION_CONFLICT"),
  );
  await assert.rejects(
    center().execute(captain, {
      action: "edit",
      teamId: team.id,
      revision: team.revision,
      input: { ...values, capacity: 100 },
      recruiting: true,
    }),
    code("INVALID_INPUT"),
  );
  const next = await apply(a, team.id);
  team = (
    await center().execute(captain, {
      action: "approve",
      teamId: team.id,
      revision: team.revision,
      applicationId: next.id,
    })
  ).team!;
  await center().execute(captain, {
    action: "remove",
    teamId: team.id,
    revision: team.revision,
    userId: a.id,
  });
  assert.equal((await center().get(a)).team, null);
  assert.equal(
    (await center().get(a)).applications.find((v) => v.id === next.id)
      ?.stillMember,
    false,
  );
});
test("deadline makes teams read-only and pending applications expired; db persists after reopen", async () => {
  const captain = await user(),
    a = await user();
  const team = await create(captain);
  await apply(a, team.id);
  demoEventConfig.participantCenter = {
    ...demoEventConfig.participantCenter,
    closesAt: new Date().toISOString(),
  };
  await assert.rejects(
    center().execute(a, {
      action: "withdraw",
      applicationId: (await center().get(a)).applications[0].id,
    }),
    code("CLOSED"),
  );
  const state = await center().get(a);
  assert.equal(state.canManage, false);
  assert.equal(state.applications[0].status, "expired");
  await database.closeDb();
  assert.equal((await center().get(captain)).team?.id, team.id);
  const db = await database.getDb();
  assert.equal(
    (
      await db
        .select()
        .from(database.schema.teamMembers)
        .where(eq(database.schema.teamMembers.userId, captain.id))
    ).length,
    1,
  );
});
