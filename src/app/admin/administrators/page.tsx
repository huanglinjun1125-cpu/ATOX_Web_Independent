import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { AdministratorsView } from "@/modules/admin/components/administrators";
export const dynamic = "force-dynamic";
export default async function AdministratorsPage() {
  const identity = await requireAdminPage(
    "/admin/administrators",
    "admin:manage",
  );
  return identity ? (
    <AdministratorsView identity={identity} />
  ) : (
    <AccessDenied />
  );
}
