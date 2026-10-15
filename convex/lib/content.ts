// Guards for unconfirmed facts (CLAUDE.md rule 7).
// Seed content keeps "[CONFIRM] …" markers so staff can see what is outstanding;
// public queries pass content through `stripUnconfirmed` so they never render.

const PLACEHOLDER_RE = /\[CONFIRM[^\]]*\]/i;

export const hasPlaceholder = (s: string): boolean => PLACEHOLDER_RE.test(s);

/**
 * Deep-copies a value, dropping any string that contains a [CONFIRM] marker
 * (object keys holding one are removed, array items holding one are removed)
 * and any object explicitly marked `published: false`.
 */
export function stripUnconfirmed<T>(value: T): T {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(typeof item === "string" && hasPlaceholder(item)))
      .filter((item) => !isUnpublished(item))
      .map((item) => stripUnconfirmed(item))
      .filter((item) => !isEmptyAfterStrip(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && hasPlaceholder(v)) continue;
      if (isUnpublished(v)) continue;
      const cleaned = stripUnconfirmed(v);
      if (isEmptyAfterStrip(cleaned) && !isEmptyAfterStrip(v)) continue;
      out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

const isUnpublished = (v: unknown) =>
  !!v && typeof v === "object" && !Array.isArray(v) && (v as { published?: unknown }).published === false;

// An object whose every field was a placeholder disappears entirely.
const isEmptyAfterStrip = (v: unknown) =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;

/** True when any string anywhere in the value contains a [CONFIRM] marker. */
export function containsPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return hasPlaceholder(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(containsPlaceholder);
  return false;
}
