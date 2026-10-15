import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { appError } from "../lib/errors";

// Photo uploads to Convex file storage (docs/04 "Uploads"). The browser resizes
// and strips location data first, posts the file to a one-time URL, then saves
// `{ storageId, alt, width, height }` on the room type, gallery item or offer.

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/** Checks an uploaded file is a reasonable image and returns its URL for preview. */
export const confirm = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw appError("NOT_FOUND", "The upload didn't arrive. Try again.");
    if (!meta.contentType || !ALLOWED.has(meta.contentType) || meta.size > MAX_UPLOAD_BYTES) {
      await ctx.storage.delete(storageId);
      throw appError("INVALID_INPUT", "Upload a JPEG, PNG, WebP or AVIF photo under 8 MB.");
    }
    return { url: await ctx.storage.getUrl(storageId) };
  },
});

export const url = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    return ctx.storage.getUrl(storageId);
  },
});
