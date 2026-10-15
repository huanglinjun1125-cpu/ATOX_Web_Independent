import { eventRegistry } from "@/modules/event-board/config";
import { getEventStage, getEventYear } from "@/modules/event-board/rules";
import type { BoardDto } from "@/modules/event-board/contracts";
import { malaysiaCard } from "@/modules/event-experience/config";
import { projectRegistry } from "@/modules/project-board/config";
import { readProjectCatalog } from "@/modules/project-board/catalog";
import type { ProjectFilters } from "@/modules/project-board/contracts";
export function previewEvents(): BoardDto {
  const now = new Date();
  return {
    serverNow: now.toISOString(),
    events: [
      { ...malaysiaCard, stage: getEventStage(malaysiaCard, now) },
      ...eventRegistry.map((e) => ({
        ...e,
        recommended: false,
        stage: getEventStage(e, now),
        year: getEventYear(e),
      })),
    ],
  };
}
export function previewProjects(filters: ProjectFilters = {}) {
  return readProjectCatalog(projectRegistry, previewEvents().events, filters);
}
