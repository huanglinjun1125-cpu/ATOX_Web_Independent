import "server-only";

/** Supported server integration surface for other business modules. */
export { getCurrentUser } from "./session";
export { sendCode, verifyCode, revokeSession, getUserByToken } from "./service";
export { findRegisteredUserByEmail } from "./service";
export { isDevMailEnabled, listDevMails } from "./mail";
export { AuthError } from "./errors";
export { SESSION_COOKIE, SESSION_SECONDS } from "./policy";
export type { AuthUser, AuthUserDto } from "./contracts";
