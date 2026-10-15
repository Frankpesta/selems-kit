"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CalendarDaysIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/dates";
import { plural } from "@/lib/format";
import {
  adultsLabel,
  childrenLabel,
  datesLabel,
  fieldControl,
  fieldLabel,
  datesSpan,
  gridClass,
  stayNights,
  useTodayLagos,
  type Stay,
  type StayControl,
} from "./stay-shared";

export type { Stay } from "./stay-shared";

// Dates + guests control shared by the availability bar, the room booking card
// and the booking flow. Business dates stay "YYYY-MM-DD" strings; Date objects
// exist only inside the calendar widget.

const RangeCalendar = dynamic(() => import("./RangeCalendar"), {
  ssr: false,
  loading: () => <div className="h-[372px] w-[308px] min-[760px]:w-[616px]" aria-hidden="true" />,
});
const preloadCalendar = () => void import("./RangeCalendar");


const toDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function StayPicker({
  value,
  onChange,
  maxAdults = 4,
  maxChildren = 3,
  maxNights = 30,
  windowDays = 365,
  idPrefix = "stay",
  layout = "bar",
  autoOpen,
}: {
  value: Stay;
  onChange: (next: Stay) => void;
  maxAdults?: number;
  maxChildren?: number;
  maxNights?: number;
  windowDays?: number;
  idPrefix?: string;
  layout?: "bar" | "stack";
  /** Open this control on mount (used when swapping in for the stand-in). */
  autoOpen?: StayControl;
}) {
  const today = useTodayLagos();
  const [open, setOpen] = useState(autoOpen === "dates");
  const { checkIn, checkOut } = value;
  const nights = stayNights(value);

  const selected: DateRange | undefined = checkIn
    ? { from: toDate(checkIn), to: checkOut ? toDate(checkOut) : undefined }
    : undefined;

  function pick(range: DateRange | undefined) {
    const from = range?.from ? toYmd(range.from) : "";
    let to = range?.to ? toYmd(range.to) : "";
    if (to && to <= from) to = "";
    onChange({ ...value, checkIn: from, checkOut: to });
    if (from && to) setOpen(false);
  }

  const label = datesLabel(value);

  const options = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <div
      className={cn(
        "grid gap-4",
        gridClass(layout),
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-1.5", datesSpan(layout))}>
        <span id={`${idPrefix}-dates-label`} className={fieldLabel}>
          Check-in → check-out
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-labelledby={`${idPrefix}-dates-label ${idPrefix}-dates-value`}
              onPointerEnter={preloadCalendar}
              onFocus={preloadCalendar}
              className={cn(fieldControl, "flex items-center justify-between gap-3")}
            >
              <span id={`${idPrefix}-dates-value`} className={cn("truncate", !checkIn && "text-muted-foreground")}>
                {label}
              </span>
              <span className="flex flex-none items-center gap-2 text-sm text-muted-foreground">
                {nights > 0 ? plural(nights, "night") : null}
                <CalendarDaysIcon className="size-5 text-amber" strokeWidth={1.6} aria-hidden="true" />
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto rounded-sm border-line p-0 shadow-[0_18px_40px_rgba(23,34,45,.16)]">
            {today ? (
              <RangeCalendar
                selected={selected}
                onSelect={pick}
                fromDate={toDate(today)}
                toDate={toDate(addDays(today, windowDays))}
                maxNights={maxNights}
              />
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 text-sm">
              <span className="text-body">
                {nights > 0 ? `${plural(nights, "night")} · ${label}` : checkIn ? "Now choose your check-out date" : "Choose your check-in date"}
              </span>
              {checkIn ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, checkIn: "", checkOut: "" })}
                  className="min-h-11 px-2 font-semibold text-amber hover:text-amber-dark"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span id={`${idPrefix}-adults-label`} className={fieldLabel}>
          Adults
        </span>
        <Select defaultOpen={autoOpen === "adults"} value={String(value.adults)} onValueChange={(v) => onChange({ ...value, adults: Number(v) })}>
          <SelectTrigger aria-labelledby={`${idPrefix}-adults-label`} className={cn(fieldControl, "h-12 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="rounded-sm">
            {options(1, maxAdults).map((n) => (
              <SelectItem key={n} value={String(n)} className="min-h-11">
                {adultsLabel(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span id={`${idPrefix}-children-label`} className={fieldLabel}>
          Children
        </span>
        <Select defaultOpen={autoOpen === "children"} value={String(value.children)} onValueChange={(v) => onChange({ ...value, children: Number(v) })}>
          <SelectTrigger aria-labelledby={`${idPrefix}-children-label`} className={cn(fieldControl, "h-12 w-full")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="rounded-sm">
            {options(0, maxChildren).map((n) => (
              <SelectItem key={n} value={String(n)} className="min-h-11">
                {childrenLabel(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
