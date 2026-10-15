// Field schemas for editable page copy (docs/06 "Content & SEO"). The admin
// builds each page's form from these, and Convex validates saved fields with
// `validateFields`. Shared by Next.js and Convex, so no imports.

export type Field =
  | { kind: "text"; key: string; label: string; max: number; h1?: boolean; help?: string; optional?: boolean }
  | { kind: "textarea"; key: string; label: string; max: number; help?: string; optional?: boolean; rows?: number }
  | { kind: "images"; key: string; label: string; max: number; help?: string }
  | { kind: "strings"; key: string; label: string; max: number; itemMax: number; help?: string }
  | { kind: "list"; key: string; label: string; max: number; itemLabel: string; fields: Field[]; publishable?: boolean; help?: string }
  | { kind: "group"; key: string; label: string; fields: Field[]; publishable?: boolean; help?: string };

export type PageSchema = { key: string; label: string; path: string; fields: Field[]; titleNeedsAkure?: boolean };

const h1: Field = { kind: "text", key: "h1", label: "Main heading (H1)", max: 110, h1: true };
const lede: Field = { kind: "textarea", key: "lede", label: "Intro text", max: 400, rows: 3 };
const sections = (withAreas = false): Field => ({
  kind: "list",
  key: "sections",
  label: "Sections",
  itemLabel: "Section",
  max: 20,
  publishable: true,
  fields: [
    { kind: "text", key: "id", label: "Link anchor (e.g. getting-here)", max: 40 },
    { kind: "text", key: "heading", label: "Heading", max: 100 },
    { kind: "textarea", key: "body", label: "Text", max: 4000, rows: 6, optional: withAreas, help: "Blank line = new paragraph. **bold**, [link](https://…), lines starting with - make a list." },
    ...(withAreas
      ? [{ kind: "list", key: "areas", label: "Areas", itemLabel: "Area", max: 12, fields: [
          { kind: "text", key: "name", label: "Name", max: 60 },
          { kind: "textarea", key: "body", label: "Text", max: 400, rows: 2 },
        ] } satisfies Field]
      : []),
  ],
});

export const PAGE_SCHEMAS: PageSchema[] = [
  {
    key: "home",
    label: "Home",
    path: "/",
    titleNeedsAkure: true,
    fields: [
      { kind: "text", key: "eyebrow", label: "Line above the heading", max: 60 },
      h1,
      { kind: "textarea", key: "lede", label: "Intro text", max: 400, rows: 3, help: "{fromRate} is replaced by the lowest room rate." },
      { kind: "images", key: "heroImages", label: "Hero photos (3)", max: 3, help: "Pick from the gallery. The first is the large photo." },
      { kind: "text", key: "aboutHeading", label: "About: heading", max: 110 },
      { kind: "textarea", key: "aboutBody", label: "About: text", max: 1200, rows: 5 },
      { kind: "text", key: "diningHeading", label: "Dining: heading", max: 110 },
      { kind: "textarea", key: "diningBody", label: "Dining: text", max: 800, rows: 4 },
      { kind: "text", key: "locationHeading", label: "Location: heading", max: 110 },
      { kind: "textarea", key: "locationBody", label: "Location: text", max: 800, rows: 3 },
      { kind: "list", key: "distances", label: "Distances", itemLabel: "Place", max: 8, fields: [
        { kind: "text", key: "place", label: "Place", max: 80 },
        { kind: "text", key: "value", label: "Distance / drive time", max: 40 },
      ] },
    ],
  },
  {
    key: "rooms",
    label: "Rooms & suites",
    path: "/rooms",
    titleNeedsAkure: true,
    fields: [h1, lede, { kind: "strings", key: "inEveryRoom", label: "In every room", max: 16, itemMax: 60 }],
  },
  {
    key: "dining",
    label: "Dining & bars",
    path: "/dining",
    fields: [
      h1,
      lede,
      { kind: "list", key: "hours", label: "Opening hours", itemLabel: "Line", max: 8, fields: [
        { kind: "text", key: "label", label: "What", max: 40 },
        { kind: "text", key: "value", label: "Hours", max: 40 },
      ] },
      { kind: "list", key: "menuCategories", label: "Menu", itemLabel: "Category", max: 8, fields: [
        { kind: "text", key: "name", label: "Name", max: 40 },
        { kind: "textarea", key: "description", label: "Description", max: 300, rows: 2 },
      ] },
      { kind: "group", key: "indoorBar", label: "Indoor bar", fields: [
        { kind: "text", key: "heading", label: "Heading", max: 100 },
        { kind: "textarea", key: "body", label: "Text", max: 600, rows: 3 },
        { kind: "text", key: "hours", label: "Hours", max: 40, optional: true },
      ] },
      { kind: "group", key: "outdoorBar", label: "Outdoor bar", publishable: true, fields: [
        { kind: "text", key: "heading", label: "Heading", max: 100 },
        { kind: "textarea", key: "body", label: "Text", max: 600, rows: 3 },
      ] },
    ],
  },
  { key: "facilities", label: "Facilities", path: "/facilities", fields: [h1, lede] },
  { key: "gallery", label: "Gallery", path: "/gallery", fields: [h1, lede] },
  {
    key: "contact",
    label: "Contact",
    path: "/contact",
    fields: [h1, lede, { kind: "textarea", key: "directions", label: "Directions", max: 1000, rows: 4, optional: true }],
  },
  {
    key: "akure-guide",
    label: "Akure guide",
    path: "/akure-guide",
    titleNeedsAkure: true,
    fields: [
      h1,
      { kind: "text", key: "author", label: "Author (name, role)", max: 80, optional: true },
      { kind: "textarea", key: "intro", label: "Intro", max: 600, rows: 3 },
      sections(true),
    ],
  },
  { key: "privacy", label: "Privacy notice", path: "/privacy", fields: [h1, { kind: "textarea", key: "intro", label: "Intro", max: 600, rows: 3 }, sections()] },
  { key: "terms", label: "Booking terms", path: "/terms", fields: [h1, { kind: "textarea", key: "intro", label: "Intro", max: 600, rows: 3 }, sections()] },
];

