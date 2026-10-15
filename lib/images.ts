import manifest from "@/content/images.json";

// Resolves an image reference in page copy to { url, alt, width, height }.
// Seed copy stores "/images/…" paths (alt text and size come from the photo
// manifest); admin-picked images are stored as full objects.
export type SiteImage = { url: string; alt: string; width: number; height: number };

const known = manifest as Record<string, { alt: string; width: number; height: number }>;

export function siteImage(ref: unknown): SiteImage | null {
  if (typeof ref === "string") {
    const m = known[ref];
    return m ? { url: ref, alt: m.alt, width: m.width, height: m.height } : null;
  }
  if (ref && typeof ref === "object" && "url" in ref && "alt" in ref) {
    const r = ref as SiteImage;
    return r.alt?.trim() ? r : null; // never render an image without alt text
  }
  return null;
}

export const siteImages = (refs: unknown): SiteImage[] =>
  Array.isArray(refs) ? refs.map(siteImage).filter((i): i is SiteImage => i !== null) : [];
