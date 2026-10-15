import { AuthError, sendCode } from "@/modules/auth/server";
import {
  assertOrigin,
  errorResponse,
  json,
  readBody,
  requestIp,
} from "@/modules/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const body = await readBody(request);
    if (typeof body.email !== "string") throw new AuthError("INVALID_EMAIL");
    if (body.language !== "zh" && body.language !== "en")
      throw new AuthError("INVALID_REQUEST");
    return json(await sendCode(body.email, body.language, requestIp(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
