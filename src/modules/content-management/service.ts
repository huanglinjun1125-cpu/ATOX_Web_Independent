import { and, desc, eq } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import type { AuthUser } from "../auth/contracts";
import { authorizeAdmin, appendBusinessAudit } from "../admin/service";
import { businessAuditLogs } from "../admin/schema";
import {
  eventRegistry,
  demoEventConfig,
  validateEventRegistry,
} from "../event-board/config";
import type { EventDefinition } from "../event-board/contracts";
import { eventMaterials } from "../event-participation/schema";
import { managedContent } from "./schema";
import { readContent, readEventRegistry } from "./store";
import {
  contentId,
  ContentError,
  validateEvent,
  validateHomepage,
} from "./rules";
import type {
  ContentCommand,
  ContentKind,
  ContentPayload,
  ContentRecord,
} from "./contracts";

export async function getManagedContent(
  user: AuthUser,
  kind: ContentKind,
  id: string,
) {
  if (kind !== "event" && kind !== "homepage")
    throw new ContentError("INVALID_INPUT");
  const db = await getDb();
  await authorizeAdmin(db, user, "admin:content");
  contentId(id);
  const content = await readContent(kind, id, db);
  if (!content) throw new ContentError("CONTENT_NOT_FOUND", 404);
  const history = await db
    .select()
    .from(businessAuditLogs)
    .where(
      and(
        eq(businessAuditLogs.resourceType, kind),
        eq(businessAuditLogs.resourceId, id),
      ),
    )
    .orderBy(desc(businessAuditLogs.createdAt), desc(businessAuditLogs.id))
    .limit(50);
  return {
    content,
    history: history.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
export async function listManagedEvents(user: AuthUser) {
  const db = await getDb();
  await authorizeAdmin(db, user, "admin:content");
  const rows = await db
    .select({ id: managedContent.id })
    .from(managedContent)
    .where(eq(managedContent.kind, "event"));
  const ids = [
    ...new Set([
      ...eventRegistry.map((item) => item.id),
      ...rows.map((item) => item.id),
    ]),
  ].sort();
  return {
    items: (
      await Promise.all(ids.map((id) => readContent("event", id, db)))
    ).filter((row): row is ContentRecord => row !== null),
  };
}
export async function createManagedEvent(user: AuthUser, id: string) {
  contentId(id);
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      await authorizeAdmin(tx, user, "admin:content");
      if (await readContent("event", id, tx))
        throw new ContentError("ID_EXISTS", 409);
      const template = structuredClone(demoEventConfig);
      template.id = id;
      template.target = `/events/${id}`;
      template.recommended = false;
      template.name = { zh: "新活动 · 草稿", en: "New event · Draft" };
      template.participantCenter = undefined;
      await tx.insert(managedContent).values({
        kind: "event",
        id,
        draft: template,
        revision: 1,
        state: "draft",
        updatedBy: user.id,
      });
      await appendBusinessAudit(tx, {
        actor: user,
        action: "create",
        resourceType: "event",
        resourceId: id,
        eventId: id,
        before: null,
        after: { state: "draft", draft: template, revision: 1 },
      });
      return { content: (await readContent("event", id, tx))! };
    }),
  );
}
export async function changeContent(
  user: AuthUser,
  kind: ContentKind,
  id: string,
  command: ContentCommand,
) {
  if (kind !== "event" && kind !== "homepage")
    throw new ContentError("INVALID_INPUT");
  contentId(id);
  if (
    !command ||
    typeof command !== "object" ||
    Array.isArray(command) ||
    Object.keys(command).some(
      (key) => !["revision", "action", "draft"].includes(key),
    ) ||
    !Number.isSafeInteger(command.revision) ||
    command.revision < 0 ||
    !["save", "publish", "withdraw"].includes(command.action)
  )
    throw new ContentError("INVALID_INPUT");
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      await authorizeAdmin(tx, user, "admin:content");
      const before = await readContent(kind, id, tx);
      if (!before) throw new ContentError("CONTENT_NOT_FOUND", 404);
      if (before.revision !== command.revision)
        throw new ContentError("REVISION_CONFLICT", 409);
      let draft = before.draft;
      if (command.action === "save") {
        draft =
          kind === "event"
            ? validateEvent(command.draft, id, before.draft as EventDefinition)
            : validateHomepage(command.draft);
      } else if (command.action === "publish") {
        if (!before.revision)
          throw new ContentError("SAVE_BEFORE_PUBLISH", 409);
        draft =
          kind === "event"
            ? validateEvent(draft, id, before.draft as EventDefinition)
            : validateHomepage(draft);
        if (kind === "event") {
          const event = draft as EventDefinition;
          const registry = (await readEventRegistry(tx)).filter(
            (item) => item.id !== id,
          );
          try {
            validateEventRegistry([...registry, event]);
          } catch {
            throw new ContentError("RECOMMENDATION_CONFLICT", 409);
          }
          // A track still used by any official submission or draft cannot disappear on publication.
          const submissions = await tx
            .select({
              official: eventMaterials.official,
              draft: eventMaterials.draft,
            })
            .from(eventMaterials)
            .where(eq(eventMaterials.eventId, id));
          const trackIds = new Set(event.tracks.map((track) => track.id));
          if (
            submissions.some((row) =>
              [row.official, row.draft].some(
                (payload) => payload?.trackId && !trackIds.has(payload.trackId),
              ),
            )
          )
            throw new ContentError("TRACK_IN_USE", 409);
        }
      }
      const state =
        command.action === "publish"
          ? "published"
          : command.action === "withdraw"
            ? "withdrawn"
            : before.state;
      if (command.action === "withdraw" && before.state !== "published")
        throw new ContentError("NOT_PUBLISHED", 409);
      const now = new Date();
      const updated = {
        kind,
        id,
        draft: draft as ContentPayload,
        live:
          command.action === "publish"
            ? (draft as ContentPayload)
            : before.live,
        state,
        revision: before.revision + 1,
        updatedAt: now,
        updatedBy: user.id,
        publishedAt:
          command.action === "publish"
            ? now
            : before.publishedAt
              ? new Date(before.publishedAt)
              : null,
      };
      await tx
        .insert(managedContent)
        .values(updated)
        .onConflictDoUpdate({
          target: [managedContent.kind, managedContent.id],
          set: updated,
        });
      const after = (await readContent(kind, id, tx))!;
      await appendBusinessAudit(tx, {
        actor: user,
        action: command.action,
        resourceType: kind,
        resourceId: id,
        eventId: kind === "event" ? id : null,
        before,
        after,
      });
      return { content: after };
    }),
  );
}
