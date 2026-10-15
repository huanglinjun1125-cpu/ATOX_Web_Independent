import type { AuthUser } from "../auth/contracts";
import { withUser, json } from "../admin/http";
import { MaterialReviewError } from "./errors";
export { json, readJson } from "../admin/http";
export async function withMaterialUser(
  request: Request,
  mutate: boolean,
  operation: (user: AuthUser) => Promise<Response>,
) {
  return withUser(request, mutate, async (user) => {
    try {
      return await operation(user);
    } catch (error) {
      if (error instanceof MaterialReviewError)
        return json({ error: error.code }, error.status);
      throw error;
    }
  });
}
