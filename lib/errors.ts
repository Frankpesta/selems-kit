import { ConvexError } from "convex/values";

// Friendly messages for Convex errors thrown by public functions (convex/lib/errors.ts).
export type AppError = { code: string; message: string; field?: string };

export function toAppError(e: unknown): AppError {
  if (e instanceof ConvexError && e.data && typeof e.data === "object" && "code" in e.data) {
    return e.data as AppError;
  }
  return {
    code: "UNKNOWN",
    message: "Something went wrong on our side. Please try again, or call or WhatsApp the front desk.",
  };
}
