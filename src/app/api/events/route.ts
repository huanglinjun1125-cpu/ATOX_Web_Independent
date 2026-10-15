import { getBoard } from "@/modules/event-board/server";
import { json, eventErrorResponse } from "@/modules/event-participation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return json(
      await getBoard({
        q: query.get("q") ?? undefined,
        year: query.get("year") ?? undefined,
        stage: query.get("stage") ?? undefined,
      }),
    );
  } catch (error) {
    return eventErrorResponse(error);
  }
}
