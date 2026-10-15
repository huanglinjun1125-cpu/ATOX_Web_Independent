import { closeOrder } from "@/modules/ticketing/server";
import { json, withUser } from "@/modules/ticketing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(request, true, async (user) =>
    json(await closeOrder(user, (await context.params).id)),
  );
}
