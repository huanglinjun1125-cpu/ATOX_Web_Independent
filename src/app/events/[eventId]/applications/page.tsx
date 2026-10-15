import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { getEventConfig } from "@/modules/event-board/server";
import { resolveCenter } from "@/modules/participant-center/server";
import { TeamView } from "@/modules/participant-center/components/team-view";
import "@/modules/event-participation/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { eventId } = await params;
  if (!(await getEventConfig(eventId))) notFound();
  const user = await getCurrentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent("/events/" + eventId + "/applications"),
    );
  const center = await resolveCenter(eventId);
  const [initial, list] = await Promise.all([
    user ? center.get(user) : Promise.resolve(null),
    center.list(),
  ]);
  return (
    <TeamView
      mode="applications"
      signedIn={!!user}
      initial={initial}
      initialTeams={list.teams}
      intent={(await searchParams).intent}
    />
  );
}
