import { handleNotification } from "@/modules/ticketing/server";
import { json, readRawJson, withPreview } from "@/modules/ticketing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return withPreview(async () =>
    json(
      await handleNotification(
        await readRawJson(request),
        request.headers.get("x-ticketing-signature") ?? "",
      ),
    ),
  );
}
