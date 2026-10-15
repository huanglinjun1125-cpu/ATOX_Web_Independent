import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server";
import { isTicketingEnabled } from "@/modules/ticketing/policy";
import { TicketOrders } from "@/modules/ticketing/components/ticket-orders";
import { TICKETING_PAGE } from "@/modules/ticketing/contracts";
import "@/modules/ticketing/styles.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "我的订单 · 模拟购票 | HACKATHON" };
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isTicketingEnabled()) notFound();
  const query = await searchParams;
  const raw =
    typeof query.page === "string" && /^\d+$/.test(query.page)
      ? Number(query.page)
      : 1;
  const page =
    Number.isSafeInteger(raw) &&
    raw > 0 &&
    raw <= Math.floor(Number.MAX_SAFE_INTEGER / 10)
      ? raw
      : 1;
  const user = await getCurrentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent(
          TICKETING_PAGE + "/orders" + (page > 1 ? `?page=${page}` : ""),
        ),
    );
  return <TicketOrders key={`${user.id}:${page}`} page={page} />;
}
