/** Browser-safe public contracts. Never export secrets or database models here. */
export type AuthLanguage = "zh" | "en";
export type AuthErrorCode =
  | "INVALID_EMAIL"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "RATE_LIMITED"
  | "MAIL_DISABLED"
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "INTERNAL_ERROR";

export interface AuthUser {
  id: string;
  email: string;
  createdAt: Date;
}
export interface AuthUserDto {
  id: string;
  email: string;
  createdAt: string;
}
export interface SendCodeRequest {
  email: string;
  language: AuthLanguage;
}
export interface VerifyCodeRequest {
  email: string;
  code: string;
}
export interface SendCodeResponse {
  ok: true;
  retryAfter: number;
  expiresIn: number;
}
export interface VerifyCodeResponse {
  ok: true;
  user: AuthUserDto;
}
export interface AuthErrorResponse {
  error: AuthErrorCode;
  retryAfter?: number;
}

export const AUTH_ENDPOINTS = {
  sendCode: "/api/auth/send-code",
  verifyCode: "/api/auth/verify-code",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
} as const;
