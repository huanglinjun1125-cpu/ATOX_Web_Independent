import { decideMaterial } from "@/modules/material-review/server";
import {
  json,
  withMaterialUser,
  readJson,
} from "@/modules/material-review/http";
import type { DecisionInput } from "@/modules/material-review/contracts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withMaterialUser(request, true, async (user) =>
    json({
      material: await decideMaterial(
        user,
        (await context.params).id,
        await readJson<DecisionInput>(request),
      ),
    }),
  );
}
