import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, serializeDatabaseWrite } from "@/lib/db";
import type { AuthUser } from "../auth/contracts";
import { findRegisteredUserByEmail } from "../auth/service";
import { administrators, adminAuditLogs, businessAuditLogs } from "./schema";
import { AdminError } from "./errors";
import { ADMIN_PAGE_SIZE } from "./contracts";
import type {
  AdminActor,
  AdminAuditDto,
  AdminIdentity,
  AdminPage,
  AdminPermission,
  AdminRole,
  AdminSnapshot,
  AdministratorDto,
  GrantAdministratorInput,
  UpdateAdministratorInput,
} from "./contracts";
type Db = Awaited<ReturnType<typeof getDb>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Reader = Db | Tx;
type Account = typeof administrators.$inferSelect;
const permissions = (role: AdminRole): AdminPermission[] =>
  role === "super_admin"
    ? [
        "admin:access",
        "admin:manage",
        "admin:audit",
        "admin:materials",
        "admin:content",
      ]
    : ["admin:access", "admin:materials", "admin:content"];
const dto = (value: Account): AdministratorDto => ({
  ...value,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
});
const snapshot = (value: Account): AdminSnapshot => ({
  email: value.email,
  role: value.role,
  enabled: value.enabled,
  revision: value.revision,
});
const actor = (user: AuthUser): AdminActor => ({
  source: "web",
  userId: user.id,
  label: user.email,
});
function inputObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new AdminError("INVALID_INPUT");
  return value as Record<string, unknown>;
}
function role(value: unknown): AdminRole {
  if (value !== "super_admin" && value !== "operator")
    throw new AdminError("INVALID_INPUT");
  return value;
}
function email(value: unknown): string {
  if (typeof value !== "string" || value.length > 254)
    throw new AdminError("INVALID_INPUT");
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    throw new AdminError("INVALID_INPUT");
  return normalized;
}
function pageNumber(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 1 ||
    (value as number) > 1_000_000
  )
    throw new AdminError("INVALID_INPUT");
  return value as number;
}
function userId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw new AdminError("INVALID_INPUT");
  return value;
}
async function account(db: Reader, id: string) {
  const [value] = await db
    .select()
    .from(administrators)
    .where(eq(administrators.userId, id))
    .limit(1);
  return value ?? null;
}
export async function authorizeAdmin(
  db: Reader,
  user: AuthUser,
  permission: AdminPermission,
) {
  const current = await account(db, user.id);
  if (!current?.enabled || !permissions(current.role).includes(permission))
    throw new AdminError("FORBIDDEN");
  return current;
}
const authorized = authorizeAdmin;
export async function appendBusinessAudit(
  tx: Tx,
  input: {
    actor: AuthUser;
    action: string;
    resourceType: string;
    resourceId: string;
    eventId?: string | null;
    before: unknown;
    after: unknown;
  },
) {
  await tx
    .insert(businessAuditLogs)
    .values({
      id: randomUUID(),
      actor: actor(input.actor),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      eventId: input.eventId ?? null,
      before: input.before,
      after: input.after,
      createdAt: new Date(),
    });
}
export async function getAdministrator(
  user: AuthUser,
): Promise<AdminIdentity | null> {
  const current = await account(await getDb(), user.id);
  return current?.enabled
    ? {
        userId: current.userId,
        email: current.email,
        role: current.role,
        permissions: permissions(current.role),
      }
    : null;
}
export async function listAdministrators(
  user: AuthUser,
  page = 1,
): Promise<AdminPage<AdministratorDto>> {
  page = pageNumber(page);
  const db = await getDb();
  await authorized(db, user, "admin:manage");
  const [{ total }] = await db.select({ total: count() }).from(administrators);
  const items = await db
    .select()
    .from(administrators)
    .orderBy(desc(administrators.createdAt), administrators.userId)
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return {
    items: items.map(dto),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages: Math.ceil(total / ADMIN_PAGE_SIZE),
  };
}
async function audit(
  tx: Tx,
  action: "bootstrap" | "grant" | "update",
  who: AdminActor,
  before: Account | null,
  after: Account,
) {
  await tx.insert(adminAuditLogs).values({
    id: randomUUID(),
    action,
    actor: who,
    targetUserId: after.userId,
    targetEmail: after.email,
    before: before ? snapshot(before) : null,
    after: snapshot(after),
    createdAt: new Date(),
  });
}
export async function grantAdministrator(
  user: AuthUser,
  value: GrantAdministratorInput,
): Promise<AdministratorDto> {
  const input = inputObject(value, ["email", "role"]);
  const targetEmail = email(input.email),
    targetRole = role(input.role);
  const target = await findRegisteredUserByEmail(targetEmail);
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      await authorized(tx, user, "admin:manage");
      if (!target) throw new AdminError("USER_NOT_FOUND");
      if (await account(tx, target.id))
        throw new AdminError("ALREADY_ADMINISTRATOR");
      const who = actor(user),
        now = new Date();
      const [created] = await tx
        .insert(administrators)
        .values({
          userId: target.id,
          email: target.email,
          role: targetRole,
          enabled: true,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          updatedBy: who,
        })
        .returning();
      await audit(tx, "grant", who, null, created);
      return dto(created);
    }),
  );
}
export async function updateAdministrator(
  user: AuthUser,
  id: string,
  value: UpdateAdministratorInput,
): Promise<AdministratorDto> {
  id = userId(id);
  const input = inputObject(value, ["role", "enabled", "revision"]);
  const targetRole = role(input.role);
  if (
    typeof input.enabled !== "boolean" ||
    !Number.isSafeInteger(input.revision) ||
    (input.revision as number) < 1
  )
    throw new AdminError("INVALID_INPUT");
  const enabled = input.enabled,
    revision = input.revision;
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      await authorized(tx, user, "admin:manage");
      const previous = await account(tx, id);
      if (!previous) throw new AdminError("ADMIN_NOT_FOUND");
      if (previous.revision !== revision)
        throw new AdminError("REVISION_CONFLICT");
      if (id === user.id && (!enabled || targetRole !== previous.role))
        throw new AdminError("SELF_CHANGE_FORBIDDEN");
      if (
        previous.enabled &&
        previous.role === "super_admin" &&
        (!enabled || targetRole !== "super_admin")
      ) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(administrators)
          .where(
            and(
              eq(administrators.enabled, true),
              eq(administrators.role, "super_admin"),
            ),
          );
        if (total <= 1) throw new AdminError("LAST_SUPER_ADMIN");
      }
      if (previous.enabled === enabled && previous.role === targetRole)
        return dto(previous);
      const who = actor(user);
      const [updated] = await tx
        .update(administrators)
        .set({
          role: targetRole,
          enabled,
          revision: previous.revision + 1,
          updatedAt: new Date(),
          updatedBy: who,
        })
        .where(eq(administrators.userId, id))
        .returning();
      await audit(tx, "update", who, previous, updated);
      return dto(updated);
    }),
  );
}
export async function listAudit(
  user: AuthUser,
  page = 1,
): Promise<AdminPage<AdminAuditDto>> {
  page = pageNumber(page);
  const db = await getDb();
  await authorized(db, user, "admin:audit");
  const [{ total }] = await db.select({ total: count() }).from(adminAuditLogs);
  const rows = await db
    .select()
    .from(adminAuditLogs)
    .orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset((page - 1) * ADMIN_PAGE_SIZE);
  return {
    items: rows.map((value) => ({
      ...value,
      createdAt: value.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages: Math.ceil(total / ADMIN_PAGE_SIZE),
  };
}
export async function bootstrapAdministrator(
  value: string,
  operatorLabel: string,
): Promise<AdministratorDto> {
  const targetEmail = email(value);
  if (
    typeof operatorLabel !== "string" ||
    !operatorLabel.trim() ||
    operatorLabel.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(operatorLabel)
  )
    throw new AdminError("INVALID_INPUT");
  const target = await findRegisteredUserByEmail(targetEmail);
  return serializeDatabaseWrite(async () =>
    (await getDb()).transaction(async (tx) => {
      const [bootstrap] = await tx
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.action, "bootstrap"))
        .limit(1);
      if (bootstrap) {
        if (bootstrap.targetEmail !== targetEmail)
          throw new AdminError("ALREADY_INITIALIZED");
        const existing = await account(tx, bootstrap.targetUserId);
        if (!existing) throw new AdminError("ALREADY_INITIALIZED");
        return dto(existing);
      }
      const [{ total }] = await tx
        .select({ total: count() })
        .from(administrators);
      if (total !== 0) throw new AdminError("ALREADY_INITIALIZED");
      if (!target) throw new AdminError("USER_NOT_FOUND");
      const who: AdminActor = {
        source: "bootstrap",
        userId: null,
        label: operatorLabel.trim(),
      };
      const now = new Date();
      const [created] = await tx
        .insert(administrators)
        .values({
          userId: target.id,
          email: target.email,
          role: "super_admin",
          enabled: true,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          updatedBy: who,
        })
        .returning();
      await audit(tx, "bootstrap", who, null, created);
      return dto(created);
    }),
  );
}
