import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { formatNaira } from "../lib/money";
import { formatDate, formatParty, formatPhone, formatTime, plural } from "../lib/format";
import { groupNightly } from "./lib/pricing";
import { getSettings } from "./lib/stays";
import { siteUrl, staffRecipients } from "./lib/email";
import type { BookingEmailModel } from "../emails/model";

const REASON_LABEL: Record<string, string> = { standard: "night", weekend: "weekend night", offer: "night (offer)" };

/** Everything a booking email shows, as display strings. The manage link is added by the caller. */
export const bookingEmail = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    const settings = await getSettings(ctx);
    const roomType = await ctx.db.get(booking.roomTypeId);
    const offer = booking.offerId ? await ctx.db.get(booking.offerId) : null;

    const site = siteUrl();
    const address = [settings.address.street, settings.address.locality, settings.address.region].join(", ");
    const mapsQuery = settings.geo ? `${settings.geo.lat},${settings.geo.lng}` : `${settings.hotelName}, ${address}`;
    const main = settings.phones[0];
    const whatsapp = settings.phones.find((p) => p.whatsapp);

    const model: BookingEmailModel = {
      hotel: {
        name: settings.hotelName,
        address,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
        phone: formatPhone(main.number),
        phoneHref: `tel:${main.number}`,
        whatsappHref: whatsapp ? `https://wa.me/${whatsapp.number.replace(/\D/g, "")}` : null,
        bookingEmail: settings.emails.booking,
        siteUrl: site,
        logoUrl: `${site}/images/selems-logo.png`,
      },
      ref: booking.ref,
      guestFirstName: booking.guest.firstName,
      guestFullName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      guestEmail: booking.guest.email,
      guestPhone: formatPhone(booking.guest.phone),
      roomName: roomType?.name ?? "Room",
      checkIn: formatDate(booking.checkIn),
      checkOut: formatDate(booking.checkOut),
      nights: plural(booking.nights, "night"),
      party: formatParty(booking.adults, booking.children),
      priceLines: groupNightly(booking.nightly).map((g) => {
        const unit = REASON_LABEL[g.reason] ?? `night (${g.reason})`;
        return { label: `${formatNaira(g.rate)} × ${g.count} ${g.count === 1 ? unit : unit.replace("night", "nights")}`, amount: formatNaira(g.rate * g.count) };
      }),
      offerTitle: offer?.title ?? null,
      totalDue: formatNaira(Math.max(0, booking.amountDue - booking.amountPaid)),
      checkInTime: settings.checkInTime ? formatTime(settings.checkInTime) : null,
      checkOutTime: settings.checkOutTime ? formatTime(settings.checkOutTime) : null,
      cancellationPolicy: settings.cancellationPolicy ?? null,
      arrivalWindow: booking.arrivalWindow ?? null,
      specialRequests: booking.specialRequests ?? null,
      manageUrl: null,
      adminUrl: `${site}/admin/reservations/${booking._id}`,
    };
    return {
      model,
      guestEmail: booking.guest.email,
      staff: staffRecipients(settings),
      replyTo: settings.emails.booking,
      reviewUrl: settings.googleReviewUrl ?? null,
    };
  },
});

/** Records an email in the booking's history. */
export const logEmail = internalMutation({
  args: { bookingId: v.id("bookings"), message: v.string(), sent: v.boolean() },
  handler: async (ctx, { bookingId, message, sent }) => {
    await ctx.db.insert("bookingEvents", {
      bookingId,
      type: sent ? "email_sent" : "email_skipped",
      message,
      at: Date.now(),
    });
  },
});

/** Branding and recipients for staff emails. */
export const staffShell = internalQuery({
  args: {},
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    return { hotelName: settings.hotelName, logoUrl: `${siteUrl()}/images/selems-logo.png`, staff: staffRecipients(settings) };
  },
});

export const inviteEmail = internalQuery({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite || invite.usedAt !== undefined) return null;
    const settings = await getSettings(ctx);
    const by = invite.invitedBy
      ? await ctx.db.query("staffProfiles").withIndex("by_user", (q) => q.eq("userId", invite.invitedBy!)).unique()
      : null;
    return {
      invite: { email: invite.email, name: invite.name ?? null, role: invite.role, expiresAt: invite.expiresAt },
      invitedBy: by?.name ?? null,
      shell: { hotelName: settings.hotelName, logoUrl: `${siteUrl()}/images/selems-logo.png` },
    };
  },
});
