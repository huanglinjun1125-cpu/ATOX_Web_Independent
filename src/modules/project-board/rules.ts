import type { ProjectBoardDto, ProjectCard, ProjectFilters } from "./contracts";

export const PAGE_SIZE = 9;
export function normalizeFilters(
  filters: ProjectFilters = {},
): Required<ProjectFilters> {
  const raw = filters.page ?? "1";
  const number = /^\d+$/.test(raw) ? Number(raw) : 1;
  return {
    q: (filters.q ?? "").trim(),
    category: filters.category === "all" ? "" : (filters.category ?? ""),
    event: filters.event === "all" ? "" : (filters.event ?? ""),
    page: Number.isSafeInteger(number) && number > 0 ? String(number) : "1",
  };
}
export function parseFilters(query: URLSearchParams): Required<ProjectFilters> {
  return normalizeFilters(
    Object.fromEntries(
      ["q", "category", "event", "page"].map((key) => [
        key,
        query.get(key) ?? undefined,
      ]),
    ),
  );
}
export function projectQuery(filters: ProjectFilters): string {
  const normalized = normalizeFilters(filters);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    if (value && !(key === "page" && value === "1")) query.set(key, value);
  }
  return query.size ? `?${query}` : "";
}
export function queryProjects(
  projects: ProjectCard[],
  options: ProjectBoardDto["options"],
  input: ProjectFilters = {},
): ProjectBoardDto {
  const filters = normalizeFilters(input);
  const q = filters.q.toLowerCase();
  const matched = projects
    .filter((project) => {
      const words = [
        project.name,
        project.introduction,
        project.creator,
        ...project.tags,
      ];
      return (
        (!q ||
          words.some((value) =>
            `${value.zh}\n${value.en}`.toLowerCase().includes(q),
          )) &&
        (!filters.category || project.category === filters.category) &&
        (!filters.event ||
          (filters.event === "independent"
            ? project.eventId === null
            : project.eventId === filters.event))
      );
    })
    .sort(
      (a, b) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
        a.id.localeCompare(b.id),
    );
  const page = Number(filters.page);
  return {
    projects: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: matched.length,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(matched.length / PAGE_SIZE),
    filters,
    options,
  };
}
