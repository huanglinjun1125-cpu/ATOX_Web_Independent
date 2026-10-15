import type { AuthErrorCode } from "./contracts";

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(code);
    this.name = "AuthError";
  }
}
