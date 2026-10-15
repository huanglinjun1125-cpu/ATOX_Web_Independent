import {
  json,
  withEventUser,
  type EventRouteContext,
  readUpload,
} from "@/modules/event-participation/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: EventRouteContext) {
  return withEventUser(request, context, true, async (user, service, files) => {
    await service.assertCanEdit(user);
    const input = await readUpload(request);
    return json(
      await files.uploadAsset(
        user,
        input.purpose,
        input.buffer,
        input.originalName,
      ),
    );
  });
}
