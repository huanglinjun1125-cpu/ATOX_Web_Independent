import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { resolveEvent } from "@/modules/event-participation/server";
import { getEventConfig } from "@/modules/event-board/server";
import { ParticipantHub } from "@/modules/participant-center/components/hub";
import { resolveCenter } from "@/modules/participant-center/server";
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
  const participation = user ? await service.getParticipation(user) : null;
  return (
    <ParticipantHub
      signedIn={!!user}
      participation={participation}
      serverNow={participation?.serverNow ?? new Date().toISOString()}
      center={user ? await (await resolveCenter(eventId)).get(user) : null}
    />
  );
}
