import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth/server";
import { assertOrigin } from "../auth/http";
import { AuthError } from "../auth/errors";
import type { AuthUser } from "../auth/contracts";
import { AdminError } from "./errors";
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
  if (error instanceof AdminError || error instanceof AuthError)
    return json({ error: error.code }, error.status);
  return json({ error: "INTERNAL_ERROR" }, 500);
}
export async function withUser(
  request: Request,
  mutate: boolean,
  operation: (user: AuthUser) => Promise<Response>,
) {
  try {
    if (mutate) assertOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new AdminError("UNAUTHENTICATED");
    return await operation(user);
  } catch (error) {
    return errorResponse(error);
  }
}
export function readPage(request: Request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "page") ||
    params.getAll("page").length > 1
  )
    throw new AdminError("INVALID_INPUT");
  const value = params.get("page") ?? "1";
  if (!/^[1-9]\d{0,6}$/.test(value) || Number(value) > 1_000_000)
    throw new AdminError("INVALID_INPUT");
  return Number(value);
}
export async function readJson<T>(request: Request): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new AdminError("INVALID_INPUT");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536))
    throw new AdminError("INVALID_INPUT");
  if (!request.body) throw new AdminError("INVALID_INPUT");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new AdminError("INVALID_INPUT");
      }
      chunks.push(value);
    }
    try {
      const value: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      return value as T;
    } catch {
      throw new AdminError("INVALID_INPUT");
    }
  } finally {
    reader.releaseLock();
  }
}
