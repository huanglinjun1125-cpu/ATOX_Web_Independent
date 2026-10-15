import "server-only";
import { buildEventService } from "./service";
import { buildFiles } from "./files";
import { readPublishedEvent } from "../content-management/store";
import { EventError } from "./errors";
export async function resolveEvent(eventId: string) {
  const config = await readPublishedEvent(eventId);
  if (!config) throw new EventError("NOT_FOUND");
  return buildEventService(config, (db) => readPublishedEvent(eventId, db));
}
export async function resolveFiles(eventId: string) {
  const config = await readPublishedEvent(eventId);
  if (!config) throw new EventError("NOT_FOUND");
  return buildFiles(config, (db) => readPublishedEvent(eventId, db));
}
export {
  getParticipation,
  register,
  getMaterials,
  saveDraft,
  submitMaterials,
  listReviews,
  reviewMaterials,
  isReviewer,
  forEvent,
  buildEventService,
} from "./service";
export {
  uploadAsset,
  readAsset,
  cleanupOrphanFiles,
  filesForEvent,
  buildFiles,
} from "./files";
export { EventError } from "./errors";
