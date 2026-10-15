import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/schema";
import type {
  AssetPurpose,
  MaterialPayload,
  MaterialStatus,
  RegistrationRole,
  ReviewResult,
} from "./contracts";

const date = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    role: text("role").$type<RegistrationRole>().notNull(),
    country: text("country").notNull(),
    organization: text("organization").notNull().default(""),
    contact: text("contact").notNull().default(""),
    acceptedTerms: boolean("accepted_terms").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("event_registrations_event_user_unique").on(
      table.eventId,
      table.userId,
    ),
    index("event_registrations_user_id_idx").on(table.userId),
    index("event_registrations_event_created_at_idx").on(
      table.eventId,
      table.createdAt,
    ),
  ],
);

export const eventMaterials = pgTable(
  "event_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    official: jsonb("official").$type<MaterialPayload>(),
    draft: jsonb("draft").$type<MaterialPayload>(),
    revision: integer("revision").notNull().default(0),
    submittedRevision: integer("submitted_revision").notNull().default(0),
    status: text("status")
      .$type<MaterialStatus>()
      .notNull()
      .default("not_submitted"),
    result: text("result").$type<ReviewResult>(),
    publicNote: text("public_note"),
    internalNote: text("internal_note"),
    processedBy: uuid("processed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    processedAt: date("processed_at"),
    submittedAt: date("submitted_at"),
    updatedAt: date("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("event_materials_event_user_unique").on(table.eventId, table.userId),
    index("event_materials_user_id_idx").on(table.userId),
    index("event_materials_event_status_idx").on(table.eventId, table.status),
    index("event_materials_processed_by_idx").on(table.processedBy),
  ],
);

export const eventAssets = pgTable(
  "event_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<AssetPurpose>().notNull(),
    originalName: text("original_name").notNull(),
    storageName: text("storage_name").notNull().unique(),
    mediaType: text("media_type").notNull(),
    size: integer("size").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("event_assets_event_user_idx").on(table.eventId, table.userId),
    index("event_assets_user_id_idx").on(table.userId),
  ],
);
