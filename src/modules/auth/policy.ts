/** Version 1 business defaults; changes require updating the module contract. */
export const AUTH_POLICY = Object.freeze({
  codeLifetimeSeconds: 600,
  resendIntervalSeconds: 60,
  rateWindowSeconds: 3600,
  emailSendsPerWindow: 5,
  ipSendsPerWindow: 20,
  maxCodeAttempts: 5,
  sessionLifetimeSeconds: 7 * 24 * 60 * 60,
});
export const SESSION_COOKIE = "hackathon_session";
export const SESSION_SECONDS = AUTH_POLICY.sessionLifetimeSeconds;
