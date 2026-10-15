import { TICKETING_API } from "./contracts";
export class TicketError extends Error {
  constructor(
    public code: string,
    public status: number,
    public data: unknown,
  ) {
    super(code);
  }
}
export async function ticketRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(TICKETING_API + path, {
    method,
    cache: "no-store",
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok)
    throw new TicketError(data.error ?? "INTERNAL_ERROR", r.status, data);
  return data as T;
}
