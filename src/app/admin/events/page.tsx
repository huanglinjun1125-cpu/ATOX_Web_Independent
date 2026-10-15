import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { ContentEventList } from "@/modules/content-management/components/list";
export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await requireAdminPage("/admin/events", "admin:content");
  return identity ? <ContentEventList identity={identity} /> : <AccessDenied />;
}
