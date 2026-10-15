import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth/server";
import { assertOrigin } from "../auth/http";
import { AuthError } from "../auth/errors";
import type { AuthUser } from "../auth/contracts";
import { requireTicketing } from "./service";
import { TicketingError } from "./errors";

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof TicketingError)
    return json(
      {
        error: error.code,
        ...(error.orderId ? { orderId: error.orderId } : {}),
        ...(error.quote ? { quote: error.quote } : {}),
      },
      error.status,
    );
  if (error instanceof AuthError)
    return json({ error: error.code }, error.status);
  return json({ error: "INTERNAL_ERROR" }, 500);
}
export async function withPreview(operation: () => Promise<Response>) {
  try {
    requireTicketing();
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}
export async function withUser(
  request: Request,
  mutate: boolean,
  operation: (user: AuthUser) => Promise<Response>,
) {
  return withPreview(async () => {
    if (mutate) assertOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new TicketingError("UNAUTHORIZED", 401);
    return operation(user);
  });
}
export async function readRawJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new TicketingError("INVALID_INPUT");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536))
    throw new TicketingError("INVALID_INPUT");
  if (!request.body) throw new TicketingError("INVALID_INPUT");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        throw new TicketingError("INVALID_INPUT");
      }
      chunks.push(value);
    }
    try {
      const raw = new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks),
      );
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return raw;
    } catch {
      throw new TicketingError("INVALID_INPUT");
    }
  } finally {
    reader.releaseLock();
  }
}
export async function readJson<T>(request: Request): Promise<T> {
  return JSON.parse(await readRawJson(request)) as T;
}
