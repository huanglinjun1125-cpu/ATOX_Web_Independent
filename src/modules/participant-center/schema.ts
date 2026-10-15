import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  unique,
  uniqueIndex,
  index,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { users } from "../auth/schema";
import type { ApplicationState } from "./contracts";
import type { RegistrationRole } from "../event-participation/contracts";
export const eventTeams = pgTable(
  "event_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: text("event_id").notNull(),
    captainId: uuid("captain_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    trackId: text("track_id").notNull(),
    skills: text("skills").notNull(),
    recruitment: text("recruitment").notNull(),
    capacity: integer("capacity").notNull(),
    recruiting: boolean("recruiting").notNull().default(true),
    dissolved: boolean("dissolved").notNull().default(false),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("event_teams_id_event_unique").on(t.id, t.eventId),
    check(
      "event_teams_capacity_valid",
      sql`${t.capacity} >= 2 AND ${t.capacity} <= 20`,
    ),
    index("event_teams_event_idx").on(t.eventId),
  ],
);
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    displayName: text("display_name").notNull(),
    role: text("role").$type<RegistrationRole>().notNull(),
  },
  (t) => [
    unique("team_members_event_user_unique").on(t.eventId, t.userId),
    foreignKey({
      columns: [t.teamId, t.eventId],
      foreignColumns: [eventTeams.id, eventTeams.eventId],
    }),
    index("team_members_team_idx").on(t.teamId),
  ],
);
export const teamApplications = pgTable(
  "team_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull(),
    eventId: text("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    displayName: text("display_name").notNull(),
    role: text("role").$type<RegistrationRole>().notNull(),
    skills: text("skills").notNull(),
    message: text("message").notNull(),
    status: text("status")
      .$type<ApplicationState>()
      .notNull()
      .default("pending"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.teamId, t.eventId],
      foreignColumns: [eventTeams.id, eventTeams.eventId],
    }),
    uniqueIndex("team_applications_pending_unique")
      .on(t.eventId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("team_applications_event_idx").on(t.eventId),
  ],
);
