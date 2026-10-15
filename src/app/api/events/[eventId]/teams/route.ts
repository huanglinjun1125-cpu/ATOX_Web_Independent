import { centerRoute } from "@/modules/participant-center/http";
export const dynamic = "force-dynamic";
export const GET = (
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) => centerRoute(request, context, "list");
