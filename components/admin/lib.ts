"use client";

import { useCallback, useState } from "react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { formatNaira, parseNairaInput } from "@/lib/money";

// Small helpers shared by admin screens.

export type Tone = "ok" | "warn" | "bad" | "info" | "mute";

/** The message a staff member should see for a failed call. */
export function errorText(e: unknown): string {
  if (e instanceof ConvexError && e.data && typeof e.data === "object" && "message" in e.data) {
    return String((e.data as { message: unknown }).message);
  }
  if (e instanceof Error && /network|fetch/i.test(e.message)) return "No connection. Check the internet and try again.";
  return "Something went wrong. Try again, and tell the manager if it keeps happening.";
}

export function errorField(e: unknown): string | undefined {
  return e instanceof ConvexError && e.data && typeof e.data === "object" ? (e.data as { field?: string }).field : undefined;
}

/**
 * Runs a mutation/action with a toast for success or failure ("Saved",
 * "Booking moved to 302"). Returns the result, or undefined if it failed.
 */
export function useRun() {
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setPending(true);
    try {
      const r = await fn();
      if (success) toast.success(typeof success === "function" ? success(r) : success);
      return r;
    } catch (e) {
      toast.error(errorText(e));
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);
  return { run, pending };
}

export const naira = (kobo: number) => formatNaira(kobo);

/** "70000", "70,000" or "₦70,000" → kobo, or null. */
export const toKobo = (input: string) => parseNairaInput(input);

/** Kobo → "70,000" for a price input. */
export const nairaInput = (kobo: number | null | undefined) =>
  kobo == null || kobo === 0 ? "" : new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(kobo / 100);

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
export const formatStamp = (ms: number) => dateTime.format(ms);
export const formatDay = (ms: number) => dateOnly.format(ms);

export function timeAgo(ms: number, now = Date.now()) {
  const m = Math.round((now - ms) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return formatDay(ms);
}

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  reserved: { label: "Reserved", tone: "info" },
  checked_in: { label: "Checked in", tone: "ok" },
  checked_out: { label: "Checked out", tone: "mute" },
  cancelled: { label: "Cancelled", tone: "mute" },
  no_show: { label: "No-show", tone: "bad" },
};

export const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  unpaid: { label: "Due on arrival", tone: "warn" },
  part_paid: { label: "Part paid", tone: "warn" },
  paid: { label: "Paid", tone: "ok" },
};

export const SOURCES = [
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "walk_in", label: "Walk-in" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;
export const sourceLabel = (s: string) => SOURCES.find((x) => x.value === s)?.label ?? s;

export const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Bank transfer" },
  { value: "pos", label: "POS (card)" },
  { value: "other", label: "Other" },
] as const;

/** E.164 → wa.me link. */
export const whatsappLink = (e164: string) => `https://wa.me/${e164.replace(/\D/g, "")}`;

/** Download rows as a CSV file (Excel-friendly UTF-8). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v);
    // Neutralise spreadsheet formulas, then quote.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
