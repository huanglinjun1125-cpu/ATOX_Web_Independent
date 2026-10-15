import {
  withEventUser,
  type EventRouteContext,
} from "@/modules/event-participation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: EventRouteContext) {
  return withEventUser(
    request,
    context,
    false,
    async (user, _service, files, id) => {
      const file = await files.readAsset(user, id!);
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
    },
  );
}
