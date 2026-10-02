import { ATTRIBUTE_KEY_MAX, ATTRIBUTE_MAX_COUNT, ATTRIBUTE_VALUE_MAX } from "@/lib/constants";

/**
 * A case's attributes are the owner's own label pairs, not a schema this app prescribes. The app
 * does not know which fields an investigation needs, so it stores what the investigator records
 * and never interprets it.
 *
 * They are flat and string-valued on purpose: a pair is renderable in a report and in the case
 * header, and it is impossible to accidentally join or aggregate against. Anything that needs
 * to be queried across cases belongs in a real column, not here.
 */
export type CaseAttributes = Record<string, string>;

/** Parse the stored JSON. A row that is absent, empty, or unparseable reads as no attributes. */
export function parseAttributes(stored: string | null | undefined): CaseAttributes {
  if (!stored) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: CaseAttributes = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string" && key.trim()) out[key] = value;
  }
  return out;
}

/**
 * Serialize for storage. Trims keys, drops empty ones, and coerces values to strings so the
 * stored shape always satisfies {@link CaseAttributes} — a number written by a hand-edited row or
 * an earlier migration must not break the case that holds it.
 *
 * Returns null when nothing is left, so an unused column stays null rather than holding `{}`.
 */
export function serializeAttributes(input: CaseAttributes | undefined): string | null {
  if (!input) return null;
  const out: CaseAttributes = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key) continue;
    out[key] = rawValue === null || rawValue === undefined ? "" : String(rawValue);
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

/**
 * Normalize a submitted list of attribute rows into the stored map, dropping empty rows and
 * de-duplicating keys by keeping the last value.
 *
 * Returns the map plus a human-readable problem when the submission is over the documented
 * bounds, so the server action can refuse it rather than silently truncating a researcher's
 * notes. Truncating would be the worse failure: the owner would believe a fact was recorded.
 */
export function normalizeAttributeRows(rows: { key?: string; value?: string }[] | undefined): {
  attributes: CaseAttributes;
  error?: string;
} {
  if (!rows || rows.length === 0) return { attributes: {} };

  const attributes: CaseAttributes = {};
  for (const row of rows) {
    const key = (row.key ?? "").trim();
    const value = (row.value ?? "").trim();
    if (!key && !value) continue;
    if (!key) return { attributes: {}, error: "Every attribute needs a name." };
    if (key.length > ATTRIBUTE_KEY_MAX) {
      return { attributes: {}, error: `Attribute names are limited to ${ATTRIBUTE_KEY_MAX} characters.` };
    }
    if (value.length > ATTRIBUTE_VALUE_MAX) {
      return {
        attributes: {},
        error: `"${key}" is limited to ${ATTRIBUTE_VALUE_MAX} characters.`,
      };
    }
    if (value) attributes[key] = value;
  }

  if (Object.keys(attributes).length > ATTRIBUTE_MAX_COUNT) {
    return { attributes: {}, error: `A case carries at most ${ATTRIBUTE_MAX_COUNT} attributes.` };
  }
  return { attributes };
}
