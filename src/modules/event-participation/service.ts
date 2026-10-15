import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import {
  users,
  eventRegistrations,
  eventMaterials,
  eventAssets,
} from "@/lib/schema";
import type { AuthUser } from "../auth/contracts";
import type {
  AssetDto,
  AssetPurpose,
  BlockReason,
  DraftInput,
  MaterialPayload,
  MaterialsDto,
  ParticipationDto,
  RegistrationDto,
  RegistrationInput,
  ReviewInput,
  ReviewItem,
  SubmitInput,
} from "./contracts";
import { eventConfig } from "./config";
import { getEventConfig } from "../event-board/config";
import type { EventDefinition } from "../event-board/contracts";
import { EventError } from "./errors";
import { authorizeAdmin } from "../admin/service";
import { decideMaterialInTransaction } from "../material-review/service";

type Database = Awaited<ReturnType<typeof getDb>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;
type Registration = typeof eventRegistrations.$inferSelect;
type Material = typeof eventMaterials.$inferSelect;

export function buildEventService(
  eventConfig: EventDefinition,
  configReader?: (db?: Reader) => Promise<EventDefinition | null>,
) {
  async function refreshConfig(db?: Reader) {
    if (configReader) {
      const latest = await configReader(db);
      if (!latest || !latest.published || latest.id !== eventConfig.id)
        throw new EventError("NOT_FOUND");
      eventConfig = latest;
    }
  }
  function ensurePublished() {
    if (!eventConfig.published) throw new EventError("NOT_FOUND");
  }
  async function isReviewer(user: AuthUser) {
    try {
      await authorizeAdmin(await getDb(), user, "admin:materials");
      return true;
    } catch {
      return false;
    }
  }
  async function requireReviewer(user: AuthUser, db?: Reader) {
    await authorizeAdmin(db ?? (await getDb()), user, "admin:materials");
  }
  function materialReferences(
    payload: MaterialPayload | null | undefined,
  ): string[] {
    if (!payload) return [];
    return [
      ...new Set(
        [
          payload.coverId,
          ...(payload.screenshotIds ?? []),
          payload.documentId,
        ].filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
  }
  function assetDto(asset: typeof eventAssets.$inferSelect): AssetDto {
    return {
      id: asset.id,
      purpose: asset.purpose,
      originalName: asset.originalName,
      mediaType: asset.mediaType,
      size: asset.size,
      url: `/api/events/${eventConfig.id}/files/${asset.id}`,
    };
  }
  function scope(user: AuthUser) {
    return and(
      eq(eventMaterials.eventId, eventConfig.id),
      eq(eventMaterials.userId, user.id),
    );
  }
  async function registrationFor(db: Reader, user: AuthUser) {
    const [registration] = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventConfig.id),
          eq(eventRegistrations.userId, user.id),
        ),
      )
      .limit(1);
    return registration ?? null;
  }
  async function materialFor(db: Reader, user: AuthUser) {
    const [material] = await db
      .select()
      .from(eventMaterials)
      .where(scope(user))
      .limit(1);
    return material ?? null;
  }
  function registrationDto(
    registration: Registration,
    email: string,
  ): RegistrationDto {
    return {
      id: registration.id,
      email,
      displayName: registration.displayName,
      role: registration.role,
      country: registration.country,
      organization: registration.organization,
      contact: registration.contact,
      acceptedTerms: registration.acceptedTerms,
      createdAt: registration.createdAt.toISOString(),
    };
  }
  function periodReason(
    opens: string,
    closes: string,
    now = new Date(),
  ): BlockReason {
    if (now.getTime() < Date.parse(opens)) return "NOT_OPEN";
    if (now.getTime() >= Date.parse(closes)) return "CLOSED";
    return null;
  }
  function editReason(
    registration: Registration | null,
    material: Material | null,
  ): BlockReason {
    if (!registration) return "NOT_REGISTERED";
    if (material?.status === "processed" && material.result !== "rejected")
      return "PROCESSED";
    return periodReason(
      eventConfig.submissionOpensAt,
      eventConfig.submissionClosesAt,
    );
  }
  async function assertCanEdit(user: AuthUser, db?: Reader) {
    await refreshConfig(db);
    ensurePublished();
    const reader = db ?? (await getDb());
    const registration = await registrationFor(reader, user);
    const material = await materialFor(reader, user);
    const reason = editReason(registration, material);
    if (reason) throw new EventError(reason);
    return { registration: registration!, material };
  }
  function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new EventError("INVALID_INPUT");
    return value as Record<string, unknown>;
  }
  function text(value: unknown, max: number, required = false): string {
    if (typeof value !== "string" || value.length > max || /\u0000/.test(value))
      throw new EventError("INVALID_INPUT");
    const normalized = value.trim();
    if (required && !normalized) throw new EventError("INVALID_INPUT");
    return normalized;
  }
  function boolean(value: unknown): boolean {
    if (typeof value !== "boolean") throw new EventError("INVALID_INPUT");
    return value;
  }
  function uuid(value: unknown): string {
    if (
      typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      throw new EventError("INVALID_INPUT");
    return value;
  }
  function validateAssetId(value: unknown) {
    return uuid(value);
  }
  function optionalId(value: unknown) {
    return value === null ? null : uuid(value);
  }
  function revision(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0)
      throw new EventError("INVALID_INPUT");
    return value as number;
  }
  function url(value: unknown): string {
    const normalized = text(value, 2048);
    if (!normalized) return "";
    try {
      const parsed = new URL(normalized);
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname)
        throw new Error();
    } catch {
      throw new EventError("INVALID_INPUT");
    }
    return normalized;
  }
  function payloadInput(value: unknown): MaterialPayload {
    const input = object(value);
    if (
      !Array.isArray(input.screenshotIds) ||
      input.screenshotIds.length > eventConfig.fileRules.maxScreenshots
    )
      throw new EventError("INVALID_INPUT");
    const screenshotIds = input.screenshotIds.map(uuid);
    if (new Set(screenshotIds).size !== screenshotIds.length)
      throw new EventError("INVALID_INPUT");
    const trackId = text(input.trackId, 100);
    if (trackId && !eventConfig.tracks.some((track) => track.id === trackId))
      throw new EventError("INVALID_INPUT");
    return {
      name: text(input.name, 120),
      tagline: text(input.tagline, 240),
      description: text(input.description, 10000),
      trackId,
      coverId: optionalId(input.coverId),
      screenshotIds,
      documentId: optionalId(input.documentId),
      videoUrl: url(input.videoUrl),
      experienceUrl: url(input.experienceUrl),
      codeUrl: url(input.codeUrl),
      original: boolean(input.original),
      usageAuthorized: boolean(input.usageAuthorized),
      publicDisplay: boolean(input.publicDisplay),
    };
  }
  async function validateAssets(
    db: Reader,
    user: AuthUser,
    payload: MaterialPayload,
  ) {
    const references: Array<[string, AssetPurpose]> = [
      ...(payload.coverId
        ? [[payload.coverId, "cover"] as [string, AssetPurpose]]
        : []),
      ...payload.screenshotIds.map(
        (id) => [id, "screenshot"] as [string, AssetPurpose],
      ),
      ...(payload.documentId
        ? [[payload.documentId, "document"] as [string, AssetPurpose]]
        : []),
    ];
    if (!references.length) return;
    const assets = await db
      .select()
      .from(eventAssets)
      .where(
        and(
          eq(eventAssets.eventId, eventConfig.id),
          eq(eventAssets.userId, user.id),
          inArray(
            eventAssets.id,
            references.map(([id]) => id),
          ),
        ),
      );
    if (
      references.some(
        ([id, purpose]) =>
          !assets.some(
            (asset) =>
              asset.id === id &&
              asset.purpose === purpose &&
              asset.size <=
                (purpose === "document"
                  ? eventConfig.fileRules.documentMaxBytes
                  : eventConfig.fileRules.imageMaxBytes),
          ),
      )
    )
      throw new EventError("INVALID_FILE");
  }
  async function materialsDto(
    db: Reader,
    user: AuthUser,
    material: Material | null,
    registration: Registration | null,
  ): Promise<MaterialsDto> {
    ensurePublished();
    const ids = [
      ...new Set([
        ...materialReferences(material?.official),
        ...materialReferences(material?.draft),
      ]),
    ];
    const assets = ids.length
      ? await db
          .select()
          .from(eventAssets)
          .where(
            and(
              eq(eventAssets.eventId, eventConfig.id),
              eq(eventAssets.userId, user.id),
              inArray(eventAssets.id, ids),
            ),
          )
      : [];
    const reason = editReason(registration, material);
    return {
      id: material?.id ?? null,
      official: material?.official ?? null,
      draft: material?.draft ?? null,
      revision: material?.revision ?? 0,
      submittedRevision: material?.submittedRevision ?? 0,
      status: material?.status ?? "not_submitted",
      result: material?.result ?? null,
      publicNote: material?.publicNote ?? null,
      submittedAt: material?.submittedAt?.toISOString() ?? null,
      processedAt: material?.processedAt?.toISOString() ?? null,
      assets: assets.map(assetDto),
      canEdit: !reason,
      reason,
    };
  }
  async function getParticipation(user: AuthUser): Promise<ParticipationDto> {
    ensurePublished();
    const db = await getDb();
    const registration = await registrationFor(db, user);
    const material = await materialFor(db, user);
    const reason = editReason(registration, material);
    return {
      registration: registration
        ? registrationDto(registration, user.email)
        : null,
      status: material?.status ?? "not_submitted",
      hasDraft: Boolean(material?.draft),
      reviewStatus: !material?.official
        ? null
        : material.status === "pending"
          ? "pending"
          : material.result === "accepted"
            ? "approved"
            : "rejected",
      registrationReason: periodReason(
        eventConfig.registrationOpensAt,
        eventConfig.registrationClosesAt,
      ) as "NOT_OPEN" | "CLOSED" | null,
      canRegister:
        !registration &&
        !periodReason(
          eventConfig.registrationOpensAt,
          eventConfig.registrationClosesAt,
        ),
      canEdit: !reason,
      reason,
      serverNow: new Date().toISOString(),
    };
  }
  /** Server-only integration projection; never includes contact details or materials. */
  async function getRegisteredParticipant(userId: string) {
    ensurePublished();
    const db = await getDb();
    const [row] = await db
      .select({
        displayName: eventRegistrations.displayName,
        role: eventRegistrations.role,
      })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventConfig.id),
          eq(eventRegistrations.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }
  async function register(
    user: AuthUser,
    value: RegistrationInput,
  ): Promise<RegistrationDto> {
    ensurePublished();
    const input = object(value);
    const role = input.role;
    if (
      !["developer", "designer", "product", "student", "other"].includes(
        role as string,
      )
    )
      throw new EventError("INVALID_INPUT");
    const acceptedTerms = boolean(input.acceptedTerms);
    if (!acceptedTerms) throw new EventError("INVALID_INPUT");
    const fields = {
      displayName: text(input.displayName, 100, true),
      role: role as RegistrationInput["role"],
      country: text(input.country, 100, true),
      organization: text(input.organization, 200),
      contact: text(input.contact, 200),
      acceptedTerms,
    };
    return serializeDatabaseWrite(async () =>
      (await getDb()).transaction(async (tx) => {
        await refreshConfig(tx);
        const reason = periodReason(
          eventConfig.registrationOpensAt,
          eventConfig.registrationClosesAt,
        );
        if (reason) throw new EventError(reason);
        const previous = await registrationFor(tx, user);
        if (previous) return registrationDto(previous, user.email);
        const [registration] = await tx
          .insert(eventRegistrations)
          .values({
            id: randomUUID(),
            eventId: eventConfig.id,
            userId: user.id,
            ...fields,
            createdAt: new Date(),
          })
          .returning();
        return registrationDto(registration, user.email);
      }),
    );
  }
  async function getMaterials(user: AuthUser): Promise<MaterialsDto> {
    ensurePublished();
    const db = await getDb();
    return materialsDto(
      db,
      user,
      await materialFor(db, user),
      await registrationFor(db, user),
    );
  }
  async function saveDraft(
    user: AuthUser,
    value: DraftInput,
  ): Promise<MaterialsDto> {
    ensurePublished();
    const input = object(value);
    const expected = revision(input.revision);
    const payload = payloadInput(input.payload);
    return serializeDatabaseWrite(async () => {
      const db = await getDb();
      let replaced: string[] = [];
      const result = await db.transaction(async (tx) => {
        const { registration, material } = await assertCanEdit(user, tx);
        if ((material?.revision ?? 0) !== expected)
          throw new EventError("REVISION_CONFLICT");
        payloadInput(payload);
        await validateAssets(tx, user, payload);
        replaced = materialReferences(material?.draft);
        const [saved] = material
          ? await tx
              .update(eventMaterials)
              .set({
                draft: payload,
                revision: expected + 1,
                updatedAt: new Date(),
              })
              .where(eq(eventMaterials.id, material.id))
              .returning()
          : await tx
              .insert(eventMaterials)
              .values({
                id: randomUUID(),
                eventId: eventConfig.id,
                userId: user.id,
                draft: payload,
                revision: 1,
                submittedRevision: 0,
                status: "not_submitted",
                updatedAt: new Date(),
              })
              .returning();
        return materialsDto(tx, user, saved, registration);
      });
      await cleanupReplaced(user, replaced);
      return result;
    });
  }
  async function submitMaterials(
    user: AuthUser,
    value: SubmitInput,
  ): Promise<MaterialsDto> {
    ensurePublished();
    const expected = revision(object(value).revision);
    return serializeDatabaseWrite(async () => {
      const db = await getDb();
      let replaced: string[] = [];
      const result = await db.transaction(async (tx) => {
        const { registration, material } = await assertCanEdit(user, tx);
        if ((material?.revision ?? 0) !== expected)
          throw new EventError("REVISION_CONFLICT");
        if (!material?.draft) throw new EventError("INVALID_INPUT");
        const payload = payloadInput(material.draft);
        if (
          !payload.name ||
          !payload.tagline ||
          !payload.description ||
          !payload.trackId ||
          !payload.coverId ||
          !payload.documentId ||
          !payload.original ||
          !payload.usageAuthorized
        )
          throw new EventError("INVALID_INPUT");
        payloadInput(payload);
        await validateAssets(tx, user, payload);
        replaced = materialReferences(material.official);
        const [saved] = await tx
          .update(eventMaterials)
          .set({
            official: payload,
            draft: null,
            status: "pending",
            result: null,
            publicNote: null,
            internalNote: null,
            processedBy: null,
            processedAt: null,
            submittedAt: new Date(),
            submittedRevision: material.submittedRevision + 1,
            revision: material.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(eventMaterials.id, material.id))
          .returning();
        return materialsDto(tx, user, saved, registration);
      });
      await cleanupReplaced(user, replaced);
      return result;
    });
  }
  async function cleanupReplaced(user: AuthUser, ids: string[]) {
    if (!ids.length) return;
    // This helper is called with the shared write lock held, after a successful commit.
    // File cleanup is best effort: never turn a committed submission into an API failure.
    try {
      const { buildFiles } = await import("./files");
      await buildFiles(eventConfig, configReader).cleanupReplacedAssets(
        user,
        ids,
      );
    } catch {
      /* The manual orphan cleanup command retries later. */
    }
  }
  async function listReviews(user: AuthUser): Promise<ReviewItem[]> {
    ensurePublished();
    await requireReviewer(user);
    const db = await getDb();
    const rows = await db
      .select({
        material: eventMaterials,
        registration: eventRegistrations,
        email: users.email,
      })
      .from(eventMaterials)
      .innerJoin(
        eventRegistrations,
        and(
          eq(eventRegistrations.userId, eventMaterials.userId),
          eq(eventRegistrations.eventId, eventMaterials.eventId),
        ),
      )
      .innerJoin(users, eq(users.id, eventMaterials.userId))
      .where(
        and(
          eq(eventMaterials.eventId, eventConfig.id),
          isNotNull(eventMaterials.official),
        ),
      )
      .orderBy(desc(eventMaterials.submittedAt));
    return Promise.all(
      rows.map(async ({ material, registration, email }) => {
        const ids = materialReferences(material.official);
        const assets = ids.length
          ? await db
              .select()
              .from(eventAssets)
              .where(
                and(
                  eq(eventAssets.eventId, eventConfig.id),
                  eq(eventAssets.userId, material.userId),
                  inArray(eventAssets.id, ids),
                ),
              )
          : [];
        return {
          id: material.id,
          official: material.official,
          revision: material.revision,
          submittedRevision: material.submittedRevision,
          status: material.status,
          result: material.result,
          publicNote: material.publicNote,
          internalNote: material.internalNote,
          submittedAt: material.submittedAt?.toISOString() ?? null,
          processedAt: material.processedAt?.toISOString() ?? null,
          assets: assets.map(assetDto),
          registration: registrationDto(registration, email),
        };
      }),
    );
  }
  async function reviewMaterials(
    user: AuthUser,
    id: string,
    value: ReviewInput,
  ) {
    ensurePublished();
    await requireReviewer(user);
    const input = object(value);
    if (
      Object.keys(input).some(
        (key) =>
          ![
            "revision",
            "submittedRevision",
            "action",
            "publicNote",
            "internalNote",
          ].includes(key),
      )
    )
      throw new EventError("INVALID_INPUT");
    return serializeDatabaseWrite(async () =>
      (await getDb()).transaction(async (tx) => {
        await refreshConfig(tx);
        const [material] = await tx
          .select()
          .from(eventMaterials)
          .where(
            and(
              eq(eventMaterials.id, uuid(id)),
              eq(eventMaterials.eventId, eventConfig.id),
            ),
          )
          .limit(1);
        if (!material?.official) throw new EventError("NOT_FOUND");
        await decideMaterialInTransaction(tx, user, id, {
          revision: revision(input.revision),
          submittedRevision: revision(input.submittedRevision),
          action:
            input.action === "accepted"
              ? "approved"
              : input.action === "rejected" || input.action === "needs_changes"
                ? "rejected"
                : (() => {
                    throw new EventError("INVALID_INPUT");
                  })(),
          reason: text(input.publicNote, 5000),
          ...(input.internalNote === undefined
            ? {}
            : { internalNote: text(input.internalNote, 5000) }),
        });
        return { ok: true as const };
      }),
    );
  }

  return {
    get config() {
      return eventConfig;
    },
    getParticipation,
    getRegisteredParticipant,
    register,
    getMaterials,
    saveDraft,
    submitMaterials,
    listReviews,
    reviewMaterials,
    isReviewer,
    requireReviewer,
    assertCanEdit,
    assetDto,
    materialReferences,
    validateAssetId,
  };
}

export function forEvent(eventId: string) {
  const config = getEventConfig(eventId);
  if (!config) throw new EventError("NOT_FOUND");
  return buildEventService(config);
}
export const {
  getParticipation,
  register,
  getMaterials,
  saveDraft,
  submitMaterials,
  listReviews,
  reviewMaterials,
  isReviewer,
  requireReviewer,
  assertCanEdit,
  assetDto,
  materialReferences,
  validateAssetId,
} = buildEventService(eventConfig);
