import { ConvexError } from "convex/values";

// Stable error codes the UI maps to friendly messages (docs/04).
export type ErrorCode =
  | "SOLD_OUT"
  | "INVALID_DATES"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "UNKNOWN"; // client-side fallback when a request fails

export type AppErrorData = { code: ErrorCode; message: string; field?: string };

export function appError(code: ErrorCode, message: string, field?: string) {
  return new ConvexError<AppErrorData>(field ? { code, message, field } : { code, message });
}
