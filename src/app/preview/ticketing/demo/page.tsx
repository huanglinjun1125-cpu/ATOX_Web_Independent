import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { isTicketingEnabled } from "@/modules/ticketing/policy";
import { getCatalog } from "@/modules/ticketing/server";
import { TicketPicker } from "@/modules/ticketing/components/ticket-picker";
import "@/modules/ticketing/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isTicketingEnabled()) notFound();
  const query = await searchParams;
  const user = await getCurrentUser();
  return (
    <TicketPicker
      catalog={await getCatalog()}
      userId={user?.id ?? null}
      email={user?.email ?? null}
      query={{
        ticketId:
          typeof query.ticketId === "string" ? query.ticketId : undefined,
        quantity:
          typeof query.quantity === "string" ? query.quantity : undefined,
      }}
    />
  );
}
