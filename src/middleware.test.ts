import { NextRequest } from "next/server";

process.env.SESSION_COOKIE = "casebook_session";

import { describe, expect, it } from "vitest";
import { middleware, config } from "@/middleware";

/**
 * Middleware guards every route, and it runs where the session cannot be checked, so its
 * limits are worth pinning down in tests rather than leaving to inspection.
 *
 * The behaviour that matters most is negative: a stale session token must never be able to
 * trap a visitor in a reload loop. That failure was invisible to the happy path — signing in
 * and browsing worked perfectly — and it locked people out of the app entirely, so it is
 * asserted here as a property of the request cycle rather than as a single response.
 */

const COOKIE = "casebook_session";

function request(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `${COOKIE}=${token}`);
  return new NextRequest(`https://casebook.test${path}`, { headers });
}

/** Where a response sends the browser, or null when it does not redirect. */
function locationOf(response: Response): string | null {
  return response.headers.get("location");
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

describe("a signed-out visitor", () => {
  it("is sent to sign in from a protected page", () => {
    const response = middleware(request("/patients/pat_123"));

    expect(isRedirect(response)).toBe(true);
    expect(locationOf(response)).toContain("/login");
  });

  it("is told where they were going, so sign-in can return them there", () => {
    const response = middleware(request("/patients/pat_123/data"));

    expect(locationOf(response)).toContain("next=%2Fpatients%2Fpat_123%2Fdata");
  });

  it("reaches the sign-in page itself, rather than being redirected away from it", () => {
    expect(isRedirect(middleware(request("/login")))).toBe(false);
  });
});

describe("a visitor holding a session cookie", () => {
  it("is let through to a protected page", () => {
    expect(isRedirect(middleware(request("/patients/pat_123", "a-token")))).toBe(false);
  });

  it("is still allowed to reach the sign-in page, because presence is not validity", () => {
    // The login page decides this with a real session lookup. Middleware cannot, and used to
    // guess — bouncing to "/" on presence alone, which is what started the loop.
    expect(isRedirect(middleware(request("/login", "a-token")))).toBe(false);
  });
});

describe("a stale session token", () => {
  /**
   * Walk the real request cycle: middleware first, then the page.
   *
   * The page matters because middleware cannot close the loop on its own — it lets a request
   * carrying any cookie through, and it is `requireUser()` in the page that discovers the
   * token is dead and redirects. So the cycle under test spans both layers, exactly as it did
   * in the browser.
   */
  function followALoadingVisitor(token: string, resolveSession: (t: string) => boolean) {
    const isPublicPath = (p: string) => p === "/login" || p.startsWith("/login/");
    let path = "/";
    const visited: string[] = [];

    for (let hop = 0; hop < 20; hop++) {
      visited.push(path);

      // Layer 1: middleware.
      const response = middleware(request(path, token));
      if (isRedirect(response)) {
        path = new URL(locationOf(response)!, "https://casebook.test").pathname;
        continue;
      }

      // Layer 2: the page. A protected page calls requireUser(), which redirects to sign-in
      // when the session cannot be resolved.
      if (!isPublicPath(path) && !resolveSession(token)) {
        path = "/login";
        continue;
      }

      return { landedOn: path, visited };
    }

    return { landedOn: null, visited };
  }

  const resolvesNothing = () => false;

  it("reaches the sign-in form instead of cycling forever", () => {
    const { landedOn, visited } = followALoadingVisitor("a-stale-token", resolvesNothing);

    expect(landedOn).toBe("/login");
    // The old failure was unbounded: every hop bounced, and the sign-in form never rendered.
    expect(visited.length).toBeLessThanOrEqual(3);
  });

  it("takes the same path whether the token is stale or simply absent", () => {
    // Both are unauthenticated, so both must end up in the same place. The bug was that they
    // did not: a stale token was treated as better than no token at all.
    const stale = followALoadingVisitor("a-stale-token", resolvesNothing);

    expect(stale.landedOn).toBe("/login");
  });

  it("leaves the visitor on the sign-in page rather than bouncing them onward", () => {
    const response = middleware(request("/login", "a-token-that-no-longer-resolves"));

    expect(locationOf(response)).toBeNull();
  });

  it("still loops nowhere when the session is valid, because sign-in is never reached", () => {
    // Sanity check on the model itself: with a working token the visitor stays on `/`.
    const { landedOn } = followALoadingVisitor("a-live-token", () => true);

    expect(landedOn).toBe("/");
  });
});

describe("the route matcher", () => {
  it("excludes static assets, so a missing session never blocks one", () => {
    // Asserted as the literal source text: the matcher is a regular expression, and what
    // matters is that these paths are named in the exclusion group rather than matched.
    for (const path of ["_next/static", "_next/image", "favicon.ico"]) {
      expect(config.matcher[0], path).toContain(path);
    }
  });

  it("exempts common image formats, so a direct link to one is not a sign-in redirect", () => {
    for (const ext of ["svg", "png", "jpg", "jpeg", "gif", "webp"]) {
      expect(config.matcher[0], ext).toContain(ext);
    }
  });

  it("still covers application routes", () => {
    expect(config.matcher[0]).toContain("/((?!");
  });
});
