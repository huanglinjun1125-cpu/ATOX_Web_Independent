import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { getCurrentUser } from "@/modules/auth/server";
import { getManagedContent } from "@/modules/content-management/server";
import type { HomepageContent } from "@/modules/content-management/contracts";
import { HomeView } from "@/modules/homepage/components/home-view";
import { PreviewBanner } from "@/modules/content-management/components/preview-banner";
import "@/modules/homepage/styles.css";
import "@/modules/content-management/styles.css";
export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await requireAdminPage(
    "/admin/content/homepage/preview",
    "admin:content",
  );
  if (!identity) return <AccessDenied />;
  const { content } = await getManagedContent(
    (await getCurrentUser())!,
    "homepage",
    "homepage",
  );
  return (
    <>
      <PreviewBanner back="/admin/content/homepage" />
      <HomeView
        signedIn
        year={new Date().getFullYear()}
        content={content.draft as HomepageContent}
      />
    </>
  );
}
