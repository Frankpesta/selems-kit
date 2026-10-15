import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { appError } from "../lib/errors";
import { rateLimiter } from "../lib/rateLimits";
import { verifyTurnstile } from "../lib/turnstile";
import { MAX_NAME, isValidEmail, normaliseEmail, normalisePhone } from "../lib/validators";
import { inquirySubject } from "../schema";

export const MAX_MESSAGE = 2000;

/** Contact form (docs/04): bot check + rate limits, then store and alert the front desk. */
export const submit = action({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: inquirySubject,
    message: v.string(),
    turnstileToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true }> => {
    const name = args.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > MAX_NAME * 2) throw appError("INVALID_INPUT", "Enter your name.", "name");
    if (!isValidEmail(args.email)) throw appError("INVALID_INPUT", "Enter a valid email address.", "email");
    const phoneRaw = args.phone?.trim();
    const phone = phoneRaw && phoneRaw !== "+234" ? normalisePhone(phoneRaw) : undefined;
    if (phone === null) throw appError("INVALID_INPUT", "Enter a valid phone number, or leave it blank.", "phone");
    const message = args.message.trim();
    if (message.length < 2) throw appError("INVALID_INPUT", "Write a short message.", "message");
    if (message.length > MAX_MESSAGE) {
      throw appError("INVALID_INPUT", `Keep your message under ${MAX_MESSAGE} characters.`, "message");
    }

    const { ip } = await ctx.meta.getRequestMetadata();
    if (!(await verifyTurnstile(args.turnstileToken, ip))) {
      throw appError("FORBIDDEN", "We couldn't verify this request. Please refresh the page and try again.");
    }
    const email = normaliseEmail(args.email);
    const limits = await Promise.all([
      rateLimiter.limit(ctx, "inquiryByEmail", { key: email }),
      ...(ip ? [rateLimiter.limit(ctx, "inquiryByIp", { key: ip })] : []),
    ]);
    if (limits.some((l) => !l.ok)) {
      throw appError("RATE_LIMITED", "You've sent several messages already. Please call or WhatsApp us instead.");
    }

    await ctx.runMutation(internal.inquiries.create, {
      name,
      email,
      phone: phone ?? undefined,
      subject: args.subject,
      message,
    });
    return { ok: true };
  },
});
