import { and, count, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import {
  eventMaterials,
  eventRegistrations,
  eventAssets,
  users,
  businessAuditLogs,
} from "@/lib/schema";
import { readContent } from "../content-management/store";
import type { EventDefinition } from "../event-board/contracts";
import { authorizeAdmin, appendBusinessAudit } from "../admin/service";
import type { AuthUser } from "../auth/contracts";
import type { AdminPage } from "../admin/contracts";
import type {
  DecisionInput,
  MaterialReviewDetail,
  MaterialReviewItem,
  ReviewFilters,
  ReviewStatus,
  MaterialReviewSnapshot,
} from "./contracts";
import { MaterialReviewError } from "./errors";
type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Db | Tx;
export function reviewStatus(material: {
  status: string;
  result: string | null;
}): ReviewStatus {
  return material.status === "pending"
    ? "pending"
    : material.status === "processed" && material.result === "accepted"
      ? "approved"
      : "rejected";
}
function id(value: string) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new MaterialReviewError("INVALID_INPUT");
  return value;
}
const projection = {
  material: eventMaterials,
  registration: eventRegistrations,
  email: users.email,
};
function rows(db: Reader) {
  return db
    .select(projection)
    .from(eventMaterials)
    .innerJoin(
      eventRegistrations,
      and(
        eq(eventRegistrations.userId, eventMaterials.userId),
        eq(eventRegistrations.eventId, eventMaterials.eventId),
      ),
    )
    .innerJoin(users, eq(users.id, eventMaterials.userId));
}
type Row = Awaited<ReturnType<typeof rows>>[number];
async function item(row: Row, db: Reader): Promise<MaterialReviewItem> {
  const m = row.material,
    r = row.registration;
  return {
    id: m.id,
    eventId: m.eventId,
    eventName: (
      (await readContent("event", m.eventId, db))?.draft as
        EventDefinition | undefined
    )?.name ?? {
      zh: m.eventId,
      en: m.eventId,
    },
    projectName: m.official?.name ?? "",
    registration: {
      id: r.id,
      email: row.email,
      displayName: r.displayName,
      role: r.role,
      country: r.country,
      organization: r.organization,
      contact: r.contact,
      acceptedTerms: r.acceptedTerms,
      createdAt: r.createdAt.toISOString(),
    },
    status: reviewStatus(m),
    revision: m.revision,
    submittedRevision: m.submittedRevision,
    submittedAt: m.submittedAt?.toISOString() ?? null,
    processedAt: m.processedAt?.toISOString() ?? null,
    reason: m.publicNote,
  };
}
export async function listMaterials(
  user: AuthUser,
  filters: ReviewFilters = {},
): Promise<AdminPage<MaterialReviewItem>> {
  const db = await getDb();
  await authorizeAdmin(db, user, "admin:materials");
  if (
    Object.keys(filters).some(
      (key) => !["page", "eventId", "status"].includes(key),
    )
  )
    throw new MaterialReviewError("INVALID_INPUT");
  const page = filters.page ?? 1;
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    (filters.status &&
      !["pending", "approved", "rejected"].includes(filters.status))
  )
    throw new MaterialReviewError("INVALID_INPUT");
  if (filters.eventId && !(await readContent("event", filters.eventId, db)))
    throw new MaterialReviewError("NOT_FOUND", 404);
  const conditions = [isNotNull(eventMaterials.official)];
  if (filters.eventId)
    conditions.push(eq(eventMaterials.eventId, filters.eventId));
  if (filters.status === "pending")
    conditions.push(eq(eventMaterials.status, "pending"));
  if (filters.status === "approved")
    conditions.push(
      and(
        eq(eventMaterials.status, "processed"),
        eq(eventMaterials.result, "accepted"),
      )!,
    );
  if (filters.status === "rejected")
    conditions.push(
      or(
        eq(eventMaterials.status, "needs_changes"),
        and(
          eq(eventMaterials.status, "processed"),
          eq(eventMaterials.result, "rejected"),
        ),
      )!,
    );
  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(eventMaterials)
    .where(where);
  const found = await rows(db)
    .where(where)
    .orderBy(desc(eventMaterials.submittedAt), eventMaterials.id)
    .limit(20)
    .offset((page - 1) * 20);
  return {
    items: await Promise.all(found.map((row) => item(row, db))),
    total,
    page,
    pageSize: 20,
    totalPages: Math.ceil(total / 20),
  };
}
async function detail(
  db: Reader,
  materialId: string,
): Promise<MaterialReviewDetail> {
  const [row] = await rows(db)
    .where(
      and(
        eq(eventMaterials.id, id(materialId)),
        isNotNull(eventMaterials.official),
      ),
    )
    .limit(1);
  if (!row) throw new MaterialReviewError("NOT_FOUND", 404);
  const m = row.material,
    p = m.official!;
  const refs = [p.coverId, ...p.screenshotIds, p.documentId].filter(
    (value): value is string => Boolean(value),
  );
  const assets = refs.length
    ? await db
        .select()
        .from(eventAssets)
        .where(
          and(
            eq(eventAssets.eventId, m.eventId),
            eq(eventAssets.userId, m.userId),
            inArray(eventAssets.id, refs),
          ),
        )
    : [];
  const audits = await db
    .select()
    .from(businessAuditLogs)
    .where(
      and(
        eq(businessAuditLogs.resourceType, "material"),
        eq(businessAuditLogs.resourceId, m.id),
      ),
    )
    .orderBy(desc(businessAuditLogs.createdAt), desc(businessAuditLogs.id));
  return {
    ...(await item(row, db)),
    official: p,
    internalNote: m.internalNote,
    assets: assets.map((a) => ({
      id: a.id,
      purpose: a.purpose,
      originalName: a.originalName,
      mediaType: a.mediaType,
      size: a.size,
      url: `/api/admin/materials/${m.id}/files/${a.id}`,
    })),
    history: audits.map((a) => {
      const after = a.after as MaterialReviewSnapshot;
      return {
        id: a.id,
        actor: a.actor,
        action: a.action,
        ...after,
        before: a.before as MaterialReviewSnapshot | null,
        after,
        createdAt: a.createdAt.toISOString(),
      };
    }),
  };
}
export async function getMaterial(user: AuthUser, materialId: string) {
  const db = await getDb();
  await authorizeAdmin(db, user, "admin:materials");
  return detail(db, materialId);
}
export async function decideMaterialInTransaction(
  tx: Tx,
  user: AuthUser,
  materialId: string,
  value: DecisionInput,
) {
  await authorizeAdmin(tx, user, "admin:materials");
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          "revision",
          "submittedRevision",
          "action",
          "reason",
          "internalNote",
        ].includes(key),
    ) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !Number.isSafeInteger(value.submittedRevision) ||
    value.submittedRevision < 1 ||
    !["approved", "rejected"].includes(value.action) ||
    typeof value.reason !== "string" ||
    value.reason.length > 5000 ||
    /\u0000/.test(value.reason) ||
    (value.action === "rejected" && !value.reason.trim()) ||
    (value.internalNote !== undefined &&
      (typeof value.internalNote !== "string" ||
        value.internalNote.length > 5000 ||
        /\u0000/.test(value.internalNote)))
  )
    throw new MaterialReviewError("INVALID_INPUT");
  const [old] = await tx
    .select()
    .from(eventMaterials)
    .where(eq(eventMaterials.id, id(materialId)))
    .limit(1);
  if (!old?.official) throw new MaterialReviewError("NOT_FOUND", 404);
  if (
    old.revision !== value.revision ||
    old.submittedRevision !== value.submittedRevision
  )
    throw new MaterialReviewError("REVISION_CONFLICT", 409);
  if (old.status !== "pending")
    throw new MaterialReviewError("NOT_PENDING", 409);
  const reason = value.reason.trim() || null;
  const [next] = await tx
    .update(eventMaterials)
    .set({
      status: "processed",
      result: value.action === "approved" ? "accepted" : "rejected",
      publicNote: reason,
      internalNote:
        value.internalNote === undefined
          ? old.internalNote
          : value.internalNote.trim() || null,
      processedBy: user.id,
      processedAt: new Date(),
      revision: old.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(eventMaterials.id, old.id))
    .returning();
  await appendBusinessAudit(tx, {
    actor: user,
    action: `material.${value.action}`,
    resourceType: "material",
    resourceId: old.id,
    eventId: old.eventId,
    before: {
      revision: old.revision,
      submittedRevision: old.submittedRevision,
      status: reviewStatus(old),
      reason: old.publicNote,
      internalNote: old.internalNote,
    },
    after: {
      revision: next.revision,
      submittedRevision: next.submittedRevision,
      status: reviewStatus(next),
      reason,
      internalNote: next.internalNote,
    },
  });
  return detail(tx, old.id);
}
export async function decideMaterial(
  user: AuthUser,
  materialId: string,
  value: DecisionInput,
) {
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction((tx) =>
      decideMaterialInTransaction(tx, user, materialId, value),
    ),
  );
}
