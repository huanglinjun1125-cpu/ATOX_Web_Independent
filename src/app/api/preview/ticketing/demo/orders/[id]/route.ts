import { getOrder } from "@/modules/ticketing/server";
import { json, withUser } from "@/modules/ticketing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(request, false, async (user) =>
    json(await getOrder(user, (await context.params).id)),
  );
}
