"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/form";

/**
 * The glossary is the one part of the help page that earns a filter: researchers arrive
 * with a term from a paper or a report and want its meaning in one keystroke, not by
 * scanning. Everything else on the page is prose and does not need a control.
 *
 * The filter searches every group, including the domain-specific ones, so a reader who types
 * "VCF" does not have to know which section a term lives in. Groups only re-order and
 * re-label as matches come in; a group with no match is not rendered at all.
 */
export function GlossaryFilter({
  groups,
}: {
  groups: { id: string; title: string; blurb?: string; terms: Array<{ term: string; definition: string }> }[];
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        terms: q
          ? group.terms.filter(
              (t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q),
            )
          : group.terms,
      }))
      .filter((group) => group.terms.length > 0);
  }, [query, groups]);

  const total = groups.reduce((n, group) => n + group.terms.length, 0);
  const found = matches.reduce((n, group) => n + group.terms.length, 0);

  return (
    <div>
      <div className="relative max-w-sm">
        <label htmlFor="glossary-filter" className="sr-only">
          Filter terms
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-700/40" />
        <Input
          id="glossary-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter terms"
          className="pl-9"
        />
      </div>

      <p aria-live="polite" className="mt-3 text-xs text-ink-700/60">
        {query.trim() ? `${found} of ${total} terms` : `${total} terms`}
      </p>

      {found === 0 ? (
        <p className="mt-4 text-sm text-ink-700/70">No terms match “{query.trim()}”.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {matches.map((group) => (
            <div key={group.id}>
              {groups.length > 1 && <h3 className="text-sm font-semibold text-ink-900">{group.title}</h3>}
              {group.blurb && <p className="mt-1 text-sm text-ink-700/80">{group.blurb}</p>}
              <dl className="mt-2.5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {group.terms.map(({ term, definition }) => (
                  <div key={term} className="min-w-0">
                    <dt className="text-sm font-medium text-ink-900">{term}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-ink-700/80">{definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
