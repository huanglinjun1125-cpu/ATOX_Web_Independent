import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../auth/server";
import { getAdministrator } from "./service";
import type { AdminPermission } from "./contracts";
export {
  getAdministrator,
  listAdministrators,
  grantAdministrator,
  updateAdministrator,
  listAudit,
  authorizeAdmin,
  appendBusinessAudit,
} from "./service";
export { AdminError } from "./errors";
export async function requireAdminPage(
  next: string,
  permission: AdminPermission = "admin:access",
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent(next));
  const administrator = await getAdministrator(user);
  return administrator?.permissions.includes(permission) ? administrator : null;
}
