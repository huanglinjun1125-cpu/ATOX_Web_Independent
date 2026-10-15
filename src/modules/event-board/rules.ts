import type {
  BoardCardDto,
  BoardFilters,
  EventDefinition,
  EventStage,
  RegistrationState,
} from "./contracts";

export function getEventStage(
  event: Pick<EventDefinition, "startsAt" | "endsAt">,
  now = new Date(),
): EventStage {
  if (now.getTime() < Date.parse(event.startsAt)) return "upcoming";
  if (now.getTime() >= Date.parse(event.endsAt)) return "ended";
  return "ongoing";
}
export function getRegistrationState(
  event: EventDefinition,
  now = new Date(),
): RegistrationState {
  if (now.getTime() < Date.parse(event.registrationOpensAt)) return "not_open";
  if (now.getTime() >= Date.parse(event.registrationClosesAt)) return "closed";
  return "open";
}
export function getEventYear(
  event: Pick<EventDefinition, "startsAt" | "timeZone">,
) {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: event.timeZone,
    }).format(new Date(event.startsAt)),
  );
}
export function filterBoardEvents(
  events: BoardCardDto[],
  filters: BoardFilters = {},
) {
  const q = (filters.q ?? "").trim().toLocaleLowerCase();
  return events
    .filter(
      (event) =>
        (!q ||
          [event.name.zh, event.name.en, event.theme.zh, event.theme.en].some(
            (value) => value.toLocaleLowerCase().includes(q),
          )) &&
        (!filters.year ||
          filters.year === "all" ||
          String(event.year) === filters.year) &&
        (!filters.stage ||
          filters.stage === "all" ||
          event.stage === filters.stage),
    )
    .sort((a, b) => {
      const rank = { ongoing: 0, upcoming: 1, ended: 2 };
      if (rank[a.stage] !== rank[b.stage]) return rank[a.stage] - rank[b.stage];
      const difference =
        a.stage === "ongoing"
          ? Date.parse(a.endsAt) - Date.parse(b.endsAt)
          : a.stage === "upcoming"
            ? Date.parse(a.startsAt) - Date.parse(b.startsAt)
            : Date.parse(b.endsAt) - Date.parse(a.endsAt);
      return difference || a.id.localeCompare(b.id);
    });
}
export function isDefaultBoardFilter(filters: BoardFilters = {}) {
  return (
    !(filters.q ?? "").trim() &&
    (!filters.year || filters.year === "all") &&
    (!filters.stage || filters.stage === "all")
  );
}
export function recommendedEvent(
  events: BoardCardDto[],
  filters: BoardFilters = {},
) {
  if (!isDefaultBoardFilter(filters)) return null;
  return (
    events.find(
      (event) =>
        event.recommended && event.target !== null && event.stage !== "ended",
    ) ?? null
  );
}
