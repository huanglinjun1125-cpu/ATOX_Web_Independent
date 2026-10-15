import { centerRoute } from "@/modules/participant-center/http";
export const dynamic = "force-dynamic";
export const GET = (
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) => centerRoute(request, context, "get");
export const POST = (
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) => centerRoute(request, context, "command");
