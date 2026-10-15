/** Browser integration entry. No database, secret, or server-only imports. */
import { AUTH_ENDPOINTS } from "./contracts";
import type {
  AuthErrorCode,
  AuthErrorResponse,
  SendCodeRequest,
  SendCodeResponse,
  VerifyCodeRequest,
  VerifyCodeResponse,
} from "./contracts";

export class AuthClientError extends Error {
  constructor(
    public code: AuthErrorCode | "NETWORK",
    public retryAfter?: number,
  ) {
    super(code);
    this.name = "AuthClientError";
  }
}

async function post<T>(endpoint: string, payload?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch {
    throw new AuthClientError("NETWORK");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AuthClientError("INTERNAL_ERROR");
  }
  if (!response.ok) {
    const error = body as Partial<AuthErrorResponse> | null;
    throw new AuthClientError(
      error?.error ?? "INTERNAL_ERROR",
      error?.retryAfter,
    );
  }
  return body as T;
}

export const sendLoginCode = (request: SendCodeRequest) =>
  post<SendCodeResponse>(AUTH_ENDPOINTS.sendCode, request);
export const verifyLoginCode = (request: VerifyCodeRequest) =>
  post<VerifyCodeResponse>(AUTH_ENDPOINTS.verifyCode, request);
export const logout = () => post<{ ok: true }>(AUTH_ENDPOINTS.logout);
