import { eventRequest } from "../event-participation/client";
import type { CenterDto, TeamCard, TeamCommand } from "./contracts";
export const centerRequest = (eventId: string) => ({
  list: () =>
    eventRequest<{ teams: TeamCard[] }>(
      "/teams",
      "GET",
      undefined,
      "/api/events/" + encodeURIComponent(eventId),
    ),
  me: () =>
    eventRequest<CenterDto>(
      "/center",
      "GET",
      undefined,
      "/api/events/" + encodeURIComponent(eventId),
    ),
  command: (body: TeamCommand) =>
    eventRequest<CenterDto>(
      "/center",
      "POST",
      body,
      "/api/events/" + encodeURIComponent(eventId),
    ),
});
