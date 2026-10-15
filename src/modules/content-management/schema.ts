import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "../auth/schema";
import type {
  ContentKind,
  ContentPayload,
  PublicationState,
} from "./contracts";
export const managedContent = pgTable(
  "managed_content",
  {
    kind: text("kind").$type<ContentKind>().notNull(),
    id: text("id").notNull(),
    revision: integer("revision").notNull().default(1),
    state: text("state").$type<PublicationState>().notNull().default("draft"),
    draft: jsonb("draft").$type<ContentPayload>().notNull(),
    live: jsonb("live").$type<ContentPayload>(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.id] }),
    check("managed_content_kind", sql`${table.kind} in ('event', 'homepage')`),
    check(
      "managed_content_state",
      sql`${table.state} in ('draft', 'published', 'withdrawn')`,
    ),
    check("managed_content_revision", sql`${table.revision} > 0`),
  ],
);
