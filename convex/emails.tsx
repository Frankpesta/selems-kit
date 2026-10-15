"use node";

import { v } from "convex/values";
import type { ReactElement } from "react";
import { render } from "react-email";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { emailDisabled, emailFrom, resend, siteUrl } from "./lib/email";
import { BookingConfirmation } from "../emails/BookingConfirmation";
import { StaffNewBooking } from "../emails/StaffNewBooking";
import { BookingCancelled } from "../emails/BookingCancelled";
import { StaffNewInquiry } from "../emails/StaffNewInquiry";
import { BookingChanged } from "../emails/BookingChanged";
import { PreArrival } from "../emails/PreArrival";
import { ReviewRequest } from "../emails/ReviewRequest";
import { AuthCode, StaffAlert, StaffInvite } from "../emails/StaffEmails";
import { formatPhone } from "../lib/format";

// Transactional booking emails (docs/04). React Email needs Node, so rendering
// happens here; queueing, retries and delivery tracking are the Resend component's.

async function send(
  ctx: ActionCtx,
  opts: {
    bookingId: Id<"bookings">;
    to: string[];
    replyTo: string;
    subject: string;
    element: ReactElement;
    label: string;
    idempotencyKey: string;
  },
) {
  const to = opts.to.filter(Boolean);
  if (to.length === 0) return;
  if (emailDisabled()) {
    console.log(`[email skipped: no Resend key] ${opts.subject} → ${to.length} recipient(s)`);
    await ctx.runMutation(internal.emailData.logEmail, {
      bookingId: opts.bookingId,
      message: `${opts.label} not sent: email is not configured yet.`,
      sent: false,
    });
    return;
  }
  const html = await render(opts.element);
  const text = await render(opts.element, { plainText: true });
  await resend.sendEmail(ctx, {
    from: emailFrom(),
    to,
    replyTo: [opts.replyTo],
    subject: opts.subject,
    html,
    text,
    idempotencyKey: opts.idempotencyKey,
  });
  await ctx.runMutation(internal.emailData.logEmail, {
    bookingId: opts.bookingId,
    message: `${opts.label} emailed to ${to.join(", ")}.`,
    sent: true,
  });
}

export const bookingConfirmation = internalAction({
  args: { bookingId: v.id("bookings"), token: v.string() },
  handler: async (ctx, { bookingId, token }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data) return;
    const m = { ...data.model, manageUrl: `${siteUrl()}/booking/${data.model.ref}?t=${encodeURIComponent(token)}` };
    await send(ctx, {
      bookingId,
      to: [data.guestEmail],
      replyTo: data.replyTo,
      subject: `Booking confirmed: ${m.roomName}, ${m.checkIn} (${m.ref})`,
      element: <BookingConfirmation m={m} />,
      label: "Confirmation",
      idempotencyKey: `confirmation:${bookingId}`,
    });
  },
});

export const staffNewBooking = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data) return;
    await send(ctx, {
      bookingId,
      to: data.staff,
      replyTo: data.model.guestEmail,
      subject: `New booking ${data.model.ref}: ${data.model.roomName}, ${data.model.checkIn}`,
      element: <StaffNewBooking m={data.model} />,
      label: "Front-desk alert",
      idempotencyKey: `staff-new:${bookingId}`,
    });
  },
});

export const bookingCancelled = internalAction({
  args: { bookingId: v.id("bookings"), by: v.union(v.literal("guest"), v.literal("staff")) },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data) return;
    await send(ctx, {
      bookingId,
      to: [data.guestEmail],
      replyTo: data.replyTo,
      subject: `Booking cancelled (${data.model.ref})`,
      element: <BookingCancelled m={data.model} audience="guest" />,
      label: "Cancellation",
      idempotencyKey: `cancelled-guest:${bookingId}`,
    });
    await send(ctx, {
      bookingId,
      to: data.staff,
      replyTo: data.model.guestEmail,
      subject: `Cancelled: ${data.model.ref}, ${data.model.roomName}, ${data.model.checkIn}`,
      element: <BookingCancelled m={data.model} audience="staff" />,
      label: "Front-desk cancellation alert",
      idempotencyKey: `cancelled-staff:${bookingId}`,
    });
  },
});

const SUBJECTS: Record<string, string> = {
  reservation: "Reservation enquiry",
  group: "Group or event booking",
  request: "Request",
  suggestion: "Suggestion",
  testimony: "Testimony",
  complaint: "Complaint",
};

