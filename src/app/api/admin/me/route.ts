import { getAdministrator } from "@/modules/admin/server";
import { json, withUser } from "@/modules/admin/http";
import { AdminError } from "@/modules/admin/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withUser(request, false, async (user) => {
    const administrator = await getAdministrator(user);
    if (!administrator) throw new AdminError("FORBIDDEN");
    return json({ administrator });
  });
}
