import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { eq, count, sql } from "drizzle-orm";
import type { AuthUser } from "../src/modules/auth/contracts";
import type { MaterialPayload } from "../src/modules/event-participation/contracts";
let dbm: typeof import("../src/lib/db"),
  schema: typeof import("../src/lib/schema"),
  review: typeof import("../src/modules/material-review/service"),
  events: typeof import("../src/modules/event-participation/service"),
  files: typeof import("../src/modules/event-participation/files"),
  admin: typeof import("../src/modules/admin/service");
let directory: string,
  image: Buffer,
  pdf: Buffer,
  operator: AuthUser,
  superAdmin: AuthUser;
const code = (wanted: string) => (error: unknown) => {
  assert.equal((error as { code: string }).code, wanted);
  return true;
};
async function user(role?: "super_admin" | "operator") {
  const value = {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    createdAt: new Date(),
  };
  const db = await dbm.getDb();
  await db.insert(schema.users).values(value);
  if (role)
    await db
      .insert(schema.administrators)
      .values({
        userId: value.id,
        email: value.email,
        role,
        enabled: true,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: { source: "bootstrap", userId: null, label: "test fixture" },
      });
  return value;
}
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "material-review-"));
  Object.assign(process.env, {
    DB_PATH: path.join(directory, "db"),
    UPLOAD_PATH: path.join(directory, "files"),
  });
  dbm = await import("../src/lib/db");
  schema = await import("../src/lib/schema");
  review = await import("../src/modules/material-review/service");
  events = await import("../src/modules/event-participation/service");
  files = await import("../src/modules/event-participation/files");
  admin = await import("../src/modules/admin/service");
  image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#88aabb" },
  })
    .png()
    .toBuffer();
  const doc = await PDFDocument.create();
  doc.addPage();
  pdf = Buffer.from(await doc.save());
  operator = await user("operator");
  superAdmin = await user("super_admin");
});
after(async () => {
  await dbm?.closeDb();
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function submission() {
  const owner = await user(),
    service = events.forEvent("demo"),
    assetService = files.filesForEvent("demo");
  await service.register(owner, {
    displayName: "Builder",
    role: "developer",
    country: "CN",
    organization: "",
    contact: "",
    acceptedTerms: true,
  });
  const cover = await assetService.uploadAsset(
      owner,
      "cover",
      image,
      "cover.png",
    ),
    document = await assetService.uploadAsset(
      owner,
      "document",
      pdf,
      "proposal.pdf",
    );
  const payload: MaterialPayload = {
    name: "Official project",
    tagline: "Tagline",
    description: "Proposal",
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
  const draft = await service.saveDraft(owner, { revision: 0, payload });
  const material = await service.submitMaterials(owner, {
    revision: draft.revision,
  });
  return { owner, service, assetService, payload, material };
}
async function auditCount() {
  return (
    await (
      await dbm.getDb()
    )
      .select({ total: count() })
      .from(schema.businessAuditLogs)
  )[0].total;
}
test("Old reviewer email whitelist grants no role or private file access; both effective admin roles can review", async () => {
  const { owner, material, payload, assetService } = await submission(),
    legacy = await user();
  process.env.EVENT_REVIEWER_EMAILS = legacy.email;
  assert.equal(await events.forEvent("demo").isReviewer(legacy), false);
  await assert.rejects(review.listMaterials(legacy), code("FORBIDDEN"));
  await assert.rejects(
    events
      .forEvent("demo")
      .reviewMaterials(legacy, material.id!, {
        revision: material.revision,
        submittedRevision: material.submittedRevision,
        action: "accepted",
        publicNote: "",
      }),
    code("FORBIDDEN"),
  );
  await assert.rejects(
    assetService.readAsset(legacy, payload.coverId!),
    code("FORBIDDEN"),
  );
  assert.equal(
    (await review.getMaterial(operator, material.id!)).registration.email,
    owner.email,
  );
  assert.equal(
    (await review.getMaterial(superAdmin, material.id!)).id,
    material.id,
  );
});
test("Only official material is visible, approval accepts an empty reason and users never receive private notes", async () => {
  const { owner, service, payload, material } = await submission();
  await service.saveDraft(owner, {
    revision: material.revision,
    payload: { ...payload, name: "PRIVATE DRAFT" },
  });
  const current = await service.getMaterials(owner);
  const detail = await review.getMaterial(operator, material.id!);
  assert.equal(detail.official.name, "Official project");
  assert.equal("draft" in detail, false);
  const decided = await review.decideMaterial(operator, material.id!, {
    revision: current.revision,
    submittedRevision: current.submittedRevision,
    action: "approved",
    reason: "",
    internalNote: "PRIVATE NOTE",
  });
  assert.equal(decided.status, "approved");
  assert.equal(decided.reason, null);
  assert.equal(decided.internalNote, "PRIVATE NOTE");
  assert.equal(decided.history[0].before?.status, "pending");
  assert.equal(decided.history[0].after.status, "approved");
  assert.equal(
    JSON.stringify(decided.history).includes(payload.coverId!),
    false,
  );
  const visible = await service.getMaterials(owner);
  assert.equal("internalNote" in visible, false);
  assert.equal(visible.canEdit, false);
  await assert.rejects(
    service.saveDraft(owner, { revision: visible.revision, payload }),
    code("PROCESSED"),
  );
});
test("Rejection requires a reason, allows open-window resubmission and leaves history without old attachment references", async () => {
  const { owner, service, payload, material } = await submission(),
    before = await auditCount();
  await assert.rejects(
    review.decideMaterial(operator, material.id!, {
      revision: material.revision,
      submittedRevision: 1,
      action: "rejected",
      reason: "  ",
    }),
    code("INVALID_INPUT"),
  );
  assert.equal(await auditCount(), before);
  const rejected = await review.decideMaterial(operator, material.id!, {
    revision: material.revision,
    submittedRevision: 1,
    action: "rejected",
    reason: "Explain the proposal",
    internalNote: "Internal review",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal((await service.getMaterials(owner)).canEdit, true);
  const draft = await service.saveDraft(owner, {
    revision: rejected.revision,
    payload: { ...payload, description: "Clarified proposal" },
  });
  const next = await service.submitMaterials(owner, {
    revision: draft.revision,
  });
  assert.equal(next.status, "pending");
  assert.equal(next.submittedRevision, 2);
  assert.equal(next.publicNote, null);
  const detail = await review.getMaterial(operator, next.id!);
  assert.equal(detail.history.length, 1);
  assert.equal(detail.history[0].submittedRevision, 1);
  assert.equal(detail.internalNote, null);
});
test("Concurrent decisions produce one revision and one durable business audit", async () => {
  const { material } = await submission(),
    before = await auditCount();
  const results = await Promise.allSettled(
    ["approved", "rejected"].map((action) =>
      review.decideMaterial(operator, material.id!, {
        revision: material.revision,
        submittedRevision: 1,
        action: action as "approved" | "rejected",
        reason: "Decision",
      }),
    ),
  );
  assert.equal(
    results.filter((value) => value.status === "fulfilled").length,
    1,
  );
  assert.equal(
    (
      results.find(
        (value) => value.status === "rejected",
      ) as PromiseRejectedResult
    ).reason.code,
    "REVISION_CONFLICT",
  );
  assert.equal(await auditCount(), before + 1);
});
test("Permission removal is checked again in queued decision transaction", async () => {
  const { material } = await submission(),
    revoked = await user("operator");
  const revoke = admin.updateAdministrator(superAdmin, revoked.id, {
    role: "operator",
    enabled: false,
    revision: 1,
  });
  const pending = review.decideMaterial(revoked, material.id!, {
    revision: material.revision,
    submittedRevision: 1,
    action: "approved",
    reason: "",
  });
  await revoke;
  await assert.rejects(pending, code("FORBIDDEN"));
  assert.equal(
    (await review.getMaterial(operator, material.id!)).status,
    "pending",
  );
});
test("Business audit insertion failure rolls back decision status and revision", async () => {
  const { material } = await submission(),
    db = await dbm.getDb();
  await db.execute(
    sql`CREATE FUNCTION reject_business_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit test failure'; END; $$`,
  );
  await db.execute(
    sql`CREATE TRIGGER reject_business_audit_test BEFORE INSERT ON business_audit_logs FOR EACH ROW EXECUTE FUNCTION reject_business_audit_test()`,
  );
  try {
    await assert.rejects(
      review.decideMaterial(operator, material.id!, {
        revision: material.revision,
        submittedRevision: 1,
        action: "approved",
        reason: "",
      }),
    );
    const current = await review.getMaterial(operator, material.id!);
    assert.equal(current.status, "pending");
    assert.equal(current.revision, material.revision);
    assert.equal(current.history.length, 0);
  } finally {
    await db.execute(
      sql`DROP TRIGGER reject_business_audit_test ON business_audit_logs`,
    );
    await db.execute(sql`DROP FUNCTION reject_business_audit_test()`);
  }
});
test("Historical needs_changes maps to rejected and cannot be reviewed without a new pending revision", async () => {
  const { material } = await submission();
  await (
    await dbm.getDb()
  )
    .update(schema.eventMaterials)
    .set({ status: "needs_changes", publicNote: "Old change request" })
    .where(eq(schema.eventMaterials.id, material.id!));
  assert.equal(
    (await review.getMaterial(operator, material.id!)).status,
    "rejected",
  );
  assert.ok(
    (
      await review.listMaterials(operator, {
        eventId: "demo",
        status: "rejected",
      })
    ).items.some((item) => item.id === material.id),
  );
  await assert.rejects(
    review.decideMaterial(operator, material.id!, {
      revision: material.revision,
      submittedRevision: 1,
      action: "approved",
      reason: "",
    }),
    code("NOT_PENDING"),
  );
  await dbm.closeDb();
  assert.equal(
    (await review.getMaterial(operator, material.id!)).status,
    "rejected",
  );
});
