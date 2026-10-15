import { notFound } from "next/navigation";
import { requireAdminPage } from "@/modules/admin/server";
import { AccessDenied } from "@/modules/admin/components/shared";
import { getCurrentUser } from "@/modules/auth/server";
import { getManagedContent } from "@/modules/content-management/server";
import type { EventDefinition } from "@/modules/event-board/contracts";
import { PreviewBanner } from "@/modules/content-management/components/preview-banner";
import { EventPreview } from "@/modules/content-management/components/event-preview";
import { ContentError } from "@/modules/content-management/rules";
import "@/modules/event-participation/styles.css";
import "@/modules/content-management/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const identity = await requireAdminPage(
    `/admin/events/${eventId}/preview`,
    "admin:content",
  );
  if (!identity) return <AccessDenied />;
  let content;
  try {
    ({ content } = await getManagedContent(
      (await getCurrentUser())!,
      "event",
      eventId,
    ));
  } catch (error) {
    if (error instanceof ContentError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <PreviewBanner back={`/admin/events/${eventId}`} />
      <EventPreview event={content.draft as EventDefinition} />
    </>
  );
}
