import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { resolveEvent } from "@/modules/event-participation/server";
import { getEventConfig } from "@/modules/event-board/server";
import { MaterialsEditor } from "@/modules/event-participation/components/materials-editor";
import "@/modules/event-participation/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!(await getEventConfig(eventId))) notFound();
  const service = await resolveEvent(eventId);
  const user = await getCurrentUser();
  if (!user)
    redirect(
      "/login?next=" + encodeURIComponent(`/events/${eventId}/materials`),
    );
  const [initial, participation] = await Promise.all([
    service.getMaterials(user),
    service.getParticipation(user),
  ]);
  return <MaterialsEditor initial={initial} participation={participation} />;
}
