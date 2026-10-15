"use client";

import { useCallback, useRef, useState, type ComponentType, type ComponentProps } from "react";
import { CalendarDaysIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  type StayControl,
} from "./stay-shared";
import type { StayPicker as StayPickerType } from "./StayPicker";

// Content pages render a look-alike of StayPicker and load the real shadcn
// Popover/Calendar/Select (~45 KB) only when a visitor reaches for it: on
// hover/focus it preloads, on click it swaps in and opens the control clicked.

type Props = ComponentProps<typeof StayPickerType>;
let loaded: ComponentType<Props> | null = null;
const load = () =>
  import("./StayPicker").then((m) => {
    loaded = m.StayPicker;
    return m.StayPicker;
  });

export function LazyStayPicker(props: Props) {
  const [Real, setReal] = useState<ComponentType<Props> | null>(() => loaded);
  const [autoOpen, setAutoOpen] = useState<StayControl | undefined>();
  const preloaded = useRef(false);

  const preload = useCallback(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    void load();
  }, []);

  const activate = (control: StayControl) => {
    setAutoOpen(control);
    void load().then((C) => setReal(() => C));
  };

  if (Real) return <Real {...props} autoOpen={autoOpen} />;

  const { value, idPrefix = "stay", layout = "bar" } = props;
  const nights = stayNights(value);
  const trigger = (control: StayControl) => ({
    type: "button" as const,
    onClick: () => activate(control),
    onPointerEnter: preload,
    onFocus: preload,
    onTouchStart: preload,
    "aria-haspopup": control === "dates" ? ("dialog" as const) : ("listbox" as const),
  });

  return (
    <div className={cn("grid gap-4", gridClass(layout))}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", datesSpan(layout))}>
        <span id={`${idPrefix}-dates-label`} className={fieldLabel}>
          Check-in → check-out
        </span>
        <button
          {...trigger("dates")}
          aria-labelledby={`${idPrefix}-dates-label ${idPrefix}-dates-value`}
          className={cn(fieldControl, "flex items-center justify-between gap-3")}
        >
          <span id={`${idPrefix}-dates-value`} className={cn("truncate", !value.checkIn && "text-muted-foreground")}>
            {datesLabel(value)}
          </span>
          <span className="flex flex-none items-center gap-2 text-sm text-muted-foreground">
            {nights > 0 ? plural(nights, "night") : null}
            <CalendarDaysIcon className="size-5 text-amber" strokeWidth={1.6} aria-hidden="true" />
          </span>
        </button>
      </div>
      {(
        [
          ["adults", "Adults", adultsLabel(value.adults)],
          ["children", "Children", childrenLabel(value.children)],
        ] as const
      ).map(([control, label, text]) => (
        <div key={control} className="flex min-w-0 flex-col gap-1.5">
          <span id={`${idPrefix}-${control}-label`} className={fieldLabel}>
            {label}
          </span>
          <button
            {...trigger(control)}
            aria-labelledby={`${idPrefix}-${control}-label ${idPrefix}-${control}-value`}
            className={cn(fieldControl, "flex h-12 items-center justify-between gap-1.5")}
          >
            <span id={`${idPrefix}-${control}-value`}>{text}</span>
            <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
