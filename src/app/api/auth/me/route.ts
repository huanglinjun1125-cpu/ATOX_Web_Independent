import { getCurrentUser } from "@/modules/auth/server";
import { errorResponse, json } from "@/modules/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await getCurrentUser();
    return json({ user }, user ? 200 : 401);
  } catch (error) {
    return errorResponse(error);
  }
}
