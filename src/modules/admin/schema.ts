import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/schema";
import type { AdminActor, AdminRole, AdminSnapshot } from "./contracts";
const date = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export const administrators = pgTable(
  "administrators",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "restrict" }),
    email: text("email").notNull().unique(),
    role: text("role").$type<AdminRole>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    revision: integer("revision").notNull().default(1),
    createdAt: date("created_at").notNull(),
    updatedAt: date("updated_at").notNull(),
    updatedBy: jsonb("updated_by").$type<AdminActor>().notNull(),
  },
  (table) => [
    check(
      "administrators_role_valid",
      sql`${table.role} IN ('super_admin','operator')`,
    ),
    check("administrators_revision_positive", sql`${table.revision}>0`),
  ],
);
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey(),
    action: text("action").$type<"bootstrap" | "grant" | "update">().notNull(),
    actor: jsonb("actor").$type<AdminActor>().notNull(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    targetEmail: text("target_email").notNull(),
    before: jsonb("before").$type<AdminSnapshot>(),
    after: jsonb("after").$type<AdminSnapshot>().notNull(),
    createdAt: date("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("admin_audit_single_bootstrap")
      .on(table.action)
      .where(sql`${table.action}='bootstrap'`),
    index("admin_audit_created_idx").on(table.createdAt),
    check(
      "admin_audit_action_valid",
      sql`${table.action} IN ('bootstrap','grant','update')`,
    ),
  ],
);
export const businessAuditLogs = pgTable(
  "business_audit_logs",
  {
    id: uuid("id").primaryKey(),
    actor: jsonb("actor").$type<AdminActor>().notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    eventId: text("event_id"),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>().notNull(),
    createdAt: date("created_at").notNull(),
  },
  (table) => [
    index("business_audit_resource_idx").on(
      table.resourceType,
      table.resourceId,
    ),
    index("business_audit_created_idx").on(table.createdAt),
  ],
);
