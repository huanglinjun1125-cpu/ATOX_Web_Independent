import {
  json,
  withEventUser,
  type EventRouteContext,
} from "@/modules/event-participation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: EventRouteContext) {
  return withEventUser(request, context, false, async (user, service) => {
    return json(await service.getMaterials(user));
  });
}
