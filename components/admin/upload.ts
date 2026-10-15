"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Photo uploads (docs/06 "Gallery"): the browser resizes to at most 2400px on
// the long side and re-encodes, which also strips EXIF data such as the GPS
// location, then posts the file to a one-time Convex storage URL.

export const MAX_EDGE = 2400;
export const MIN_EDGE = 1200;

export type Uploaded = { storageId: Id<"_storage">; url: string | null; width: number; height: number; warning: string | null; name: string };

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // imageOrientation applies the EXIF rotation before we drop the metadata.
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Resized JPEG without metadata. */
export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number; warning: string | null }> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
  const bitmap = await loadBitmap(file);
  const originalLong = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_EDGE / originalLong);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare photos for upload.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error(`Couldn't prepare ${file.name}.`);
  const warning =
    originalLong > MAX_EDGE
      ? `Resized from ${originalLong}px to ${MAX_EDGE}px on the long side.`
      : originalLong < MIN_EDGE
        ? `Only ${originalLong}px wide: it may look soft on large screens. Use a photo at least ${MIN_EDGE}px wide if you have one.`
        : null;
  return { blob, width, height, warning };
}

export function useUpload() {
  const generate = useMutation(api.admin.uploads.generateUploadUrl);
  const confirm = useMutation(api.admin.uploads.confirm);
  return async function upload(file: File): Promise<Uploaded> {
    const { blob, width, height, warning } = await prepareImage(file);
    const postUrl = await generate({});
    const res = await fetch(postUrl, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    if (!res.ok) throw new Error(`Upload of ${file.name} failed. Try again.`);
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    const { url } = await confirm({ storageId });
    return { storageId, url, width, height, warning, name: file.name };
  };
}
