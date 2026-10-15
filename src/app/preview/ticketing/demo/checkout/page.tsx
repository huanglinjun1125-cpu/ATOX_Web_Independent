import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { isTicketingEnabled } from "@/modules/ticketing/policy";
import { getCatalog } from "@/modules/ticketing/server";
import { TICKETING_PAGE } from "@/modules/ticketing/contracts";
import { TicketCheckout } from "@/modules/ticketing/components/ticket-checkout";
import "@/modules/ticketing/styles.css";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isTicketingEnabled()) notFound();
  const query = await searchParams;
  const safe = new URLSearchParams();
  for (const key of ["ticketId", "quantity", "orderId"])
    if (typeof query[key] === "string") safe.set(key, query[key]);
  const user = await getCurrentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent(
          TICKETING_PAGE + "/checkout" + (safe.size ? "?" + safe : ""),
        ),
    );
  const catalog = await getCatalog();
  const ticketId =
    safe.get("ticketId") ??
    catalog.tickets.find((ticket) => ticket.state === "on_sale")?.id ??
    "";
  const quantity = Math.max(
    1,
    Math.min(catalog.maxPerAccount, Number(safe.get("quantity")) || 1),
  );
  return (
    <TicketCheckout
      catalog={catalog}
      user={{ id: user.id, email: user.email }}
      selection={{ ticketId, quantity }}
      orderId={safe.get("orderId") ?? undefined}
    />
  );
}
