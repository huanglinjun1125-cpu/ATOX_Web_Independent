import { notFound } from "next/navigation";
import { getEventConfig } from "@/modules/event-board/server";
import { EventProvider } from "@/modules/event-participation/components/shared";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const config = await getEventConfig((await params).eventId);
  if (!config) notFound();
  return (
    <EventProvider key={config.id} config={config}>
      {children}
    </EventProvider>
  );
}
