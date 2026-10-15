import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { resolveEvent } from "@/modules/event-participation/server";
import { getEventConfig } from "@/modules/event-board/server";
import { RegistrationForm } from "@/modules/event-participation/components/registration-form";
import "@/modules/event-participation/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { eventId } = await params;
  const candidate = (await searchParams).next;
  const prefix = `/events/${eventId}/teams`;
  const returnTo =
    typeof candidate === "string" &&
    (candidate === prefix || candidate.startsWith(prefix + "?")) &&
    !/[\\\u0000-\u0020]/.test(candidate)
      ? candidate
      : undefined;
  if (!(await getEventConfig(eventId))) notFound();
  const user = await getCurrentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent(
          `/events/${eventId}/register` +
            (returnTo ? "?next=" + encodeURIComponent(returnTo) : ""),
        ),
    );
  return (
    <RegistrationForm
      email={user.email}
      returnTo={returnTo}
      participation={await (await resolveEvent(eventId)).getParticipation(user)}
    />
  );
}
