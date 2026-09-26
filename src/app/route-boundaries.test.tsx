import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "@/app/loading";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

describe("loading state", () => {
  const html = renderToStaticMarkup(<Loading />);

  it("announces itself to assistive technology instead of showing a silent blank page", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading");
  });

  it("renders placeholder blocks rather than real content", () => {
    expect(html).toContain("animate-pulse");
  });
});

describe("error state", () => {
  const html = renderToStaticMarkup(<RouteError error={new Error("boom")} reset={() => {}} />);

  it("explains the failure without leaking internal error text to the user", () => {
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain("boom");
  });

  it("offers a retry and a way back to the program list", () => {
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
  });

  it("shows a support reference only when the runtime supplied a digest", () => {
    const withDigest = renderToStaticMarkup(
      <RouteError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={() => {}} />,
    );
    expect(withDigest).toContain("abc123");
    expect(html).not.toContain("Reference:");
  });
});

describe("not-found state", () => {
  const html = renderToStaticMarkup(<NotFound />);

  it("tells the user the page is missing and how to get back", () => {
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
  });
});

describe("global error state", () => {
  const html = renderToStaticMarkup(<GlobalError error={new Error("db missing")} />);

  it("renders a complete document, because it replaces the root layout", () => {
    expect(html).toContain("<html");
    expect(html).toContain("<body");
  });

  it("points at the local database and offers a reload", () => {
    expect(html).toContain("could not start");
    expect(html).toContain("database");
    expect(html).toContain("Reload");
  });

  it("does not leak the underlying error message", () => {
    expect(html).not.toContain("db missing");
  });
});
