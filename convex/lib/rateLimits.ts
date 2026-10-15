import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

// Abuse limits for public forms (docs/04). Keys are normalised email, E.164
// phone or client IP. The IP limits are generous: a hotel lobby, an office or a
// mobile carrier can put many real guests behind one address.
// RESERVE_IP_LIMIT_PER_HOUR overrides the per-IP booking limit (dev/CI only).
const ipLimit = Number(process.env.RESERVE_IP_LIMIT_PER_HOUR) || 20;
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  reserveByEmail: { kind: "fixed window", rate: 5, period: HOUR },
  reserveByPhone: { kind: "fixed window", rate: 5, period: HOUR },
  reserveByIp: { kind: "fixed window", rate: ipLimit, period: HOUR },
  reserveGlobal: { kind: "token bucket", rate: 60, period: MINUTE },
  inquiryByEmail: { kind: "fixed window", rate: 3, period: HOUR },
  inquiryByIp: { kind: "fixed window", rate: 10, period: HOUR },
  guestCancelByRef: { kind: "fixed window", rate: 10, period: HOUR },
});
