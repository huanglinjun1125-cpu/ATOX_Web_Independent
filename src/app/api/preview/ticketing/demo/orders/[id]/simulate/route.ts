import { simulatePayment } from "@/modules/ticketing/server";
import { json, readJson, withUser } from "@/modules/ticketing/http";
import type { SimulationAction } from "@/modules/ticketing/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withUser(request, true, async (user) => {
    const input = await readJson<{ action: SimulationAction }>(request);
    return json(
      await simulatePayment(user, (await context.params).id, input.action),
    );
  });
}
