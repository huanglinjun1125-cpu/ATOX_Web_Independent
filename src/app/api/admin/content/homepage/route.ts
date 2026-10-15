import { contentRoute } from "@/modules/content-management/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return contentRoute(request, "homepage", "homepage");
}
export async function PUT(request: Request) {
  return contentRoute(request, "homepage", "homepage", true);
}
export async function POST(request: Request) {
  return contentRoute(request, "homepage", "homepage", true);
}
