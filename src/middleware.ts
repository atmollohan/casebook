import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "casebook_session";
const PUBLIC_PATHS = ["/login"];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * Send signed-out visitors to sign in, and otherwise stay out of the way.
 *
 * This runs on the edge runtime, where the session cannot be verified: sessions are hashed
 * in SQLite and better-sqlite3 is Node-only. A cookie's *presence* is therefore the only
 * signal available here, and nothing more is claimed. Validity is decided further in — by
 * `requireUser()` on the page being viewed, and by the login page itself.
 *
 * That limit is exactly why this function must never redirect `/login` away. An earlier
 * version did: any request carrying a cookie was bounced from `/login` to `/`, treating
 * presence as proof of a session. A cookie that no longer resolves — expired, pruned, or
 * left over from a re-seeded database — broke that assumption. `/` sent the visitor back to
 * `/login` through `requireUser`, `/login` sent them to `/`, and the browser reloaded
 * forever with no way to reach the sign-in form that would fix it. Presence is cheap to
 * check; acting on it as proof is what locked people out.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic(pathname) && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
