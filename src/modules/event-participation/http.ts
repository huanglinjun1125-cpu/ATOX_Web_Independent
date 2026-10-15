import { NextResponse } from "next/server";
import { getCurrentUser } from "../auth/server";
import { assertOrigin } from "../auth/http";
import { AuthError } from "../auth/errors";
import { EventError } from "./errors";
import { AdminError } from "../admin/errors";
import { MaterialReviewError } from "../material-review/errors";
import type { AuthUser } from "../auth/contracts";
import type { AssetPurpose } from "./contracts";
import { forEvent } from "./service";
import { filesForEvent } from "./files";
import { resolveEvent, resolveFiles } from "./server";

export type EventRouteContext = {
  params: Promise<{ eventId: string; id?: string }>;
};
export async function withEventUser(
  request: Request,
  context: EventRouteContext,
  mutate: boolean,
  operation: (
    user: AuthUser,
    service: ReturnType<typeof forEvent>,
    files: ReturnType<typeof filesForEvent>,
    id: string | undefined,
  ) => Promise<Response>,
) {
  try {
    const { eventId, id } = await context.params;
    const service = await resolveEvent(eventId);
    const files = await resolveFiles(eventId);
    return withUser(request, mutate, (user) =>
      operation(user, service, files, id),
    );
  } catch (error) {
    return eventErrorResponse(error);
  }
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function eventErrorResponse(error: unknown) {
  if (
    error instanceof EventError ||
    error instanceof AdminError ||
    error instanceof MaterialReviewError
  )
    return json({ error: error.code }, error.status);
  if (error instanceof AuthError)
    return json(
      { error: error.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_ERROR" },
      error.status,
    );
  return json({ error: "INTERNAL_ERROR" }, 500);
}
export async function withUser(
  request: Request,
  mutate: boolean,
  operation: (user: AuthUser) => Promise<Response>,
): Promise<Response> {
  try {
    if (mutate) assertOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new EventError("UNAUTHORIZED");
    return await operation(user);
  } catch (error) {
    return eventErrorResponse(error);
  }
}
export async function limitedBody(
  request: Request,
  max: number,
  code: "INVALID_INPUT" | "INVALID_FILE" = "INVALID_INPUT",
): Promise<Buffer> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max))
    throw new EventError(code);
  if (!request.body) throw new EventError(code);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new EventError(code);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
export async function readJson<T>(request: Request): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new EventError("INVALID_INPUT");
  const buffer = await limitedBody(request, 64 * 1024);
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(buffer),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as T;
  } catch {
    throw new EventError("INVALID_INPUT");
  }
}
export async function readUpload(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;"))
    throw new EventError("INVALID_FILE");
  const body = await limitedBody(request, 21 * 1024 * 1024, "INVALID_FILE");
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(body), {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new EventError("INVALID_FILE");
  }
  const files = form.getAll("file");
  const purposes = form.getAll("purpose");
  if (
    files.length !== 1 ||
    purposes.length !== 1 ||
    typeof files[0] === "string" ||
    typeof purposes[0] !== "string" ||
    !["cover", "screenshot", "document"].includes(purposes[0])
  )
    throw new EventError("INVALID_FILE");
  // Reject additional file fields instead of silently ingesting another upload.
  for (const [key, value] of form)
    if (typeof value !== "string" && key !== "file")
      throw new EventError("INVALID_FILE");
  const file = files[0];
  return {
    purpose: purposes[0] as AssetPurpose,
    buffer: Buffer.from(await file.arrayBuffer()),
    originalName: file.name,
  };
}
