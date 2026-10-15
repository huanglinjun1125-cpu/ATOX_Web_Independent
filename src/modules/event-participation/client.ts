import { EVENT_API } from "./contracts";
export class EventApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function eventRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  apiBase: string = EVENT_API,
): Promise<T> {
  const response = await fetch(apiBase + path, {
    method,
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : body
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new EventApiError(data.error ?? "INTERNAL_ERROR", response.status);
  return data as T;
}

export function createEventRequest(eventId: string) {
  const apiBase = "/api/events/" + encodeURIComponent(eventId);
  return <T>(path: string, method = "GET", body?: unknown) =>
    eventRequest<T>(path, method, body, apiBase);
}
