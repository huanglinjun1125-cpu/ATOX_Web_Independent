import {
  json,
  withEventUser,
  type EventRouteContext,
  readJson,
} from "@/modules/event-participation/http";
import type { DraftInput } from "@/modules/event-participation/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, context: EventRouteContext) {
  return withEventUser(request, context, true, async (user, service) => {
    return json(
      await service.saveDraft(user, await readJson<DraftInput>(request)),
    );
  });
}
