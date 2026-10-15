import { ADMIN_API } from "./contracts";

export class AdminApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export async function adminRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(ADMIN_API + path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new AdminApiError(data.error ?? "INTERNAL_ERROR", response.status);
  return data as T;
}
