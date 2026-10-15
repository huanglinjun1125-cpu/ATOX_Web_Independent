import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { ContentEditor } from "@/modules/content-management/components/editor";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const identity = await requireAdminPage(
    "/admin/events/" + encodeURIComponent(eventId),
    "admin:content",
  );
  return identity ? (
    <ContentEditor key={eventId} identity={identity} eventId={eventId} />
  ) : (
    <AccessDenied />
  );
}