export const pageSchema = (key: string) => PAGE_SCHEMAS.find((p) => p.key === key) ?? null;

export type FieldError = { path: string; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Image refs in page copy: a "/images/…" seed path or a full picked image with alt text. */
function imageProblem(v: unknown): string | null {
  if (typeof v === "string") return v.startsWith("/images/") ? null : "Pick a photo from the gallery.";
  if (isObj(v) && typeof v.url === "string" && typeof v.alt === "string" && typeof v.width === "number" && typeof v.height === "number") {
    return v.alt.trim() ? null : "This photo needs a description (alt text).";
  }
  return "Pick a photo from the gallery.";
}

/**
 * Checks fields against a schema: types, lengths, required text. Returns the
 * cleaned value (strings trimmed, unknown keys dropped) and any errors.
 */
export function validateFields(schema: Field[], value: unknown, base = ""): { value: Record<string, unknown>; errors: FieldError[] } {
  const src = isObj(value) ? value : {};
  const out: Record<string, unknown> = {};
  const errors: FieldError[] = [];
  for (const f of schema) {
    const path = base ? `${base}.${f.key}` : f.key;
    const v = src[f.key];
    switch (f.kind) {
      case "text":
      case "textarea": {
        const s = typeof v === "string" ? v.trim() : "";
        if (!s && !f.optional) errors.push({ path, message: `${f.label} can't be empty.` });
        if (s.length > f.max) errors.push({ path, message: `${f.label}: keep it under ${f.max} characters (now ${s.length}).` });
        if (s) out[f.key] = s;
        break;
      }
      case "images": {
        const arr = Array.isArray(v) ? v : [];
        if (arr.length > f.max) errors.push({ path, message: `${f.label}: up to ${f.max} photos.` });
        arr.forEach((img, i) => {
          const p = imageProblem(img);
          if (p) errors.push({ path: `${path}.${i}`, message: p });
        });
        out[f.key] = arr;
        break;
      }
      case "strings": {
        const arr = (Array.isArray(v) ? v : []).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
        if (arr.length > f.max) errors.push({ path, message: `${f.label}: up to ${f.max} items.` });
        arr.forEach((s, i) => s.length > f.itemMax && errors.push({ path: `${path}.${i}`, message: `Keep each item under ${f.itemMax} characters.` }));
        out[f.key] = arr;
        break;
      }
      case "list": {
        const arr = Array.isArray(v) ? v : [];
        if (arr.length > f.max) errors.push({ path, message: `${f.label}: up to ${f.max} items.` });
        out[f.key] = arr.map((item, i) => {
          const r = validateFields(f.fields, item, `${path}.${i}`);
          errors.push(...r.errors);
          if (f.publishable && isObj(item) && item.published === false) r.value.published = false;
          return r.value;
        });
        break;
      }
      case "group": {
        const r = validateFields(f.fields, v, path);
        errors.push(...r.errors);
        if (f.publishable && isObj(v) && v.published === false) r.value.published = false;
        out[f.key] = r.value;
        break;
      }
    }
  }
  return { value: out, errors };
}

/** Every image ref in a page's fields (for the "all images have alt text" check). */
export function collectImages(schema: Field[], value: unknown): unknown[] {
  const src = isObj(value) ? value : {};
  return schema.flatMap((f) => {
    const v = src[f.key];
    if (f.kind === "images") return Array.isArray(v) ? v : [];
    if (f.kind === "list") return (Array.isArray(v) ? v : []).flatMap((item) => collectImages(f.fields, item));
    if (f.kind === "group") return collectImages(f.fields, v);
    return [];
  });
}

/** Strings that would be visible on the site (published items only). */
export function visibleStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visibleStrings);
  if (isObj(value)) {
    if (value.published === false) return [];
    return Object.entries(value).flatMap(([k, v]) => (k === "url" || k === "id" ? [] : visibleStrings(v)));
  }
  return [];
}

