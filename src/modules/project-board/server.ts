import "server-only";
import { getBoard } from "../event-board/server";
import { projectRegistry } from "./config";
import { readProjectCatalog } from "./catalog";
import type { ProjectFilters } from "./contracts";

export async function getProjects(filters: ProjectFilters = {}) {
  const events = await getBoard();
  return readProjectCatalog(projectRegistry, events.events, filters);
}
