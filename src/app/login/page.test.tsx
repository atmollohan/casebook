import { renderToStaticMarkup } from "react-dom/server";

process.env.TEST_DATABASE = "memory";
process.env.DATABASE_FILE = ":memory:";
process.env.SESSION_COOKIE = "omanta_session";

/**
 * The sign-in boundary, end to end, against a real session store.
 *
 * The bug this covers locked people out of the app: a session token that no longer resolved
 * sent `/` back to `/login` and `/login` back to `/`, forever, with the sign-in form
 * unreachable. Nothing about signing in or browsing was broken, so only this boundary could
 * have caught it — a stale cookie is the one input that is indistinguishable from a good one
 * until something tries to resolve it.
 *
 * The database is real (in-memory SQLite, migrated). Only request scope is stubbed, because
 * there is no request here: `cookies()` and `redirect()` are what a server component touches.
 */
let cookieToken: string | null = null;
const redirects: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieToken ? { name, value: cookieToken } : undefined) }),
}));

// Next's redirect() never returns: it throws. Reproduced here so the page behaves as it does
// in the app, where a redirect is a thrown signal rather than a return value.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, migrateDb, resetDb } from "@/lib/db";
import { createSession, createUser, deleteSessionByTokenHash } from "@/lib/db/repo";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth";
import LoginPage from "@/app/login/page";

const DAY_MS = 86_400_000;
let userId: string;
let liveToken: string;

beforeAll(() => {
  migrateDb(getDb());
  const user = createUser(getDb(), {
    email: "researcher@omanta.test",
    name: "Researcher One",
    passwordHash: hashPassword("correct-horse"),
  });
  userId = user.id;
  liveToken = "a-token-that-resolves";
  createSession(getDb(), userId, hashToken(liveToken), DAY_MS);
});

afterAll(() => {
  resetDb();
});

beforeEach(() => {
  cookieToken = null;
  redirects.length = 0;
});

/** Render the sign-in page the way Next would, and report where it sent the visitor. */
async function visitLoginPage() {
  try {
    const element = await LoginPage();
    return { redirectedTo: null, html: renderToStaticMarkup(element) };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    if (message.startsWith("NEXT_REDIRECT:")) {
      return { redirectedTo: message.slice("NEXT_REDIRECT:".length), html: "" };
    }
    throw thrown;
  }
}

describe("a researcher with a valid session", () => {
  beforeEach(() => {
    cookieToken = liveToken;
  });

  it("is recognised by the session lookup", async () => {
    expect((await getCurrentUser())?.id).toBe(userId);
  });

  it("is sent straight to the program list instead of the sign-in form", async () => {
    const { redirectedTo } = await visitLoginPage();

    expect(redirectedTo).toBe("/");
  });
});

describe("a visitor whose token no longer resolves", () => {
  beforeEach(() => {
    cookieToken = "a-token-that-no-longer-resolves";
  });

  it("is not recognised as a user", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("reaches the sign-in form, which is the only way back in", async () => {
    const { redirectedTo, html } = await visitLoginPage();

    expect(redirectedTo).toBeNull();
    expect(html).toContain("Sign in");
  });

  it("is offered the fields needed to replace the bad token", async () => {
    const { html } = await visitLoginPage();

    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });
});

describe("a visitor with no token at all", () => {
  it("reaches the sign-in form", async () => {
    const { redirectedTo, html } = await visitLoginPage();

    expect(redirectedTo).toBeNull();
    expect(html).toContain("Sign in");
  });
});

describe("a session that has expired", () => {
  it("stops being recognised, and stops being recognised as a session at all", async () => {
    // Expiry is enforced against the store rather than trusted from the cookie, so a token
    // that outlives its row behaves exactly like one that never existed.
    const expiredToken = "a-token-that-has-expired";
    createSession(getDb(), userId, hashToken(expiredToken), -DAY_MS);
    cookieToken = expiredToken;

    expect(await getCurrentUser()).toBeNull();

    const { redirectedTo, html } = await visitLoginPage();
    expect(redirectedTo).toBeNull();
    expect(html).toContain("Sign in");
  });

  it("is cleaned up rather than left to be re-checked forever", async () => {
    const expiredToken = "a-token-that-is-also-stale";
    createSession(getDb(), userId, hashToken(expiredToken), -DAY_MS);
    cookieToken = expiredToken;

    expect(await getCurrentUser()).toBeNull();
    // The lookup deletes the row it found expired, so a pruned database cannot accumulate
    // sessions that are dead but still present.
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("signing out", () => {
  it("makes a previously valid token stop working", async () => {
    const token = "a-token-that-is-about-to-be-revoked";
    createSession(getDb(), userId, hashToken(token), DAY_MS);
    cookieToken = token;
    expect((await getCurrentUser())?.id).toBe(userId);

    deleteSessionByTokenHash(getDb(), hashToken(token));

    expect(await getCurrentUser()).toBeNull();
    const { redirectedTo, html } = await visitLoginPage();
    expect(redirectedTo).toBeNull();
    expect(html).toContain("Sign in");
  });
});