const received = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export const staffNewInquiry = internalAction({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const data = await ctx.runQuery(internal.inquiries.forEmail, { inquiryId });
    if (!data || data.staff.length === 0) return;
    const { inquiry } = data;
    const subject = SUBJECTS[inquiry.subject] ?? inquiry.subject;
    if (emailDisabled()) {
      console.log(`[email skipped: no Resend key] inquiry from ${inquiry.name}`);
      return;
    }
    const element = (
      <StaffNewInquiry
        m={{
          hotelName: data.hotelName,
          logoUrl: data.logoUrl,
          adminUrl: data.adminUrl,
          subject,
          name: inquiry.name,
          email: inquiry.email,
          phone: inquiry.phone ? formatPhone(inquiry.phone) : null,
          message: inquiry.message,
          receivedAt: received.format(inquiry.createdAt),
        }}
      />
    );
    await resend.sendEmail(ctx, {
      from: emailFrom(),
      to: data.staff,
      replyTo: [inquiry.email],
      subject: `${subject}: ${inquiry.name}`,
      html: await render(element),
      text: await render(element, { plainText: true }),
      idempotencyKey: `inquiry:${inquiryId}`,
    });
  },
});

export const bookingChanged = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data) return;
    await send(ctx, {
      bookingId,
      to: [data.guestEmail],
      replyTo: data.replyTo,
      subject: `Booking updated: ${data.model.roomName}, ${data.model.checkIn} (${data.model.ref})`,
      element: <BookingChanged m={data.model} />,
      label: "Change notice",
      idempotencyKey: `changed:${bookingId}:${Date.now()}`,
    });
  },
});

export const preArrival = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data) return;
    await send(ctx, {
      bookingId,
      to: [data.guestEmail],
      replyTo: data.replyTo,
      subject: `See you tomorrow: ${data.model.roomName}, ${data.model.checkIn} (${data.model.ref})`,
      element: <PreArrival m={data.model} />,
      label: "Pre-arrival reminder",
      idempotencyKey: `pre-arrival:${bookingId}`,
    });
  },
});

export const reviewRequest = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const data = await ctx.runQuery(internal.emailData.bookingEmail, { bookingId });
    if (!data?.reviewUrl) return;
    await send(ctx, {
      bookingId,
      to: [data.guestEmail],
      replyTo: data.replyTo,
      subject: `How was your stay, ${data.model.guestFirstName}?`,
      element: <ReviewRequest m={data.model} reviewUrl={data.reviewUrl} />,
      label: "Review request",
      idempotencyKey: `review:${bookingId}`,
    });
  },
});

/** Sends a staff email that isn't about one booking (invites, codes, alerts). */
async function sendStaff(ctx: ActionCtx, opts: { to: string[]; subject: string; element: ReactElement; idempotencyKey: string; devLog?: string }) {
  const to = opts.to.filter(Boolean);
  if (to.length === 0) return;
  if (emailDisabled()) {
    // Development only: with no Resend key, codes and links go to the Convex logs.
    console.log(`[email skipped: no Resend key] ${opts.subject}${opts.devLog ? ` · ${opts.devLog}` : ""}`);
    return;
  }
  await resend.sendEmail(ctx, {
    from: emailFrom(),
    to,
    subject: opts.subject,
    html: await render(opts.element),
    text: await render(opts.element, { plainText: true }),
    idempotencyKey: opts.idempotencyKey,
  });
}

const inviteExpiry = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Lagos" });

export const staffInvite = internalAction({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const data = await ctx.runQuery(internal.emailData.inviteEmail, { inviteId });
    if (!data) return;
    const url = `${siteUrl()}/admin/login?mode=signup&email=${encodeURIComponent(data.invite.email)}`;
    await sendStaff(ctx, {
      to: [data.invite.email],
      subject: `Your ${data.shell.hotelName} staff account`,
      element: (
        <StaffInvite
          s={data.shell}
          name={data.invite.name ?? data.invite.email}
          role={data.invite.role}
          url={url}
          invitedBy={data.invitedBy}
          expires={inviteExpiry.format(data.invite.expiresAt)}
        />
      ),
      idempotencyKey: `invite:${inviteId}:${data.invite.expiresAt}`,
      devLog: `${data.invite.email} → ${url}`,
    });
  },
});

/** One-time codes for sign-up verification and password reset (convex/auth.ts). */
export const authCode = internalAction({
  args: { email: v.string(), code: v.string(), purpose: v.union(v.literal("verify"), v.literal("reset")) },
  handler: async (ctx, { email, code, purpose }) => {
    const shell = await ctx.runQuery(internal.emailData.staffShell, {});
    await sendStaff(ctx, {
      to: [email],
      subject: purpose === "reset" ? `Reset your ${shell.hotelName} password` : `Confirm your ${shell.hotelName} staff account`,
      element: <AuthCode s={shell} code={code} purpose={purpose} />,
      idempotencyKey: `code:${purpose}:${email}:${code}`,
      devLog: `${purpose} code for ${email}: ${code}`,
    });
  },
});

/** Front-desk alert (late arrivals). */
export const staffAlert = internalAction({
  args: { title: v.string(), lines: v.array(v.string()), path: v.string(), action: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const shell = await ctx.runQuery(internal.emailData.staffShell, {});
    await sendStaff(ctx, {
      to: shell.staff,
      subject: args.title,
      element: <StaffAlert s={shell} title={args.title} lines={args.lines} url={`${siteUrl()}${args.path}`} action={args.action} />,
      idempotencyKey: args.key,
    });
  },
});
