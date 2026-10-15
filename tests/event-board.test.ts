import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import {
  eventRegistry,
  getEventConfig,
  validateEventRegistry,
  isSafeEventTarget,
} from "../src/modules/event-board/config";
import {
  filterBoardEvents,
  getEventStage,
  getEventYear,
  getRegistrationState,
  recommendedEvent,
} from "../src/modules/event-board/rules";
import type { BoardCardDto } from "../src/modules/event-board/contracts";
import type { AuthUser } from "../src/modules/auth/contracts";
import type { MaterialPayload } from "../src/modules/event-participation/contracts";

let database: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let service: typeof import("../src/modules/event-participation/service");
let files: typeof import("../src/modules/event-participation/files");
let directory: string;
let image: Buffer;
let pdf: Buffer;
const original = structuredClone(eventRegistry);
const registration = {
  displayName: "Builder",
  role: "developer" as const,
  country: "CN",
  organization: "",
  contact: "",
  acceptedTerms: true,
};
const code = (expected: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, expected);
  return true;
};
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "event-board-"));
  Object.assign(process.env, {
    DB_PATH: path.join(directory, "db"),
    UPLOAD_PATH: path.join(directory, "uploads"),
    EVENT_REVIEWER_EMAILS: "reviewer@example.com",
  });
  database = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/event-participation/service");
  files = await import("../src/modules/event-participation/files");
  image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#00aa88" },
  })
    .png()
    .toBuffer();
  const document = await PDFDocument.create();
  document.addPage();
  pdf = Buffer.from(await document.save());
});
beforeEach(() =>
  eventRegistry.forEach((event, index) =>
    Object.assign(event, structuredClone(original[index])),
  ),
);
after(async () => {
  eventRegistry.forEach((event, index) =>
    Object.assign(event, original[index]),
  );
  await database?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function user(email = `${randomUUID()}@example.com`): Promise<AuthUser> {
  const user = { id: randomUUID(), email, createdAt: new Date() };
  await (await database.getDb()).insert(schema.users).values(user);
  if (email === "reviewer@example.com") {
    await (
      await database.getDb()
    )
      .insert(schema.administrators)
      .values({
        userId: user.id,
        email: user.email,
        role: "operator",
        enabled: true,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: {
          source: "bootstrap",
          userId: null,
          label: "test role fixture",
        },
      });
  }
  return user;
}
function open(id: string) {
  const config = getEventConfig(id)!;
  config.registrationOpensAt = config.submissionOpensAt = new Date(
    Date.now() - 3600000,
  ).toISOString();
  config.registrationClosesAt = config.submissionClosesAt = new Date(
    Date.now() + 3600000,
  ).toISOString();
  return service.forEvent(id);
}
async function payload(
  user: AuthUser,
  eventId: string,
): Promise<MaterialPayload> {
  const scope = files.filesForEvent(eventId);
  const cover = await scope.uploadAsset(user, "cover", image, "cover.png");
  const document = await scope.uploadAsset(
    user,
    "document",
    pdf,
    "proposal.pdf",
  );
  return {
    name: eventId,
    tagline: "An idea",
    description: "Project description",
    trackId: "open",
    coverId: cover.id,
    screenshotIds: [],
    documentId: document.id,
    videoUrl: "",
    experienceUrl: "",
    codeUrl: "",
    original: true,
    usageAuthorized: true,
    publicDisplay: false,
  };
}
function cards(): BoardCardDto[] {
  const now = new Date("2026-10-09T00:00:00+08:00");
  return eventRegistry.map((event) => ({
    id: event.id,
    name: event.name,
    theme: event.theme,
    introduction: event.introduction,
    cover: event.cover,
    organizer: event.organizer,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    target: event.target,
    recommended: event.recommended,
    demo: event.demo,
    tags: event.tags,
    year: getEventYear(event),
    stage: getEventStage(event, now),
  }));
}

test("Actual event stages use start-inclusive/end-exclusive boundaries independently from registration", () => {
  const demo = getEventConfig("demo")!,
    upcoming = getEventConfig("upcoming-demo")!,
    past = getEventConfig("past-demo")!;
  const now = new Date("2026-10-09T12:00:00+08:00");
  assert.equal(getEventStage(demo, now), "ongoing");
  assert.equal(getEventStage(upcoming, now), "upcoming");
  assert.equal(getRegistrationState(upcoming, now), "open");
  assert.equal(getEventStage(past, now), "ended");
  assert.equal(getEventStage(upcoming, new Date(upcoming.startsAt)), "ongoing");
  assert.equal(getEventStage(upcoming, new Date(upcoming.endsAt)), "ended");
  assert.equal(
    getRegistrationState(demo, new Date(demo.registrationOpensAt)),
    "open",
  );
  assert.equal(
    getRegistrationState(demo, new Date(demo.registrationClosesAt)),
    "closed",
  );
  assert.equal(
    getEventYear({ ...demo, startsAt: "2026-12-31T16:30:00Z" }),
    2027,
  );
});
test("Search, year and stage intersect; ordering and recommendation follow shared rules", () => {
  const all = cards();
  assert.deepEqual(
    filterBoardEvents(all).map((event) => event.id),
    ["demo", "upcoming-demo", "past-demo"],
  );
  assert.deepEqual(
    filterBoardEvents(all, {
      q: "  WINTER ",
      year: "2027",
      stage: "upcoming",
    }).map((event) => event.id),
    ["upcoming-demo"],
  );
  assert.equal(filterBoardEvents(all, { q: "冬季", year: "2026" }).length, 0);
  assert.equal(filterBoardEvents(all, { q: "共创下一种可能" }).length, 1);
  assert.equal(recommendedEvent(all)?.id, "demo");
  assert.equal(recommendedEvent(all, { stage: "ongoing" }), null);
  const ended = all.map((event) => ({ ...event, stage: "ended" as const }));
  assert.equal(recommendedEvent(ended), null);
  assert.equal(
    recommendedEvent(all.map((event) => ({ ...event, target: null }))),
    null,
  );
});
test("Same-stage sorting uses ongoing end, upcoming start, ended descending end and ID ties", () => {
  const base = cards()[0];
  const make = (
    id: string,
    stage: BoardCardDto["stage"],
    startsAt: string,
    endsAt: string,
  ): BoardCardDto => ({ ...base, id, stage, startsAt, endsAt });
  const rows = [
    make("ended-old", "ended", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"),
    make(
      "upcoming-z",
      "upcoming",
      "2027-02-01T00:00:00Z",
      "2027-02-02T00:00:00Z",
    ),
    make(
      "ongoing-z",
      "ongoing",
      "2026-10-01T00:00:00Z",
      "2026-12-02T00:00:00Z",
    ),
    make("ended-z", "ended", "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"),
    make(
      "ongoing-early",
      "ongoing",
      "2026-10-01T00:00:00Z",
      "2026-11-02T00:00:00Z",
    ),
    make(
      "upcoming-a",
      "upcoming",
      "2027-02-01T00:00:00Z",
      "2027-02-04T00:00:00Z",
    ),
    make("ended-a", "ended", "2026-08-01T00:00:00Z", "2026-09-02T00:00:00Z"),
    make(
      "upcoming-early",
      "upcoming",
      "2027-01-01T00:00:00Z",
      "2027-03-01T00:00:00Z",
    ),
    make(
      "ongoing-a",
      "ongoing",
      "2026-09-01T00:00:00Z",
      "2026-12-02T00:00:00Z",
    ),
  ];
  const before = rows.map((row) => row.id);
  assert.deepEqual(
    filterBoardEvents(rows).map((row) => row.id),
    [
      "ongoing-early",
      "ongoing-a",
      "ongoing-z",
      "upcoming-early",
      "upcoming-a",
      "upcoming-z",
      "ended-a",
      "ended-z",
      "ended-old",
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    before,
    "sorting must not mutate the source array",
  );
  assert.equal(
    getEventStage(base, new Date(Date.parse(base.startsAt) - 1)),
    "upcoming",
  );
  assert.equal(
    getEventStage(base, new Date(Date.parse(base.endsAt) - 1)),
    "ongoing",
  );
});
test("Registry rejects duplicate IDs, multiple recommendations and unsafe navigation targets", () => {
  assert.throws(() =>
    validateEventRegistry([original[0], structuredClone(original[0])]),
  );
  assert.throws(() =>
    validateEventRegistry([original[0], { ...original[1], recommended: true }]),
  );
  for (const target of [
    "javascript:alert(1)",
    "http://example.com",
    "//example.com",
    "/\\example.com",
    "/%2fexample.com",
    "https://user:pass@example.com",
  ])
    assert.equal(isSafeEventTarget(target), false);
  for (const target of ["/events/demo", "https://example.com/event", null])
    assert.equal(isSafeEventTarget(target), true);
  assert.equal(getEventConfig("missing"), null);
  assert.throws(() => service.forEvent("missing"), code("NOT_FOUND"));
  getEventConfig("upcoming-demo")!.published = false;
  assert.equal(getEventConfig("upcoming-demo"), null);
  assert.throws(() => files.filesForEvent("upcoming-demo"), code("NOT_FOUND"));
});
test("Concurrent bindings keep registration, revision, draft and file references isolated per event", async () => {
  const buyer = await user(),
    a = open("demo"),
    b = open("upcoming-demo");
  const registrations = await Promise.all([
    a.register(buyer, registration),
    b.register(buyer, registration),
  ]);
  assert.notEqual(registrations[0].id, registrations[1].id);
  const [pa, pb] = await Promise.all([
    payload(buyer, "demo"),
    payload(buyer, "upcoming-demo"),
  ]);
  const [da, db] = await Promise.all([
    a.saveDraft(buyer, { revision: 0, payload: pa }),
    b.saveDraft(buyer, { revision: 0, payload: pb }),
  ]);
  assert.equal(da.draft?.name, "demo");
  assert.equal(db.draft?.name, "upcoming-demo");
  assert.ok(
    da.assets.every((asset) => asset.url.startsWith("/api/events/demo/files/")),
  );
  assert.ok(
    db.assets.every((asset) =>
      asset.url.startsWith("/api/events/upcoming-demo/files/"),
    ),
  );
  await assert.rejects(
    files.filesForEvent("upcoming-demo").readAsset(buyer, pa.coverId!),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    b.saveDraft(buyer, {
      revision: db.revision,
      payload: { ...pb, coverId: pa.coverId },
    }),
    code("INVALID_FILE"),
  );
  assert.equal((await b.getMaterials(buyer)).revision, 1);
  await a.submitMaterials(buyer, { revision: da.revision });
  assert.equal((await b.getMaterials(buyer)).status, "not_submitted");
  assert.equal((await a.getMaterials(buyer)).official?.name, "demo");
});
test("Reviewer sees only scoped official materials and cannot read another event via a valid asset ID", async () => {
  const buyer = await user(),
    reviewer = await user("reviewer@example.com"),
    a = open("demo"),
    b = open("upcoming-demo");
  await a.register(buyer, registration);
  await b.register(buyer, registration);
  const pa = await payload(buyer, "demo");
  const da = await a.saveDraft(buyer, { revision: 0, payload: pa });
  const submitted = await a.submitMaterials(buyer, { revision: da.revision });
  assert.ok(
    (await a.listReviews(reviewer)).some((item) => item.id === submitted.id),
  );
  assert.equal(
    (await b.listReviews(reviewer)).some((item) => item.id === submitted.id),
    false,
  );
  await assert.rejects(
    b.reviewMaterials(reviewer, submitted.id!, {
      revision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
      action: "accepted",
      publicNote: "Wrong event",
    }),
    code("NOT_FOUND"),
  );
  await assert.rejects(
    files.filesForEvent("upcoming-demo").readAsset(reviewer, pa.documentId!),
    code("NOT_FOUND"),
  );
  assert.equal(
    (await files.filesForEvent("demo").readAsset(reviewer, pa.documentId!))
      .purpose,
    "document",
  );
});
test("Two official submissions, review results and resubmission counters remain independent", async () => {
  const buyer = await user(),
    reviewer = await user(),
    a = open("demo"),
    b = open("upcoming-demo");
  const previousReviewers = process.env.EVENT_REVIEWER_EMAILS;
  await (
    await database.getDb()
  )
    .insert(schema.administrators)
    .values({
      userId: reviewer.id,
      email: reviewer.email,
      role: "operator",
      enabled: true,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: {
        source: "bootstrap",
        userId: null,
        label: "test role fixture",
      },
    });
  process.env.EVENT_REVIEWER_EMAILS = reviewer.email;
  try {
    await Promise.all([
      a.register(buyer, registration),
      b.register(buyer, registration),
    ]);
    const [pa, pb] = await Promise.all([
      payload(buyer, "demo"),
      payload(buyer, "upcoming-demo"),
    ]);
    const [da, db] = await Promise.all([
      a.saveDraft(buyer, { revision: 0, payload: pa }),
      b.saveDraft(buyer, { revision: 0, payload: pb }),
    ]);
    const [sa, sb] = await Promise.all([
      a.submitMaterials(buyer, { revision: da.revision }),
      b.submitMaterials(buyer, { revision: db.revision }),
    ]);
    assert.notEqual(sa.id, sb.id);
    assert.equal(sa.revision, 2);
    assert.equal(sb.revision, 2);
    assert.equal(sa.submittedRevision, 1);
    assert.equal(sb.submittedRevision, 1);
    await Promise.all([
      a.reviewMaterials(reviewer, sa.id!, {
        revision: sa.revision,
        submittedRevision: sa.submittedRevision,
        action: "accepted",
        publicNote: "A accepted",
        internalNote: "A private",
      }),
      b.reviewMaterials(reviewer, sb.id!, {
        revision: sb.revision,
        submittedRevision: sb.submittedRevision,
        action: "needs_changes",
        publicNote: "B needs details",
        internalNote: "B private",
      }),
    ]);
    const accepted = await a.getMaterials(buyer),
      changes = await b.getMaterials(buyer);
    assert.equal(accepted.status, "processed");
    assert.equal(accepted.result, "accepted");
    assert.equal(accepted.revision, 3);
    assert.equal(accepted.publicNote, "A accepted");
    assert.equal(changes.status, "processed");
    assert.equal(changes.result, "rejected");
    assert.equal(changes.revision, 3);
    assert.equal(changes.publicNote, "B needs details");
    const nextDraft = await b.saveDraft(buyer, {
      revision: changes.revision,
      payload: { ...pb, description: "Expanded B description" },
    });
    const resubmitted = await b.submitMaterials(buyer, {
      revision: nextDraft.revision,
    });
    assert.equal(resubmitted.revision, 5);
    assert.equal(resubmitted.submittedRevision, 2);
    assert.equal(resubmitted.status, "pending");
    assert.deepEqual(await a.getMaterials(buyer), accepted);
    await b.reviewMaterials(reviewer, sb.id!, {
      revision: resubmitted.revision,
      submittedRevision: resubmitted.submittedRevision,
      action: "rejected",
      publicNote: "B rejected",
      internalNote: "B final private",
    });
    const rejected = await b.getMaterials(buyer);
    assert.equal(rejected.revision, 6);
    assert.equal(rejected.submittedRevision, 2);
    assert.equal(rejected.result, "rejected");
    assert.equal(rejected.status, "processed");
    assert.deepEqual(await a.getMaterials(buyer), accepted);
    const ra = (await a.listReviews(reviewer)).find(
        (item) => item.id === sa.id,
      )!,
      rb = (await b.listReviews(reviewer)).find((item) => item.id === sb.id)!;
    assert.equal(ra.internalNote, "A private");
    assert.equal(rb.internalNote, "B final private");
    assert.equal(ra.official?.name, "demo");
    assert.equal(rb.official?.name, "upcoming-demo");
    assert.equal("internalNote" in accepted, false);
    assert.equal("internalNote" in rejected, false);
    assert.equal(
      (await a.listReviews(reviewer)).some((item) => item.id === sb.id),
      false,
    );
    assert.equal(
      (await b.listReviews(reviewer)).some((item) => item.id === sa.id),
      false,
    );
  } finally {
    process.env.EVENT_REVIEWER_EMAILS = previousReviewers;
  }
});
test("Closed activity rejects writes without changing another activity; cleanup protects references in all activities", async () => {
  const buyer = await user(),
    a = open("demo"),
    b = open("upcoming-demo");
  await a.register(buyer, registration);
  await b.register(buyer, registration);
  const pa = await payload(buyer, "demo"),
    pb = await payload(buyer, "upcoming-demo");
  await a.saveDraft(buyer, { revision: 0, payload: pa });
  await b.saveDraft(buyer, { revision: 0, payload: pb });
  const db = await database.getDb();
  await db
    .update(schema.eventAssets)
    .set({ createdAt: new Date(0) })
    .where(eq(schema.eventAssets.userId, buyer.id));
  await files.cleanupOrphanFiles(new Date());
  assert.equal(
    (await files.filesForEvent("demo").readAsset(buyer, pa.coverId!)).purpose,
    "cover",
  );
  assert.equal(
    (await files.filesForEvent("upcoming-demo").readAsset(buyer, pb.coverId!))
      .purpose,
    "cover",
  );
  getEventConfig("upcoming-demo")!.submissionClosesAt = new Date(
    Date.now() - 1000,
  ).toISOString();
  await assert.rejects(
    b.saveDraft(buyer, { revision: 1, payload: pb }),
    code("CLOSED"),
  );
  assert.equal((await a.getMaterials(buyer)).canEdit, true);
  getEventConfig("demo")!.published = false;
  await assert.rejects(a.getMaterials(buyer), code("NOT_FOUND"));
});
