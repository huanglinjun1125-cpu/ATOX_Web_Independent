import {
  json,
  withEventUser,
  type EventRouteContext,
  readJson,
} from "@/modules/event-participation/http";
import type { RegistrationInput } from "@/modules/event-participation/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: EventRouteContext) {
  return withEventUser(request, context, true, async (user, service) => {
    return json(
      await service.register(user, await readJson<RegistrationInput>(request)),
    );
  });
}
