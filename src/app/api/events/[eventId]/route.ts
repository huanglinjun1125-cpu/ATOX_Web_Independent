import { resolveEvent } from "@/modules/event-participation/server";
import {
  json,
  eventErrorResponse,
  type EventRouteContext,
} from "@/modules/event-participation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: EventRouteContext) {
  try {
    return json((await resolveEvent((await context.params).eventId)).config);
  } catch (error) {
    return eventErrorResponse(error);
  }
}
