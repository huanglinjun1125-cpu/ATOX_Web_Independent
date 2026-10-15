import "server-only";
import { buildCenter } from "./service";
import { readPublishedEvent } from "../content-management/store";
import { CenterError } from "./errors";
export async function resolveCenter(eventId: string) {
  const config = await readPublishedEvent(eventId);
  if (!config) throw new CenterError("NOT_FOUND", 404);
  return buildCenter(config, (db) => readPublishedEvent(eventId, db));
}
export { forCenter } from "./service";
