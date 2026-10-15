import { cookies } from "next/headers";
import { revokeSession, SESSION_COOKIE } from "@/modules/auth/server";
import { assertOrigin, errorResponse, json } from "@/modules/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) await revokeSession(token);
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
