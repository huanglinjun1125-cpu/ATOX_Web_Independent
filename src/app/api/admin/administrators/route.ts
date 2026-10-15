import { listAdministrators, grantAdministrator } from "@/modules/admin/server";
import { json, withUser, readPage, readJson } from "@/modules/admin/http";
import type { GrantAdministratorInput } from "@/modules/admin/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withUser(request, false, async (user) =>
    json(await listAdministrators(user, readPage(request))),
  );
}
export async function POST(request: Request) {
  return withUser(request, true, async (user) =>
    json({
      administrator: await grantAdministrator(
        user,
        await readJson<GrantAdministratorInput>(request),
      ),
    }),
  );
}
