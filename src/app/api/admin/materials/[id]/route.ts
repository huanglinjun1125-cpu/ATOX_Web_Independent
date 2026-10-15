import { getMaterial } from "@/modules/material-review/server";
import { json, withMaterialUser } from "@/modules/material-review/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMaterialUser(request, false, async (user) =>
    json({ material: await getMaterial(user, (await context.params).id) }),
  );
}
