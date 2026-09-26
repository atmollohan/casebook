import { requireUser } from "@/lib/server/auth";
import { HELP_GLOSSARY, HELP_INTRO, HELP_SECTIONS, HELP_TOUR_HREF, type HelpBlock } from "@/lib/help-content";
import { GlossaryFilter } from "@/components/help/glossary-filter";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Compass, Sparkles } from "lucide-react";

export const metadata = { title: "Help" };

const GLOSSARY_SECTION = { id: "glossary", title: "Terms explained" };
const TOC = [...HELP_SECTIONS, GLOSSARY_SECTION];

function Block({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="text-sm leading-relaxed text-ink-700/85">{block.text}</p>;
    case "note":
      return (
        <p className="rounded-lg border border-brand-600/20 bg-brand-50/60 px-3.5 py-3 text-sm leading-relaxed text-ink-800">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul className="space-y-2 text-sm leading-relaxed text-ink-700/85">
          {block.items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-ink-700/40" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="space-y-2 text-sm leading-relaxed text-ink-700/85">
          {block.items.map((item, i) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-700">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      );
    case "terms":
      return (
        <dl className="space-y-3">
          {block.items.map(([term, meaning]) => (
            <div key={term}>
              <dt className="text-sm font-medium text-ink-900">{term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-ink-700/80">{meaning}</dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-ink-100">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60">
                {block.head.map((h) => (
                  <th key={h} scope="col" className="px-3.5 py-2.5 text-[13px] font-semibold text-ink-900">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]} className="border-b border-ink-100/70 last:border-0">
                  {row.map((cell, i) => (
                    <td
                      key={cell}
                      className={
                        i === 0
                          ? "px-3.5 py-2.5 align-top font-medium text-ink-900"
                          : "px-3.5 py-2.5 align-top leading-relaxed text-ink-700/85"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default async function HelpPage() {
  await requireUser();

  return (
    <div className="page-container">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Help</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700/80">{HELP_INTRO}</p>
        </div>
        <ButtonLink
          href={HELP_TOUR_HREF}
          variant="secondary"
          size="sm"
          icon={<Sparkles className="size-4" />}
        >
          Take the walkthrough
        </ButtonLink>
      </div>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="print-hide lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-700/60">
            <Compass className="size-3.5" />
            On this page
          </div>
          <ul className="mt-3 space-y-0.5">
            {TOC.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="focus-ring block rounded-md px-2.5 py-1.5 text-sm text-ink-700/80 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {HELP_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={section.id}>
              <Card>
                <CardBody className="px-5 py-5">
                  <h2
                    id={section.id}
                    className="scroll-mt-24 text-[17px] font-semibold tracking-tight text-ink-900"
                  >
                    <a href={`#${section.id}`} className="focus-ring rounded">
                      {section.title}
                    </a>
                  </h2>
                  <div className="mt-3.5 space-y-3.5">
                    {section.blocks.map((block, i) => (
                      <Block key={i} block={block} />
                    ))}
                  </div>
                </CardBody>
              </Card>
            </section>
          ))}

          <section aria-labelledby={GLOSSARY_SECTION.id}>
            <Card>
              <CardBody className="px-5 py-5">
                <h2
                  id={GLOSSARY_SECTION.id}
                  className="scroll-mt-24 text-[17px] font-semibold tracking-tight text-ink-900"
                >
                  <a href={`#${GLOSSARY_SECTION.id}`} className="focus-ring rounded">
                    {GLOSSARY_SECTION.title}
                  </a>
                </h2>
                <div className="mt-3.5">
                  <GlossaryFilter terms={HELP_GLOSSARY} />
                </div>
              </CardBody>
            </Card>
          </section>

          <section aria-label="Walkthrough">
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <p className="text-sm text-ink-700/85">
                  Prefer a guided introduction? The walkthrough covers the three-step path through the app.
                </p>
                <ButtonLink
                  href={HELP_TOUR_HREF}
                  variant="ghost"
                  size="sm"
                  icon={<Sparkles className="size-4" />}
                >
                  Take the walkthrough
                </ButtonLink>
              </CardBody>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
