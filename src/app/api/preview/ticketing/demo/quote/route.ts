import { quote } from "@/modules/ticketing/server";
import { json, readJson, withUser } from "@/modules/ticketing/http";
import type { QuoteInput } from "@/modules/ticketing/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return withUser(request, true, async (user) =>
    json(await quote(user, await readJson<QuoteInput>(request))),
  );
}
