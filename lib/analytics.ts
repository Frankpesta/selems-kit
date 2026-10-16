// GA4 events (docs/07 "Measurement"). A no-op until the visitor consents and
// gtag has loaded (components/site/Analytics.tsx). Never pass personal data.

export type AnalyticsEvent =
  | "view_room"
  | "check_availability"
  | "begin_booking"
  | "booking_reserved"
  | "click_call"
  | "click_whatsapp"
  | "submit_inquiry";

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

export function track(name: AnalyticsEvent, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  (window as { gtag?: Gtag }).gtag?.("event", name, params);
}

export const CONSENT_KEY = "selems_analytics_consent";
