// Safe readers for staff-editable page fields (pages.fields is untyped JSON).
export const str = (v: unknown, fallback = ""): string => (typeof v === "string" && v.trim() ? v : fallback);

export const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Plain-text paragraphs separated by blank lines. */
export const paragraphs = (v: unknown): string[] =>
  str(v)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
