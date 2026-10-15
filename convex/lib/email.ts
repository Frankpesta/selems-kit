import { Resend } from "@convex-dev/resend";
import { components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

// Resend component (docs/04 "Email"). Test mode (delivery only to @resend.dev
// test addresses) stays on unless RESEND_TEST_MODE=false is set on the deployment.
export const resend: Resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

export const emailFrom = () => process.env.EMAIL_FROM ?? "Selems Hotel <bookings@selemsexclusivehotel.com>";

export const siteUrl = () => (process.env.SITE_URL ?? "https://selemsexclusivehotel.com").replace(/\/$/, "");

/** True until a real Resend key is configured; emails are then logged, not sent. */
export const emailDisabled = () => {
  const key = process.env.RESEND_API_KEY;
  return !key || key.startsWith("re_placeholder");
};

/** Front-desk recipients: Settings first, then the STAFF_ALERT_EMAILS env var, then the booking mailbox. */
export function staffRecipients(settings: Pick<Doc<"settings">, "staffAlertEmails" | "emails">): string[] {
  if (settings.staffAlertEmails?.length) return settings.staffAlertEmails;
  const env = (process.env.STAFF_ALERT_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return env.length ? env : [settings.emails.booking];
}
