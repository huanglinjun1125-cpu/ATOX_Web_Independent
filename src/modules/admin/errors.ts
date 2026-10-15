import type { AdminErrorCode } from "./contracts";
export class AdminError extends Error {
  readonly status: number;
  constructor(public readonly code: AdminErrorCode) {
    super(code);
    this.status =
      code === "UNAUTHENTICATED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "USER_NOT_FOUND" || code === "ADMIN_NOT_FOUND"
            ? 404
            : code === "INVALID_INPUT"
              ? 400
              : code === "INTERNAL_ERROR"
                ? 500
                : 409;
  }
}
