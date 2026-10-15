export function usePathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}
