import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HELP_GLOSSARY, HELP_INTRO, HELP_SECTIONS, HELP_TOUR_HREF, type HelpBlock } from "@/lib/help-content";

const TOC_IDS = [...HELP_SECTIONS.map((s) => s.id), "glossary"];

function allText(blocks: HelpBlock[]): string {
  return blocks
    .flatMap((b) => {
      switch (b.kind) {
        case "p":
        case "note":
          return [b.text];
        case "ul":
        case "ol":
          return b.items;
        case "terms":
          return b.items.flat();
        case "table":
          return [...b.head, ...b.rows.flat()];
      }
    })
    .join("\n");
}

const HELP_COPY = `${HELP_INTRO}\n${HELP_SECTIONS.map((s) => `${s.title}\n${allText(s.blocks)}`).join("\n")}\n${HELP_GLOSSARY.map((g) => `${g.term} ${g.definition}`).join("\n")}`;

describe("in-app help content", () => {
  it("has sections with titles and real content", () => {
    expect(HELP_SECTIONS.length).toBeGreaterThanOrEqual(5);
    for (const section of HELP_SECTIONS) {
      expect(section.title.trim().length, section.id).toBeGreaterThan(3);
      expect(section.blocks.length, section.id).toBeGreaterThan(0);
      expect(allText(section.blocks).trim().length, section.id).toBeGreaterThan(120);
    }
  });

  it("uses anchors that are safe to link to and unique", () => {
    const ids = TOC_IDS;
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(ids).size, "duplicate anchor").toBe(ids.length);
  });

  it("covers the workflow a first-time user needs", () => {
    const copy = HELP_COPY.toLowerCase();
    for (const topic of [
      "research data",
      "activity",
      "finding",
      "evidence",
      "report",
      "history",
      "25 mb",
      "draft",
      "finaliz",
    ]) {
      expect(copy, `help never mentions ${topic}`).toContain(topic);
    }
  });

  it("does not promise capabilities the app does not have yet", () => {
    // Planned work belongs in .planning/ROADMAP.md. Promising it here is a defect.
    const copy = HELP_COPY.toLowerCase();
    for (const notBuilt of [
      "invite",
      "permission",
      "role-based",
      "share link",
      "team",
      "real patient",
      "hipaa",
      "compliant",
    ]) {
      expect(copy, `help claims undelivered capability: ${notBuilt}`).not.toContain(notBuilt);
    }
  });

  it("states plainly that nothing here is a diagnosis", () => {
    expect(HELP_COPY.toLowerCase()).toContain("not a diagnosis");
  });

  it("does not restate the synthetic-data disclosure, which lives in the shell", () => {
    expect(HELP_COPY).not.toContain("deidentified");
    // It may point at the badge, but must not duplicate the wording.
    expect(HELP_COPY.toLowerCase()).toContain("fabricated");
  });

  it("keeps glossary terms unique and defined", () => {
    expect(HELP_GLOSSARY.length).toBeGreaterThanOrEqual(12);
    const terms = HELP_GLOSSARY.map((g) => g.term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const { term, definition } of HELP_GLOSSARY) {
      expect(term.trim().length, term).toBeGreaterThan(1);
      expect(definition.trim().length, term).toBeGreaterThan(20);
    }
  });

  it("points the walkthrough at the onboarding route", () => {
    expect(HELP_TOUR_HREF).toBe("/?onboard=1");
  });
});

describe("glossary filter", () => {
  // Pure filter logic, exercised without a DOM: what a researcher typing a term sees.
  function filter(q: string) {
    const needle = q.trim().toLowerCase();
    if (!needle) return HELP_GLOSSARY;
    return HELP_GLOSSARY.filter(
      (t) => t.term.toLowerCase().includes(needle) || t.definition.toLowerCase().includes(needle),
    );
  }

  it("returns everything for an empty query", () => {
    expect(filter("")).toHaveLength(HELP_GLOSSARY.length);
  });

  it("matches a term by name", () => {
    const found = filter("vcf");
    expect(found.map((t) => t.term)).toContain("VCF");
  });

  it("matches a term by definition", () => {
    expect(filter("chromosome").map((t) => t.term)).toContain("Karyotype");
  });

  it("is case insensitive and ignores surrounding space", () => {
    expect(filter("  BEd ").map((t) => t.term)).toContain("BED");
  });

  it("can come back empty, and the UI says so", () => {
    expect(filter("zzzz")).toHaveLength(0);
    expect(renderToStaticMarkup(<p>No terms match</p>)).toContain("No terms match");
  });
});
