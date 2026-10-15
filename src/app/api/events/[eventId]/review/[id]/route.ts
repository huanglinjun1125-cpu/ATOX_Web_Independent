import {
  json,
  withEventUser,
  type EventRouteContext,
  readJson,
} from "@/modules/event-participation/http";
import type { ReviewInput } from "@/modules/event-participation/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: EventRouteContext) {
  return withEventUser(
    request,
    context,
    true,
    async (user, service, _files, id) => {
      return json(
        await service.reviewMaterials(
          user,
          id!,
          await readJson<ReviewInput>(request),
        ),
      );
    },
  );
}
