import {
  AuthError,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyCode,
} from "@/modules/auth/server";
import {
  assertOrigin,
  errorResponse,
  json,
  readBody,
} from "@/modules/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const body = await readBody(request);
    if (typeof body.email !== "string") throw new AuthError("INVALID_EMAIL");
    if (typeof body.code !== "string") throw new AuthError("INVALID_CODE");
    const { user, token } = await verifyCode(body.email, body.code);
    const response = json({ ok: true, user });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
