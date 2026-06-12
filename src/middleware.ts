import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/api/auth",
]);

const COACH_PATHS = /^\/(coach|api\/teams\/(create|[^/]+\/(edit|delete|members)))/;
const PLAYER_PATHS = /^\/player/;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/join/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}

export default auth((req: NextRequest & { auth: { user?: { role?: string } } | null }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role;

  if (COACH_PATHS.test(pathname) && userRole !== "COACH") {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol de entrenador" },
      { status: 403 }
    );
  }

  if (PLAYER_PATHS.test(pathname) && userRole !== "PLAYER") {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol de jugador" },
      { status: 403 }
    );
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
