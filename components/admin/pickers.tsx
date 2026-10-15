"use client";

import { useState } from "react";
import { CalendarDaysIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays } from "@/lib/dates";
import { formatDate, formatTime } from "@/lib/format";
import { inputClass } from "./ui";

// shadcn-based pickers for the admin, sized like the other admin controls
// (44px). They take the id/aria props FormField hands out, so labels, hints
// and errors stay connected.

type Aria = { id?: string; "aria-label"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };
export type Option = { value: string; label: string; disabled?: boolean };

// Radix Select can't use "" as an item value; map it to a sentinel.
const EMPTY = "__empty__";

const triggerClass = (className?: string) =>
  cn(inputClass, "flex h-auto w-full items-center justify-between gap-2 text-left data-placeholder:text-muted [&>span]:truncate", className);

/** A dropdown of options (shadcn Select). `value` "" selects the option whose value is "". */
export function Choice({
  value,
  onChange,
  options,
  placeholder = "Choose…",
  className,
  disabled,
  ...aria
}: Aria & {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const hasEmpty = options.some((o) => o.value === "");
  return (
    <Select
      value={value === "" ? (hasEmpty ? EMPTY : undefined) : value}
      onValueChange={(v) => onChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger {...aria} className={triggerClass(className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-80">
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY} value={o.value || EMPTY} disabled={o.disabled} className="min-h-10">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Business dates are "YYYY-MM-DD" strings; the calendar works in local Dates.
// Converting through year/month/day keeps the picked day exact in any time zone.
const toDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
};
const fromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A date button that opens a calendar (shadcn Popover + Calendar). */
export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Choose a date",
  clearable,
  className,
  disabled,
  ...aria
}: Aria & {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;
  const disabledDays = [...(min ? [{ before: toDate(min) }] : []), ...(max ? [{ after: toDate(max) }] : [])];
  return (
    <div className={cn("relative flex min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} {...aria} className={triggerClass(cn("tabular-nums", clearable && value && "pr-10"))}>
            <span className={value ? "" : "text-muted"}>{value ? formatDate(value) : placeholder}</span>
            <CalendarDaysIcon className="size-4 shrink-0 text-amber" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? (min ? toDate(min) : undefined)}
            disabled={disabledDays}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 2, 0)}
            endMonth={new Date(new Date().getFullYear() + 3, 11)}
            weekStartsOn={1}
            onSelect={(d) => {
              if (!d) return;
              onChange(fromDate(d));
              setOpen(false);
            }}
            autoFocus
            className="[--cell-size:--spacing(10)]"
          />
        </PopoverContent>
      </Popover>
      {clearable && value ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-stone hover:text-ink"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Times of day every 30 minutes ("HH:mm"). An off-grid saved time stays selectable. */
export function TimeField({
  value,
  onChange,
  allowEmpty,
  emptyLabel = "Not set",
  ...rest
}: Aria & { value: string; onChange: (v: string) => void; allowEmpty?: boolean; emptyLabel?: string; className?: string }) {
  const slots = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  if (value && !slots.includes(value)) slots.push(value);
  slots.sort();
  const options: Option[] = [
    ...(allowEmpty ? [{ value: "", label: emptyLabel }] : []),
    ...slots.map((t) => ({ value: t, label: `${formatTime(t)} (${t})` })),
  ];
  return <Choice value={value} onChange={onChange} options={options} placeholder="Choose a time" {...rest} />;
}

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** A month ("YYYY-MM") from the last three years, newest first. */
export function MonthField({ value, onChange, today, ...rest }: Aria & { value: string; onChange: (v: string) => void; today: string; className?: string }) {
  const months: Option[] = [{ value: "", label: "Not given" }];
  let d = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < 36; i++) {
    months.push({ value: d.slice(0, 7), label: monthFmt.format(Date.parse(`${d}T00:00:00Z`)) });
    d = `${addDays(d, -1).slice(0, 7)}-01`;
  }
  if (value && !months.some((m) => m.value === value)) months.push({ value, label: value });
  return <Choice value={value} onChange={onChange} options={months} {...rest} />;
}
