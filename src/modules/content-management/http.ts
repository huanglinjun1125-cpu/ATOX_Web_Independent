import { withUser, json, readJson } from "../admin/http";
import { ContentError } from "./rules";
import {
  changeContent,
  createManagedEvent,
  getManagedContent,
  listManagedEvents,
} from "./service";
import type { ContentCommand, ContentKind } from "./contracts";
export function contentRoute(
  request: Request,
  kind: ContentKind,
  id: string,
  mutate = false,
) {
  return withUser(request, mutate, async (user) => {
    try {
      if (mutate) {
        const input = await readJson<ContentCommand>(request);
        if (
          request.method === "PUT"
            ? input.action !== "save"
            : !["publish", "withdraw"].includes(input.action)
        )
          throw new ContentError("INVALID_INPUT");
        const result = await changeContent(user, kind, id, input);
        const { history } = await getManagedContent(user, kind, id);
        return json({ ...result, history });
      }
      return json(await getManagedContent(user, kind, id));
    } catch (error) {
      if (error instanceof ContentError)
        return json({ error: error.code }, error.status);
      throw error;
    }
  });
}
export function eventListRoute(request: Request) {
  return withUser(request, request.method !== "GET", async (user) => {
    try {
      return json(
        request.method === "GET"
          ? await listManagedEvents(user)
          : await createManagedEvent(
              user,
              (await readJson<{ id: string }>(request)).id,
            ),
      );
    } catch (error) {
      if (error instanceof ContentError)
        return json({ error: error.code }, error.status);
      throw error;
    }
  });
}
