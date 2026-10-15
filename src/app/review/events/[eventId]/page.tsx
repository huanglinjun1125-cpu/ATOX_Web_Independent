import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { resolveEvent } from "@/modules/event-participation/server";
import { ReviewDashboard } from "@/modules/event-participation/components/review-dashboard";
import { EventProvider } from "@/modules/event-participation/components/shared";
import "@/modules/event-participation/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  let service: Awaited<ReturnType<typeof resolveEvent>>;
  try {
    service = await resolveEvent(eventId);
  } catch {
    notFound();
  }
  const user = await getCurrentUser();
  if (!user)
    redirect("/login?next=" + encodeURIComponent(`/review/events/${eventId}`));
  if (!(await service.isReviewer(user))) notFound();
  return (
    <EventProvider config={service.config}>
      <ReviewDashboard initial={await service.listReviews(user)} />
    </EventProvider>
  );
}
