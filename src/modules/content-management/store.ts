import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { eventRegistry } from "../event-board/config";
import { managedContent } from "./schema";
import { defaultHomepage } from "./defaults";
import type {
  ContentKind,
  ContentRecord,
  ContentPayload,
  HomepageContent,
} from "./contracts";
import type { EventDefinition } from "../event-board/contracts";
export type ContentReader =
  | Awaited<ReturnType<typeof getDb>>
  | Parameters<
      Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]
    >[0];
export async function readContent(
  kind: ContentKind,
  id: string,
  db?: ContentReader,
): Promise<ContentRecord | null> {
  db ??= await getDb();
  const [row] = await db
    .select()
    .from(managedContent)
    .where(and(eq(managedContent.kind, kind), eq(managedContent.id, id)))
    .limit(1);
  if (row)
    return {
      ...row,
      live: row.live ?? null,
      updatedAt: row.updatedAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  const baseline: ContentPayload | undefined =
    kind === "homepage" && id === "homepage"
      ? defaultHomepage()
      : kind === "event"
        ? eventRegistry.find((item) => item.id === id)
        : undefined;
  return baseline
    ? {
        id,
        kind,
        revision: 0,
        state: "published",
        draft: structuredClone(baseline),
        live: structuredClone(baseline),
        updatedAt: "2026-10-01T00:00:00.000Z",
        publishedAt: null,
        updatedBy: null,
      }
    : null;
}
export async function readEventRegistry(
  db?: ContentReader,
): Promise<EventDefinition[]> {
  db ??= await getDb();
  const rows = await db
    .select()
    .from(managedContent)
    .where(eq(managedContent.kind, "event"));
  const events = new Map(
    eventRegistry.map((event) => [event.id, structuredClone(event)]),
  );
  for (const row of rows) {
    if (row.state === "published" && row.live)
      events.set(row.id, { ...(row.live as EventDefinition), published: true });
    else events.delete(row.id);
  }
  return [...events.values()].filter((event) => event.published);
}
export async function readPublishedEvent(id: string, db?: ContentReader) {
  return (await readEventRegistry(db)).find((event) => event.id === id) ?? null;
}
export async function readPublishedHomepage(): Promise<HomepageContent> {
  const row = await readContent("homepage", "homepage");
  return row?.state === "published" && row.live
    ? (row.live as HomepageContent)
    : defaultHomepage();
}
