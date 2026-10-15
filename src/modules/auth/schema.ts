import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const date = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: date("created_at").notNull().defaultNow(),
});

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: date("created_at").notNull().defaultNow(),
    expiresAt: date("expires_at").notNull(),
    consumedAt: date("consumed_at"),
  },
  (table) => [
    index("challenges_email_created_at_idx").on(table.email, table.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: date("created_at").notNull().defaultNow(),
    expiresAt: date("expires_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const sendEvents = pgTable(
  "send_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("send_events_email_created_at_idx").on(table.email, table.createdAt),
    index("send_events_ip_created_at_idx").on(table.ip, table.createdAt),
  ],
);

export const devMails = pgTable(
  "dev_mails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    language: text("language").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    createdAt: date("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("dev_mails_email_created_at_idx").on(table.email, table.createdAt),
  ],
);
