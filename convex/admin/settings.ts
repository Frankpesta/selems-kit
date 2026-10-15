import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { ALL_TAGS, audit, revalidate } from "../lib/audit";
import { appError } from "../lib/errors";
import { getSettings } from "../lib/stays";
import { isValidEmail, normaliseEmail, normalisePhone } from "../lib/validators";
import { optionalText, requiredText } from "../lib/adminValidators";

// Hotel settings (docs/06, admin only). Saving refreshes every public page,
// because the name, address and phone (NAP) appear site-wide.

export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getSettings(ctx);
  },
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const optUrl = (value: string | undefined, field: string) => {
  const u = value?.trim();
  if (!u) return undefined;
  if (!/^https:\/\/[^\s]+$/.test(u) || u.length > 500) throw appError("INVALID_INPUT", "Enter a full https:// link.", field);
  return u;
};

const time = (value: string | undefined, field: string) => {
  const t = value?.trim();
  if (!t) return undefined;
  if (!HHMM.test(t)) throw appError("INVALID_INPUT", "Use 24-hour time, e.g. 14:00.", field);
  return t;
};

export const save = mutation({
  args: {
    hotelName: v.string(),
    address: v.object({ street: v.string(), locality: v.string(), region: v.string(), country: v.string(), postalCode: v.optional(v.string()) }),
    geo: v.optional(v.object({ lat: v.number(), lng: v.number() })),
    phones: v.array(v.object({ label: v.string(), number: v.string(), whatsapp: v.boolean() })),
    emails: v.object({ booking: v.string(), info: v.string() }),
    checkInTime: v.optional(v.string()),
    checkOutTime: v.optional(v.string()),
    noShowCutoff: v.string(),
    autoCancelNoShows: v.boolean(),
    cancellationPolicy: v.optional(v.string()),
    freeCancellationHours: v.optional(v.number()),
    childrenPolicy: v.optional(v.string()),
    taxNote: v.optional(v.string()),
    maxNights: v.number(),
    bookingWindowDays: v.number(),
    socials: v.object({ facebook: v.optional(v.string()), instagram: v.optional(v.string()), x: v.optional(v.string()), tiktok: v.optional(v.string()) }),
    googleBusinessUrl: v.optional(v.string()),
    googleReviewUrl: v.optional(v.string()),
    mapEmbedUrl: v.optional(v.string()),
    gbpNap: v.optional(v.string()),
    staffAlertEmails: v.optional(v.array(v.string())),
  },
  handler: async (ctx, a) => {
    const me = await requireAdmin(ctx);
    const current = await getSettings(ctx);

    const phones = a.phones.map((p, i) => {
      const number = normalisePhone(p.number);
      if (!number) throw appError("INVALID_INPUT", `Phone ${i + 1} isn't a valid number.`, `phones.${i}`);
      return { label: requiredText(p.label, `phones.${i}.label`, "a label for each phone", 30), number, whatsapp: p.whatsapp };
    });
    if (phones.length === 0) throw appError("INVALID_INPUT", "Add at least one phone number.", "phones");
    for (const [k, e] of Object.entries(a.emails)) {
      if (!isValidEmail(e)) throw appError("INVALID_INPUT", "Enter a valid email address.", `emails.${k}`);
    }
    const alerts = (a.staffAlertEmails ?? []).map((e) => e.trim()).filter(Boolean);
    const badAlert = alerts.find((e) => !isValidEmail(e));
    if (badAlert) throw appError("INVALID_INPUT", `${badAlert} isn't a valid email address.`, "staffAlertEmails");
    if (a.geo && !(Math.abs(a.geo.lat) <= 90 && Math.abs(a.geo.lng) <= 180)) throw appError("INVALID_INPUT", "Enter a valid latitude and longitude.", "geo");
    const noShowCutoff = time(a.noShowCutoff, "noShowCutoff");
    if (!noShowCutoff) throw appError("INVALID_INPUT", "Set the no-show cut-off time.", "noShowCutoff");
    if (a.freeCancellationHours !== undefined && !(Number.isInteger(a.freeCancellationHours) && a.freeCancellationHours >= 0 && a.freeCancellationHours <= 720)) {
      throw appError("INVALID_INPUT", "Enter a whole number of hours (0–720).", "freeCancellationHours");
    }
    if (!Number.isInteger(a.maxNights) || a.maxNights < 1 || a.maxNights > 90) throw appError("INVALID_INPUT", "Enter 1–90 nights.", "maxNights");
    if (!Number.isInteger(a.bookingWindowDays) || a.bookingWindowDays < 7 || a.bookingWindowDays > 730) {
      throw appError("INVALID_INPUT", "Enter 7–730 days.", "bookingWindowDays");
    }

    const next = {
      hotelName: requiredText(a.hotelName, "hotelName", "the hotel name", 80),
      address: {
        street: requiredText(a.address.street, "address.street", "the street address", 120),
        locality: requiredText(a.address.locality, "address.locality", "the town", 60),
        region: requiredText(a.address.region, "address.region", "the state", 60),
        country: requiredText(a.address.country, "address.country", "the country code", 2).toUpperCase(),
        postalCode: optionalText(a.address.postalCode, "address.postalCode", "the postcode", 12),
      },
      geo: a.geo,
      phones,
      emails: { booking: normaliseEmail(a.emails.booking), info: normaliseEmail(a.emails.info) },
      checkInTime: time(a.checkInTime, "checkInTime"),
      checkOutTime: time(a.checkOutTime, "checkOutTime"),
      noShowCutoff,
      autoCancelNoShows: a.autoCancelNoShows,
      cancellationPolicy: optionalText(a.cancellationPolicy, "cancellationPolicy", "the cancellation policy", 1000),
      freeCancellationHours: a.freeCancellationHours,
      childrenPolicy: optionalText(a.childrenPolicy, "childrenPolicy", "the children policy", 500),
      taxNote: optionalText(a.taxNote, "taxNote", "the tax note", 120),
      maxNights: a.maxNights,
      bookingWindowDays: a.bookingWindowDays,
      socials: {
        facebook: optUrl(a.socials.facebook, "socials.facebook"),
        instagram: optUrl(a.socials.instagram, "socials.instagram"),
        x: optUrl(a.socials.x, "socials.x"),
        tiktok: optUrl(a.socials.tiktok, "socials.tiktok"),
      },
      googleBusinessUrl: optUrl(a.googleBusinessUrl, "googleBusinessUrl"),
      googleReviewUrl: optUrl(a.googleReviewUrl, "googleReviewUrl"),
      mapEmbedUrl: optUrl(a.mapEmbedUrl, "mapEmbedUrl"),
      gbpNap: optionalText(a.gbpNap, "gbpNap", "the Google Business Profile details", 300),
      staffAlertEmails: alerts.length ? alerts.map(normaliseEmail) : undefined,
      updatedAt: Date.now(),
    };
    await ctx.db.replace(current._id, { key: "hotel", ...next });
    await audit(ctx, me, "settings.save", "settings", current._id, "Hotel settings saved");
    await revalidate(ctx, ALL_TAGS);
  },
});
