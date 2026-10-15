import { appError } from "./errors";
import { hasPlaceholder } from "./content";
import type { StoredImage } from "./images";

// Validation shared by the admin content functions.

export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 60;

export const MAX_ALT = 200;

/** Trims alt text and checks each image points somewhere and has real dimensions. */
export function cleanImages(images: StoredImage[]): StoredImage[] {
  return images.map((img, i) => {
    if (!img.storageId && !img.src) throw appError("INVALID_INPUT", `Photo ${i + 1} is missing its file.`, "images");
    if (img.src && !img.src.startsWith("/images/") && !/^https:\/\//.test(img.src)) {
      throw appError("INVALID_INPUT", `Photo ${i + 1} has an invalid address.`, "images");
    }
    if (!(img.width > 0 && img.height > 0)) throw appError("INVALID_INPUT", `Photo ${i + 1} is missing its size.`, "images");
    const alt = img.alt.trim().replace(/\s+/g, " ");
    if (alt.length > MAX_ALT) throw appError("INVALID_INPUT", `Keep photo descriptions under ${MAX_ALT} characters.`, "images");
    return { ...img, alt };
  });
}

/**
 * CLAUDE.md rule 6: a photo can't go on the website without a description.
 * `who` completes the sentence "… needs a description".
 */
export function assertImagesHaveAlt(images: StoredImage[], who = "Every photo") {
  const missing = images.findIndex((i) => !i.alt.trim());
  if (missing >= 0) {
    throw appError(
      "INVALID_INPUT",
      images.length === 1
        ? "Describe the photo (alt text) before publishing it."
        : `${who} needs a description: photo ${missing + 1} has none.`,
      "images",
    );
  }
}

/** Rejects text that still holds a [CONFIRM] marker from going live. */
export function assertNoPlaceholder(text: string | undefined, field: string, label: string) {
  if (text && hasPlaceholder(text)) {
    throw appError("INVALID_INPUT", `${label} still contains a [CONFIRM] note. Replace it with the real detail.`, field);
  }
}

export function requiredText(value: string, field: string, label: string, max: number): string {
  const t = value.trim();
  if (!t) throw appError("INVALID_INPUT", `Enter ${label}.`, field);
  if (t.length > max) throw appError("INVALID_INPUT", `Keep ${label} under ${max} characters.`, field);
  return t;
}

export function optionalText(value: string | undefined, field: string, label: string, max: number): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  if (t.length > max) throw appError("INVALID_INPUT", `Keep ${label} under ${max} characters.`, field);
  return t;
}
