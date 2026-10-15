import { updateAdministrator } from "@/modules/admin/server";
import { json, withUser, readJson } from "@/modules/admin/http";
import type { UpdateAdministratorInput } from "@/modules/admin/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return withUser(request, true, async (user) =>
    json({
      administrator: await updateAdministrator(
        user,
        (await context.params).userId,
        await readJson<UpdateAdministratorInput>(request),
      ),
    }),
  );
}
