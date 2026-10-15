import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { ContentEditor } from "@/modules/content-management/components/editor";
export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await requireAdminPage(
    "/admin/content/homepage",
    "admin:content",
  );
  return identity ? <ContentEditor identity={identity} /> : <AccessDenied />;
}
