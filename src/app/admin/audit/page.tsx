import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { AuditView } from "@/modules/admin/components/audit";
export const dynamic = "force-dynamic";
export default async function AuditPage() {
  const identity = await requireAdminPage("/admin/audit", "admin:audit");
  return identity ? <AuditView identity={identity} /> : <AccessDenied />;
}
