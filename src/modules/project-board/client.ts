import type { ProjectBoardDto, ProjectFilters } from "./contracts";
import { projectQuery } from "./rules";
export async function fetchProjects(
  filters: ProjectFilters,
  signal?: AbortSignal,
): Promise<ProjectBoardDto> {
  if (process.env.NEXT_PUBLIC_SITE_PREVIEW === "true") {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { previewProjects } = await import("@/preview/catalog");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return previewProjects(filters);
  }
  const response = await fetch(`/api/projects${projectQuery(filters)}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("PROJECTS_UNAVAILABLE");
  return response.json();
}
