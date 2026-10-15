"use client";

import { useSyncExternalStore } from "react";
import { nightsBetween, todayLagos } from "@/lib/dates";
import { formatDateShort, plural } from "@/lib/format";

// Shared by StayPicker and its lightweight stand-in (no Radix imports here).

export type Stay = { checkIn: string; checkOut: string; adults: number; children: number };
export type StayControl = "dates" | "adults" | "children";

const noop = () => () => {};
/** Today's Lagos date on the client only; undefined while prerendering (no clock reads on the server). */
export const useTodayLagos = () => useSyncExternalStore(noop, () => todayLagos(), () => undefined);

export const fieldLabel = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";
export const fieldControl =
  "min-h-12 w-full rounded-sm border border-line-strong bg-paper px-3.5 text-left text-[15px] text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber data-[state=open]:border-amber";

export const stayNights = (s: Pick<Stay, "checkIn" | "checkOut">) =>
  s.checkIn && s.checkOut ? nightsBetween(s.checkIn, s.checkOut) : 0;

export const datesLabel = ({ checkIn, checkOut }: Pick<Stay, "checkIn" | "checkOut">) =>
  checkIn && checkOut
    ? `${formatDateShort(checkIn)} → ${formatDateShort(checkOut)}`
    : checkIn
      ? `${formatDateShort(checkIn)} → choose check-out`
      : "Choose your dates";

export const adultsLabel = (n: number) => plural(n, "adult");
export const childrenLabel = (n: number) => (n === 0 ? "No children" : plural(n, "child", "children"));

export const gridClass = (layout: "bar" | "stack") =>
  layout === "bar" ? "grid-cols-2 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-2";

/** The date field spans the full width except in the desktop bar layout. */
export const datesSpan = (layout: "bar" | "stack") =>
  layout === "bar" ? "col-span-2 min-[980px]:col-span-1" : "col-span-2";
