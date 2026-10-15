import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { inquirySubject } from "./schema";
import { getSettings } from "./lib/stays";
import { siteUrl, staffRecipients } from "./lib/email";

export const create = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: inquirySubject,
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const inquiryId = await ctx.db.insert("inquiries", { ...args, status: "new", createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.emails.staffNewInquiry, { inquiryId });
    return inquiryId;
  },
});

/** Data for the front-desk inquiry alert. */
export const forEmail = internalQuery({
  args: { inquiryId: v.id("inquiries") },
  handler: async (ctx, { inquiryId }) => {
    const inquiry = await ctx.db.get(inquiryId);
    if (!inquiry) return null;
    const settings = await getSettings(ctx);
    return {
      inquiry,
      hotelName: settings.hotelName,
      staff: staffRecipients(settings),
      adminUrl: `${siteUrl()}/admin/inquiries`,
      logoUrl: `${siteUrl()}/images/selems-logo.png`,
    };
  },
});
