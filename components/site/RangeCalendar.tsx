"use client";

import { useSyncExternalStore } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

// The stay calendar: shadcn Calendar in range mode, two months on wide screens.
// Loaded on demand by StayPicker so content pages don't ship it up front.

const wideQuery = "(min-width: 760px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(wideQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(wideQuery).matches, () => true);

export default function RangeCalendar({
  selected,
  onSelect,
  fromDate,
  toDate,
  maxNights,
}: {
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  fromDate: Date;
  toDate: Date;
  maxNights: number;
}) {
  const wide = useWide();
  return (
    <Calendar
      mode="range"
      selected={selected}
      onSelect={onSelect}
      numberOfMonths={wide ? 2 : 1}
      defaultMonth={selected?.from ?? fromDate}
      startMonth={fromDate}
      endMonth={toDate}
      disabled={[{ before: fromDate }, { after: toDate }]}
      min={1}
      max={maxNights}
      weekStartsOn={1}
      className="p-3 [--cell-size:--spacing(11)]"
    />
  );
}
