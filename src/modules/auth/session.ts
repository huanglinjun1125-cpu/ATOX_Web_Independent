import { cookies } from "next/headers";
import { getUserByToken } from "./service";
import { SESSION_COOKIE } from "./policy";

/** Next.js adapter: service.ts itself does not depend on framework cookies. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserByToken(token);
}
