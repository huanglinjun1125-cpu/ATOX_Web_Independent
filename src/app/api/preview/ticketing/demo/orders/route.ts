import {
  createOrder,
  listOrders,
  TicketingError,
} from "@/modules/ticketing/server";
import { json, readJson, withUser } from "@/modules/ticketing/http";
import type { CreateOrderInput } from "@/modules/ticketing/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withUser(request, false, async (user) => {
    const query = new URL(request.url).searchParams;
    const page = query.get("page") ?? "1";
    if (
      [...query.keys()].some((key) => key !== "page") ||
      query.getAll("page").length > 1 ||
      !/^\d+$/.test(page)
    )
      throw new TicketingError("INVALID_INPUT");
    return json(await listOrders(user, Number(page)));
  });
}
export async function POST(request: Request) {
  return withUser(request, true, async (user) =>
    json(await createOrder(user, await readJson<CreateOrderInput>(request))),
  );
}
