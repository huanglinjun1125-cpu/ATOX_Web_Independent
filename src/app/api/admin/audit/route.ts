import { listAudit } from "@/modules/admin/server";
import { json, withUser, readPage } from "@/modules/admin/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withUser(request, false, async (user) =>
    json(await listAudit(user, readPage(request))),
  );
}
