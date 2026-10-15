import { getCatalog } from "@/modules/ticketing/server";
import { json, withPreview } from "@/modules/ticketing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return withPreview(async () => json(await getCatalog()));
}