// ─── SEO health (docs/06) ────────────────────────────────────────────────────

export type HealthCheck = { id: string; status: "ok" | "warn" | "bad"; message: string };

export const TITLE_RANGE = [30, 60] as const;
export const DESCRIPTION_RANGE = [70, 160] as const;
const PLACEHOLDER = /\[(?:CONFIRM[^\]]*|[A-Z0-9:\s.-]{2,})\](?!\()/;

export function seoHealth(input: {
  schema: PageSchema;
  fields: unknown;
  seoTitle: string;
  seoDescription: string;
  imageAlt: (ref: unknown) => string | null; // alt text for an image ref, or null if none
  nap?: { parts: string[]; gbp: string | null }; // name, street, phone digits as on the site
}): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const t = input.seoTitle.trim();
  const d = input.seoDescription.trim();
  const titleOk = t.length >= TITLE_RANGE[0] && t.length <= TITLE_RANGE[1];
  checks.push({
    id: "title",
    status: titleOk ? "ok" : t.length === 0 ? "bad" : "warn",
    message: titleOk ? `Title is ${t.length} characters` : `Title is ${t.length} characters; aim for ${TITLE_RANGE[0]}–${TITLE_RANGE[1]}`,
  });
  if (input.schema.titleNeedsAkure) {
    const has = /akure/i.test(t);
    checks.push({ id: "akure", status: has ? "ok" : "warn", message: has ? "Title mentions Akure" : "Add “Akure” to the title: it's what guests search for" });
  }
  const descOk = d.length >= DESCRIPTION_RANGE[0] && d.length <= DESCRIPTION_RANGE[1];
  checks.push({
    id: "description",
    status: descOk ? "ok" : d.length === 0 ? "bad" : "warn",
    message: descOk ? `Description is ${d.length} characters` : `Description is ${d.length} characters; aim for ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]}`,
  });
  const f = isObj(input.fields) ? input.fields : {};
  const h1s = input.schema.fields.filter((x) => x.kind === "text" && x.h1);
  const filled = h1s.filter((x) => typeof f[x.key] === "string" && (f[x.key] as string).trim()).length;
  checks.push({ id: "h1", status: filled === 1 ? "ok" : "bad", message: filled === 1 ? "One main heading (H1)" : "Fill in the main heading (H1)" });
  const images = collectImages(input.schema.fields, input.fields);
  const noAlt = images.filter((img) => !input.imageAlt(img)?.trim()).length;
  checks.push({
    id: "alt",
    status: noAlt ? "bad" : "ok",
    message: noAlt ? `${noAlt} photo${noAlt === 1 ? " has" : "s have"} no description` : images.length ? "Every photo has a description" : "No photos on this page",
  });
  const placeholders = visibleStrings(input.fields).filter((s) => PLACEHOLDER.test(s)).length;
  checks.push({
    id: "placeholders",
    status: placeholders ? "warn" : "ok",
    message: placeholders
      ? `${placeholders} item${placeholders === 1 ? " still has" : "s still have"} a [bracket] placeholder; ${placeholders === 1 ? "it stays" : "they stay"} hidden on the site until replaced`
      : "No placeholders left",
  });
  if (input.nap) {
    if (!input.nap.gbp) checks.push({ id: "nap", status: "warn", message: "Enter your Google Business Profile details in Settings to compare" });
    else {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const gbp = norm(input.nap.gbp);
      const same = input.nap.parts.every((part) => gbp.includes(norm(part)));
      checks.push({
        id: "nap",
        status: same ? "ok" : "warn",
        message: same ? "Name, address and phone match Google Business Profile" : "Name, address or phone differs from your Google Business Profile",
      });
    }
  }
  return checks;
}
