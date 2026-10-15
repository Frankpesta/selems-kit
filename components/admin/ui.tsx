"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";
import type { Tone } from "./lib";

// Admin building blocks (docs/02 "Admin look"): white panels on a stone canvas,
// status pills with a dot, 44px controls.

const TONES: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-info-bg text-info",
  mute: "bg-[#ECEEEF] text-[#4A5964]",
};

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap before:size-1.5 before:rounded-full before:bg-current",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 md:px-8 md:py-5">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold">{title}</h1>
        {subtitle ? <p className="m-0 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function Pane({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-6 px-4 py-5 md:px-8 md:py-7", className)}>{children}</div>;
}

export function Panel({
  title,
  aside,
  children,
  className,
  bodyClassName,
  as: As = "section",
  ...rest
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "aside" | "div";
} & Omit<ComponentProps<"section">, "title" | "ref">) {
  return (
    <As className={cn("min-w-0 rounded-lg border border-line bg-white", className)} {...rest}>
      {title || aside ? (
        <div className="flex items-center justify-between gap-3 border-b border-[#E6EAEA] px-5 py-4">
          {typeof title === "string" ? <h2 className="text-base font-semibold">{title}</h2> : title}
          {aside}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </As>
  );
}

export function Kpi({ label, value, note, noteTone }: { label: string; value: ReactNode; note?: ReactNode; noteTone?: Tone }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-white px-5 py-4">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[30px] leading-tight font-semibold tabular-nums">{value}</span>
      {note ? <span className={cn("text-sm", noteTone === "ok" ? "text-ok" : noteTone === "bad" ? "text-bad" : "text-muted")}>{note}</span> : null}
    </div>
  );
}

type BtnVariant = "default" | "primary" | "dark" | "danger" | "ghost";
const BTN: Record<BtnVariant, string> = {
  default: "border-line-strong bg-white text-ink hover:bg-[#F7F8F7]",
  primary: "border-amber bg-amber text-white hover:bg-amber-dark hover:border-amber-dark",
  dark: "border-ink bg-ink text-white hover:bg-ink-2",
  danger: "border-line-strong bg-white text-bad hover:bg-bad-bg",
  ghost: "border-transparent bg-transparent text-ink hover:bg-black/5",
};

export const btnClass = (variant: BtnVariant = "default", className?: string) =>
  cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3.5 text-sm font-semibold whitespace-nowrap no-underline transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    BTN[variant],
    className,
  );

export const Btn = forwardRef<HTMLButtonElement, ComponentProps<"button"> & { variant?: BtnVariant }>(function Btn(
  { variant = "default", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={btnClass(variant, className)} {...props} />;
});

export const inputClass =
  "min-h-11 w-full min-w-0 rounded-md border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-muted/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber aria-invalid:border-bad disabled:bg-mist";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputClass, "min-h-24 py-2.5 leading-relaxed", className)} {...p} />;
});

/**
 * A labelled control. Pass a render function to get the generated id and the
 * aria props (described-by for hint/error, invalid flag).
 */
export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: (p: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-body">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="m-0 text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="m-0 text-[12.5px] font-medium text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...p }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 text-sm", className)}>
      <input type="checkbox" className="size-4 accent-amber" {...p} />
      <span>{label}</span>
    </label>
  );
}

/** On/off switch for "shown on website" style toggles. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50"
    >
      <span className={cn("relative h-6 w-10 rounded-full transition-colors", checked ? "bg-ok" : "bg-line-strong")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none", checked && "translate-x-4")} />
      </span>
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="m-0 px-5 py-10 text-center text-sm text-muted" role="status">
      {label}
    </p>
  );
}

/** Two-column label/value list. */
export function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="m-0 min-w-0 break-words">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

export const thClass = "px-4 py-3 text-left text-xs font-semibold tracking-[0.06em] whitespace-nowrap text-muted uppercase";
export const tdClass = "px-4 py-3.5 align-middle";
