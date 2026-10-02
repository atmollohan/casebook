import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The form navigates on success, which needs a mounted app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { GenerateReportForm } = await import("@/components/workspace/generate-report-form");

/**
 * Regression cover for a real bug: the Reports tab had a header link and a form button
 * both labelled "Generate report". The link only re-navigated to `?generate=1`, so
 * clicking it looked broken and produced no request at all. One control, one label, and
 * it must actually submit.
 */
describe("generate report control", () => {
  const html = renderToStaticMarkup(<GenerateReportForm programId="prg_test" caseId="pat_test" />);

  it("offers exactly one Generate report control", () => {
    expect(html.match(/Generate report/g) ?? []).toHaveLength(1);
  });

  it("submits a real form rather than navigating", () => {
    // Outside the Next runtime the action renders as React's progressive-enhancement
    // placeholder, so assert the shape that matters: a form, a submit button, and the
    // program it acts on.
    expect(html).toMatch(/<form/);
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="programId" value="prg_test"');
  });

  it("has no cancel affordance, which only existed to undo a query parameter", () => {
    expect(html).not.toContain("Cancel");
    expect(html).not.toContain("?generate=");
  });
});

describe("no page fakes a submit with a query parameter", () => {
  it("no link re-navigates to a ?generate= toggle", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
          const src = fs.readFileSync(full, "utf8");
          // Matches a real link target, not prose in a comment.
          if (/["'`]\/?[^"'`]*\?generate=\d/.test(src)) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(path.join(process.cwd(), "src", "app"));
    walk(path.join(process.cwd(), "src", "components"));
    expect(offenders, `query-param toggles found in: ${offenders.join(", ")}`).toHaveLength(0);
  });
});
