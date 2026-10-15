import { getMaterial } from "@/modules/material-review/server";
import { withMaterialUser, json } from "@/modules/material-review/http";
import { EventError } from "@/modules/event-participation/errors";
import { readContent } from "@/modules/content-management/store";
import type { EventDefinition } from "@/modules/event-board/contracts";
import { buildFiles } from "@/modules/event-participation/files";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  return withMaterialUser(request, false, async (user) => {
    const { id: submissionId, fileId } = await context.params;
    const material = await getMaterial(user, submissionId);
    if (!material.assets.some((asset) => asset.id === fileId))
      return json({ error: "FORBIDDEN" }, 403);
    const content = await readContent("event", material.eventId);
    if (!content) return json({ error: "NOT_FOUND" }, 404);
    const config = (content.live ?? content.draft) as EventDefinition;
    let file;
    try {
      file = await buildFiles(config).readAsset(user, fileId);
    } catch (error) {
      if (error instanceof EventError)
        return json({ error: error.code }, error.status);
      throw error;
    }
    return new Response(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.mediaType,
        "Content-Length": String(file.buffer.length),
        "Content-Disposition": `${file.purpose === "document" ? "attachment" : "inline"}; filename="download"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
