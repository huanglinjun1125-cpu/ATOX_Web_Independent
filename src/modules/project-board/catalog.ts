import type { BoardCardDto } from "../event-board/contracts";
import { categories, type ProjectDefinition } from "./config";
import type { ProjectCard, ProjectFilters } from "./contracts";
import { queryProjects } from "./rules";

/** Explicit allowlist: submission/private fields never become public by spreading. */
export function readProjectCatalog(
  registry: ProjectDefinition[],
  events: BoardCardDto[],
  filters: ProjectFilters = {},
) {
  const projects: ProjectCard[] = registry
    .filter(
      (p) =>
        p.published &&
        (p.eventId === null || events.some((event) => event.id === p.eventId)),
    )
    .map((p) => {
      const event = events.find((event) => event.id === p.eventId);
      return {
        id: p.id,
        name: p.name,
        introduction: p.introduction,
        cover: p.cover,
        category: p.category,
        tags: p.tags,
        creator: p.creator,
        eventId: p.eventId,
        event: event
          ? {
              id: event.id,
              name: event.name,
              href: `/events/${encodeURIComponent(event.id)}`,
            }
          : null,
        publishedAt: p.publishedAt,
        demo: p.demo,
      };
    });
  return queryProjects(
    projects,
    {
      categories,
      events: events
        .filter((e) => projects.some((p) => p.eventId === e.id))
        .map((e) => ({ id: e.id, name: e.name })),
    },
    filters,
  );
}
