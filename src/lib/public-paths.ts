const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth",
  "/legal",
  "/terminos",
  "/privacidad",
]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/join/")) return true;
  if (pathname.startsWith("/rsvp/")) return true;
  if (pathname === "/api/rsvp") return true; // auth = token HMAC firmado
  if (pathname === "/api/rpe/link") return true; // auth = token HMAC firmado (propósito rpe)
  if (/^\/rpe\/[^/]+$/.test(pathname)) return true; // auth = token HMAC firmado (propósito rpe)
  if (pathname.startsWith("/reset-password/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}
