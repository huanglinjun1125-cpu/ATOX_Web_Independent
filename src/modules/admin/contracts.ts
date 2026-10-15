/** Browser-safe contracts. Roles are owned by M008, never by auth cookies. */
export type AdminRole = "super_admin" | "operator";
export type AdminPermission =
  | "admin:access"
  | "admin:manage"
  | "admin:audit"
  | "admin:materials"
  | "admin:content";
export interface AdminIdentity {
  userId: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
}
export interface AdminActor {
  source: "web" | "bootstrap";
  userId: string | null;
  label: string;
}
export interface AdministratorDto {
  userId: string;
  email: string;
  role: AdminRole;
  enabled: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: AdminActor;
}
export interface AdminSnapshot {
  email: string;
  role: AdminRole;
  enabled: boolean;
  revision: number;
}
export interface AdminAuditDto {
  id: string;
  action: "bootstrap" | "grant" | "update";
  actor: AdminActor;
  targetUserId: string;
  targetEmail: string;
  before: AdminSnapshot | null;
  after: AdminSnapshot;
  createdAt: string;
}
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface GrantAdministratorInput {
  email: string;
  role: AdminRole;
}
export interface UpdateAdministratorInput {
  role: AdminRole;
  enabled: boolean;
  revision: number;
}
export type AdminErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "USER_NOT_FOUND"
  | "ADMIN_NOT_FOUND"
  | "ALREADY_ADMINISTRATOR"
  | "REVISION_CONFLICT"
  | "LAST_SUPER_ADMIN"
  | "SELF_CHANGE_FORBIDDEN"
  | "ALREADY_INITIALIZED"
  | "INTERNAL_ERROR";
export const ADMIN_API = "/api/admin";
export const ADMIN_PAGE_SIZE = 20;
