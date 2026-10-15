import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { AuthError } from "./errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    const response = json(
      {
        error: error.code,
        ...(error.retryAfter !== undefined
          ? { retryAfter: error.retryAfter }
          : {}),
      },
      error.status,
    );
    if (error.retryAfter !== undefined)
      response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  return json({ error: "INTERNAL_ERROR" }, 500);
}
export function assertOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN || "http://localhost:3000";
  let expected: string;
  try {
    expected = new URL(configured).origin;
  } catch {
    throw new AuthError("INTERNAL_ERROR", 500);
  }
  if (request.headers.get("origin") !== expected)
    throw new AuthError("FORBIDDEN", 403);
}
export function requestIp(request: Request) {
  if (process.env.TRUST_PROXY !== "true") return "local";
  const candidate = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return candidate && isIP(candidate) ? candidate : "local";
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new AuthError("INVALID_REQUEST");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4096))
    throw new AuthError("INVALID_REQUEST");
  if (!request.body) throw new AuthError("INVALID_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    length += result.value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw new AuthError("INVALID_REQUEST");
    }
    chunks.push(result.value);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AuthError("INVALID_REQUEST");
  }
}
