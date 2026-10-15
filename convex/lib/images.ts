import type { QueryCtx } from "../_generated/server";
import type { Infer } from "convex/values";
import type { image } from "../schema";

export type StoredImage = Infer<typeof image>;
export type PublicImage = { url: string; alt: string; width: number; height: number };

/** Seed photos are served from /public; admin uploads from Convex file storage. */
export async function resolveImage(ctx: QueryCtx, img: StoredImage | undefined): Promise<PublicImage | null> {
  if (!img) return null;
  const url = img.storageId ? await ctx.storage.getUrl(img.storageId) : (img.src ?? null);
  if (!url) return null;
  return { url, alt: img.alt, width: img.width, height: img.height };
}

/** URL for any stored image (admin views show photos still missing alt text). */
export const imageUrl = async (ctx: QueryCtx, img: StoredImage): Promise<string | null> =>
  img.storageId ? await ctx.storage.getUrl(img.storageId) : (img.src ?? null);
