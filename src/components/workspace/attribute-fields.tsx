"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { ATTRIBUTE_MAX_COUNT, ATTRIBUTE_KEY_MAX, ATTRIBUTE_VALUE_MAX } from "@/lib/constants";
import { parseAttributes } from "@/lib/attributes";

const BLANK_ROWS = 2;

/**
 * A case's details are the owner's own label pairs, not fields this app prescribes, so the set
 * of rows is user-defined and cannot be a fixed set of inputs.
 *
 * Rows post as `attribute__key_<n>` / `attribute__value_<n>` because a form cannot post a nested
 * object. The server action re-reads them, drops the empty ones, and refuses the submission if
 * the result is over the documented bounds — this component only prevents reaching that state.
 */
export function AttributeFields({
  initial = {},
  error,
}: {
  initial?: Record<string, string>;
  error?: string;
}) {
  const initialRows = Object.entries(initial).map(([key, value]) => ({ key, value }));
  const [rows, setRows] = useState<string[]>(() => {
    const filled = initialRows.map((r) => JSON.stringify([r.key, r.value]));
    while (filled.length < BLANK_ROWS) filled.push(JSON.stringify(["", ""]));
    return filled;
  });

  const pairs = rows.map((r) => JSON.parse(r) as [string, string]);
  const atLimit = pairs.length >= ATTRIBUTE_MAX_COUNT;

  function setRow(index: number, key: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      const current = JSON.parse(next[index]) as [string, string];
      next[index] = JSON.stringify(key === "key" ? [value, current[1]] : [current[0], value]);
      return next;
    });
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-900">Details</legend>
      <p className="text-sm text-ink-700/70">
        Anything you want to keep with this case, in your own words. Leave empty to skip.
      </p>

      <div className="space-y-2">
        {pairs.map(([key, value], index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <label htmlFor={`attribute-key-${index}`} className="sr-only">
                Detail {index + 1} name
              </label>
              <Input
                id={`attribute-key-${index}`}
                name={`attribute__key_${index}`}
                value={key}
                maxLength={ATTRIBUTE_KEY_MAX}
                placeholder="Name"
                onChange={(e) => setRow(index, "key", e.target.value)}
              />
            </div>
            <div className="flex-[2]">
              <label htmlFor={`attribute-value-${index}`} className="sr-only">
                Detail {index + 1} value
              </label>
              <Input
                id={`attribute-value-${index}`}
                name={`attribute__value_${index}`}
                value={value}
                maxLength={ATTRIBUTE_VALUE_MAX}
                placeholder="Value"
                onChange={(e) => setRow(index, "value", e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
              icon={<X className="size-4" />}
            >
              <span className="sr-only">Remove detail {index + 1}</span>
            </Button>
          </div>
        ))}
      </div>

      {error && <div className="field-error">{error}</div>}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={atLimit}
        onClick={() => setRows((prev) => [...prev, JSON.stringify(["", ""])])}
        icon={<Plus className="size-4" />}
      >
        {atLimit ? `Limit of ${ATTRIBUTE_MAX_COUNT} reached` : "Add detail"}
      </Button>
    </fieldset>
  );
}

export { parseAttributes };
