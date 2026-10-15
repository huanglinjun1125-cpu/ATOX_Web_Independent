/** Safe browser/server shared redirect target. Decode/URL validation prevents
 * external hosts, protocol-relative paths, backslashes, and login loops.
 */
export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020\u007f]/.test(decoded) || decoded.startsWith("//"))
      return "/account";
    const url = new URL(value, "http://internal.local");
    if (
      url.origin !== "http://internal.local" ||
      url.pathname === "/login" ||
      url.pathname.startsWith("/api/")
    )
      return "/account";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/account";
  }
}
