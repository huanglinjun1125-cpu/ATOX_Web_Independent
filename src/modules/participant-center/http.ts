import { getCurrentUser } from "../auth/server";
import { assertOrigin } from "../auth/http";
import {
  json,
  eventErrorResponse,
  readJson,
} from "../event-participation/http";
import { resolveCenter } from "./server";
import { CenterError } from "./errors";
export async function centerRoute(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
  kind: "list" | "get" | "command",
) {
  try {
    const { eventId } = await context.params;
    const center = await resolveCenter(eventId);
    if (kind === "list") return json(await center.list());
    if (kind === "command") assertOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new CenterError("UNAUTHORIZED", 401);
    return json(
      kind === "get"
        ? await center.get(user)
        : await center.execute(user, await readJson(request)),
    );
  } catch (error) {
    if (error instanceof CenterError)
      return json({ error: error.code }, error.status);
    return eventErrorResponse(error);
  }
}
