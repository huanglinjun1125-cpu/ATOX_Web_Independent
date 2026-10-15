import { before, beforeEach, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type { AuthUser } from "../src/modules/auth/contracts";
import type {
  MaterialPayload,
  RegistrationInput,
} from "../src/modules/event-participation/contracts";
import { eventConfig } from "../src/modules/event-participation/config";

let service: typeof import("../src/modules/event-participation/service");
let files: typeof import("../src/modules/event-participation/files");
let database: typeof import("../src/lib/db");
let schema: typeof import("../src/lib/schema");
let directory: string;
let image: Buffer;
let pdf: Buffer;
let reviewer: AuthUser;
const config = eventConfig as unknown as Record<string, unknown>;
const originalConfig = { ...eventConfig };
const registration: RegistrationInput = {
  displayName: "Builder",
  role: "developer",
  country: "China",
  organization: "",
  contact: "",
  acceptedTerms: true,
};
const expectCode = (code: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, code);
  return true;
};

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "hackathon-event-"));
  Object.assign(process.env, {
    DB_PATH: path.join(directory, "db"),
    UPLOAD_PATH: path.join(directory, "files"),
    EVENT_REVIEWER_EMAILS: "reviewer@example.com",
  });
  database = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  service = await import("../src/modules/event-participation/service");
  files = await import("../src/modules/event-participation/files");
  image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#9955cc" },
  })
    .png()
    .toBuffer();
  const document = await PDFDocument.create();
  document.addPage();
  pdf = Buffer.from(await document.save());
  reviewer = await createUser("reviewer@example.com");
});
beforeEach(() => {
  const opens = new Date(Date.now() - 3_600_000).toISOString();
  const closes = new Date(Date.now() + 3_600_000).toISOString();
  Object.assign(config, {
    registrationOpensAt: opens,
    registrationClosesAt: closes,
    submissionOpensAt: opens,
    submissionClosesAt: closes,
  });
});
afterEach(() => Object.assign(config, originalConfig));
after(async () => {
  await database?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function createUser(
  email = `${randomUUID()}@example.com`,
): Promise<AuthUser> {
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
async function setupSubmission() {
  const user = await createUser();
  await service.register(user, registration);
  const cover = await files.uploadAsset(user, "cover", image, "cover.png");
  const document = await files.uploadAsset(
    user,
    "document",
    pdf,
    "project.pdf",
  );
  const payload: MaterialPayload = {
    name: "A project",
    tagline: "A small idea",
    description: "A useful project description",
    trackId: "open",
    coverId: cover.id,
    screenshotIds: [],
    documentId: document.id,
    videoUrl: "",
    experienceUrl: "https://example.com/demo",
    codeUrl: "",
    original: true,
    usageAuthorized: true,
    publicDisplay: false,
  };
  const saved = await service.saveDraft(user, { revision: 0, payload });
  const submitted = await service.submitMaterials(user, {
    revision: saved.revision,
  });
  return { user, payload, submitted, cover, document };
}

test("Registration is unique under concurrent requests and email is account-owned", async () => {
  const user = await createUser();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => service.register(user, registration)),
  );
  assert.equal(new Set(results.map((item) => item.id)).size, 1);
  assert.equal(results[0].email, user.email);
  const participation = await service.getParticipation(user);
  assert.ok(participation.registration);
  assert.equal(participation.canEdit, true);
});

test("No registration means no file upload or draft save", async () => {
  const user = await createUser();
  await assert.rejects(
    files.uploadAsset(user, "cover", image, "cover.png"),
    expectCode("NOT_REGISTERED"),
  );
  const { emptyMaterial } =
    await import("../src/modules/event-participation/contracts");
  await assert.rejects(
    service.saveDraft(user, { revision: 0, payload: emptyMaterial() }),
    expectCode("NOT_REGISTERED"),
  );
});

test("Incomplete drafts are separate; failed submission preserves official material and draft", async () => {
  const { user, payload, submitted } = await setupSubmission();
  const updated = await service.saveDraft(user, {
    revision: submitted.revision,
    payload: { ...payload, name: "Draft only", documentId: null },
  });
  assert.equal(updated.official?.name, payload.name);
  assert.equal(updated.draft?.name, "Draft only");
  assert.equal(updated.status, "pending");
  await assert.rejects(
    service.submitMaterials(user, { revision: updated.revision }),
    expectCode("INVALID_INPUT"),
  );
  const current = await service.getMaterials(user);
  assert.equal(current.official?.name, payload.name);
  assert.equal(current.draft?.name, "Draft only");
});

test("Old tabs and concurrent saves cannot overwrite the latest draft", async () => {
  const { user, payload, submitted } = await setupSubmission();
  const input = {
    revision: submitted.revision,
    payload: { ...payload, tagline: "New draft" },
  };
  const results = await Promise.allSettled([
    service.saveDraft(user, input),
    service.saveDraft(user, input),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "REVISION_CONFLICT");
  await assert.rejects(
    service.submitMaterials(user, { revision: submitted.revision }),
    expectCode("REVISION_CONFLICT"),
  );
  const current = await service.getMaterials(user);
  const submissions = await Promise.allSettled([
    service.submitMaterials(user, { revision: current.revision }),
    service.submitMaterials(user, { revision: current.revision }),
  ]);
  assert.equal(
    submissions.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const duplicate = submissions.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(duplicate.reason.code, "REVISION_CONFLICT");
  assert.equal(
    (await service.getMaterials(user)).official?.tagline,
    "New draft",
  );
});

test("Review, requested changes, resubmission, and processed lock form a full flow", async () => {
  const { user, payload, submitted } = await setupSubmission();
  await service.reviewMaterials(reviewer, submitted.id!, {
    revision: submitted.revision,
    submittedRevision: submitted.submittedRevision,
    action: "needs_changes",
    publicNote: "Please clarify",
    internalNote: "PRIVATE-REVIEW-NOTE",
  });
  let current = await service.getMaterials(user);
  assert.equal(current.status, "processed");
  assert.equal(current.result, "rejected");
  assert.equal(current.publicNote, "Please clarify");
  assert.ok(!JSON.stringify(current).includes("PRIVATE-REVIEW-NOTE"));
  const draft = await service.saveDraft(user, {
    revision: current.revision,
    payload: { ...payload, description: "Clarified description" },
  });
  current = await service.submitMaterials(user, { revision: draft.revision });
  assert.equal(current.status, "pending");
  assert.equal(current.draft, null);
  assert.equal(current.publicNote, null);
  assert.equal(current.submittedRevision, submitted.submittedRevision + 1);
  await assert.rejects(
    service.reviewMaterials(reviewer, current.id!, {
      revision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
      action: "accepted",
      publicNote: "Stale",
    }),
    expectCode("REVISION_CONFLICT"),
  );
  await service.reviewMaterials(reviewer, current.id!, {
    revision: current.revision,
    submittedRevision: current.submittedRevision,
    action: "accepted",
    publicNote: "Received",
  });
  current = await service.getMaterials(user);
  assert.equal(current.status, "processed");
  assert.equal(current.result, "accepted");
  await assert.rejects(
    service.saveDraft(user, { revision: current.revision, payload }),
    expectCode("PROCESSED"),
  );
  await assert.rejects(
    files.uploadAsset(user, "cover", image, "new.png"),
    expectCode("PROCESSED"),
  );
  assert.ok((await service.getParticipation(user)).registration);
});

test("Unregistered identities and reviewers cannot access another user's draft files", async () => {
  const { user, submitted, cover } = await setupSubmission();
  const other = await createUser();
  await assert.rejects(files.readAsset(other, cover.id));
  await assert.rejects(service.listReviews(other), expectCode("FORBIDDEN"));
  assert.equal((await service.getMaterials(other)).official, null);
  const draftAsset = await files.uploadAsset(
    user,
    "screenshot",
    image,
    "draft.png",
  );
  await assert.rejects(files.readAsset(reviewer, draftAsset.id));
  assert.ok((await files.readAsset(reviewer, cover.id)).buffer.byteLength > 0);
  await assert.rejects(
    service.reviewMaterials(other, submitted.id!, {
      revision: submitted.revision,
      submittedRevision: submitted.submittedRevision,
      action: "accepted",
      publicNote: "Unauthorized",
    }),
    expectCode("FORBIDDEN"),
  );
});

test("Files require valid content, correct purpose, ownership, counts, and safe links", async () => {
  const { user, payload, submitted } = await setupSubmission();
  const other = await createUser();
  await service.register(other, registration);
  const foreign = await files.uploadAsset(other, "cover", image, "foreign.png");
  await assert.rejects(
    service.saveDraft(user, {
      revision: submitted.revision,
      payload: { ...payload, coverId: foreign.id },
    }),
  );
  await assert.rejects(
    service.saveDraft(user, {
      revision: submitted.revision,
      payload: { ...payload, codeUrl: "javascript:alert(1)" },
    }),
    expectCode("INVALID_INPUT"),
  );
  await assert.rejects(
    files.uploadAsset(user, "cover", Buffer.from("fake image"), "fake.png"),
  );
  await assert.rejects(
    files.uploadAsset(
      user,
      "document",
      Buffer.from("%PDF-1.7\nfake\n%%EOF"),
      "fake.pdf",
    ),
  );
  await assert.rejects(files.uploadAsset(user, "cover", pdf, "wrong.png"));
  const privateDirectory = process.env.UPLOAD_PATH;
  try {
    process.env.UPLOAD_PATH = path.resolve("public", "uploads");
    await assert.rejects(
      files.uploadAsset(user, "cover", image, "private.png"),
      /outside public/,
    );
  } finally {
    process.env.UPLOAD_PATH = privateDirectory;
  }
  await assert.rejects(
    files.uploadAsset(
      user,
      "document",
      Buffer.alloc(20 * 1024 * 1024 + 1),
      "oversize.pdf",
    ),
  );
  const screenshot = await files.uploadAsset(
    user,
    "screenshot",
    image,
    "screenshot.png",
  );
  await assert.rejects(
    service.saveDraft(user, {
      revision: submitted.revision,
      payload: { ...payload, screenshotIds: Array(7).fill(screenshot.id) },
    }),
  );
});

test("Registration and submission windows are checked separately; review remains possible after close", async () => {
  const user = await createUser();
  config.registrationOpensAt = new Date(Date.now() + 60_000).toISOString();
  await assert.rejects(
    service.register(user, registration),
    expectCode("NOT_OPEN"),
  );
  config.registrationOpensAt = new Date(Date.now() - 60_000).toISOString();
  config.registrationClosesAt = new Date(Date.now()).toISOString();
  await assert.rejects(
    service.register(user, registration),
    expectCode("CLOSED"),
  );
  config.registrationClosesAt = new Date(Date.now() + 60_000).toISOString();
  const { user: participant, payload, submitted } = await setupSubmission();
  config.submissionOpensAt = new Date(Date.now() + 60_000).toISOString();
  await assert.rejects(
    service.saveDraft(participant, { revision: submitted.revision, payload }),
    expectCode("NOT_OPEN"),
  );
  config.submissionOpensAt = new Date(Date.now() - 60_000).toISOString();
  config.submissionClosesAt = new Date(Date.now()).toISOString();
  await assert.rejects(
    files.uploadAsset(participant, "cover", image, "closed.png"),
    expectCode("CLOSED"),
  );
  await assert.rejects(
    service.submitMaterials(participant, { revision: submitted.revision }),
    expectCode("CLOSED"),
  );
  assert.ok((await service.getMaterials(participant)).official);
  await service.reviewMaterials(reviewer, submitted.id!, {
    revision: submitted.revision,
    submittedRevision: submitted.submittedRevision,
    action: "rejected",
    publicNote: "Not accepted",
  });
  assert.equal((await service.getMaterials(participant)).result, "rejected");
});

test("Replacing files preserves shared references and cleanup removes only aged orphans", async () => {
  const { user, payload, submitted, cover, document } = await setupSubmission();
  const replacement = await files.uploadAsset(
    user,
    "cover",
    image,
    "replacement.png",
  );
  const draft = await service.saveDraft(user, {
    revision: submitted.revision,
    payload: { ...payload, coverId: replacement.id },
  });
  await service.submitMaterials(user, { revision: draft.revision });
  await assert.rejects(files.readAsset(user, cover.id));
  assert.ok((await files.readAsset(user, document.id)).buffer.length > 0);
  const orphan = await files.uploadAsset(
    user,
    "screenshot",
    image,
    "orphan.png",
  );
  await (
    await database.getDb()
  )
    .update(schema.eventAssets)
    .set({ createdAt: new Date(Date.now() - 25 * 3600_000) })
    .where(eq(schema.eventAssets.id, orphan.id));
  await files.cleanupOrphanFiles();
  await assert.rejects(files.readAsset(user, orphan.id));
  assert.ok((await files.readAsset(user, replacement.id)).buffer.length > 0);
  await database.closeDb();
  assert.ok((await service.getParticipation(user)).registration);
  assert.equal(
    (await service.getMaterials(user)).official?.coverId,
    replacement.id,
  );
  assert.ok((await files.readAsset(user, document.id)).buffer.length > 0);
});
