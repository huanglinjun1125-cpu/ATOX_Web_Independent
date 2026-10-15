import { getProjects } from "@/modules/project-board/server";
import { parseFilters } from "@/modules/project-board/rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return Response.json(
    await getProjects(parseFilters(new URL(request.url).searchParams)),
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
