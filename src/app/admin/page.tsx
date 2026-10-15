import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied, Dashboard } from "@/modules/admin/components/shared";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const identity = await requireAdminPage("/admin");
  return identity ? <Dashboard identity={identity} /> : <AccessDenied />;
}
