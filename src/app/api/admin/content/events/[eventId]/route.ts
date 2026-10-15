import { contentRoute } from "@/modules/content-management/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ eventId: string }> };
export async function GET(request: Request, context: Context) {
  return contentRoute(request, "event", (await context.params).eventId);
}
export async function PUT(request: Request, context: Context) {
  return contentRoute(request, "event", (await context.params).eventId, true);
}
export async function POST(request: Request, context: Context) {
  return contentRoute(request, "event", (await context.params).eventId, true);
}
