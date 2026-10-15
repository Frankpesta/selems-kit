"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MAX_NAME, MAX_SPECIAL_REQUESTS, isValidEmail, normalisePhone } from "@/convex/lib/validators";
import { fieldControl, fieldLabel } from "@/components/site/stay-shared";
import type { GuestDetails } from "./types";

// Step 3: guest details. Validation mirrors convex/lib/validators.ts (the
// server re-checks everything); errors are announced and tied to their fields.

export type DetailErrors = Partial<Record<keyof GuestDetails, string>>;

export function validateDetails(d: GuestDetails): DetailErrors {
  const e: DetailErrors = {};
  const first = d.firstName.trim();
  const last = d.lastName.trim();
  if (!first) e.firstName = "Enter your first name.";
  else if (first.length > MAX_NAME) e.firstName = `Use up to ${MAX_NAME} characters.`;
  if (!last) e.lastName = "Enter your last name.";
  else if (last.length > MAX_NAME) e.lastName = `Use up to ${MAX_NAME} characters.`;
  if (!isValidEmail(d.email)) e.email = "Enter a valid email address, like name@example.com.";
  if (!normalisePhone(d.phone)) e.phone = "Enter a valid phone number, like 0803 123 4567.";
  if (d.specialRequests.trim().length > MAX_SPECIAL_REQUESTS) {
    e.specialRequests = `Keep requests under ${MAX_SPECIAL_REQUESTS} characters.`;
  }
  return e;
}

const ARRIVAL = ["Before 12 noon", "12 noon – 2 pm", "2 pm – 6 pm", "6 pm – 9 pm", "After 9 pm"];
const PURPOSE = [
  ["business", "Business"],
  ["leisure", "Leisure"],
  ["event", "Event or family occasion"],
  ["other", "Other"],
] as const;

export function DetailsForm({
  value,
  onChange,
  errors,
}: {
  value: GuestDetails;
  onChange: (next: GuestDetails) => void;
  errors: DetailErrors;
}) {
  const set = <K extends keyof GuestDetails>(k: K, v: GuestDetails[K]) => onChange({ ...value, [k]: v });

  const text = (
    k: "firstName" | "lastName" | "email" | "phone",
    label: string,
    opts: { type?: string; autoComplete: string; inputMode?: "email" | "tel"; hint?: string },
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`bd-${k}`} className={fieldLabel}>
        {label}
      </label>
      <input
        id={`bd-${k}`}
        name={k}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete}
        value={value[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `bd-${k}-err` : opts.hint ? `bd-${k}-hint` : undefined}
        className={cn(fieldControl, errors[k] && "border-bad")}
      />
      {opts.hint && !errors[k] ? (
        <p id={`bd-${k}-hint`} className="m-0 text-xs text-muted-foreground">
          {opts.hint}
        </p>
      ) : null}
      {errors[k] ? (
        <p id={`bd-${k}-err`} className="m-0 text-sm text-bad">
          {errors[k]}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-5 border border-line bg-paper p-6 min-[560px]:grid-cols-2">
      {text("firstName", "First name", { autoComplete: "given-name" })}
      {text("lastName", "Last name", { autoComplete: "family-name" })}
      {text("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", hint: "Your confirmation goes here." })}
      {text("phone", "Phone (WhatsApp if you have it)", { type: "tel", inputMode: "tel", autoComplete: "tel", hint: "Nigerian numbers can start with 0." })}

      <div className="flex min-w-0 flex-col gap-1.5">
        <span id="bd-arrival-label" className={fieldLabel}>
          Expected arrival time
        </span>
        <Select value={value.arrivalWindow || undefined} onValueChange={(v) => set("arrivalWindow", v)}>
          <SelectTrigger aria-labelledby="bd-arrival-label" className={cn(fieldControl, "h-12 w-full")}>
            <SelectValue placeholder="Choose a time (optional)" />
          </SelectTrigger>
          <SelectContent position="popper" className="rounded-sm">
            {ARRIVAL.map((a) => (
              <SelectItem key={a} value={a} className="min-h-11">
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span id="bd-purpose-label" className={fieldLabel}>
          Purpose of stay
        </span>
        <Select value={value.purpose || undefined} onValueChange={(v) => set("purpose", v as GuestDetails["purpose"])}>
          <SelectTrigger aria-labelledby="bd-purpose-label" className={cn(fieldControl, "h-12 w-full")}>
            <SelectValue placeholder="Choose one (optional)" />
          </SelectTrigger>
          <SelectContent position="popper" className="rounded-sm">
            {PURPOSE.map(([v, label]) => (
              <SelectItem key={v} value={v} className="min-h-11">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 min-[560px]:col-span-2">
        <label htmlFor="bd-requests" className={fieldLabel}>
          Special requests (optional)
        </label>
        <textarea
          id="bd-requests"
          rows={4}
          maxLength={MAX_SPECIAL_REQUESTS + 50}
          value={value.specialRequests}
          onChange={(e) => set("specialRequests", e.target.value)}
          aria-invalid={errors.specialRequests ? true : undefined}
          aria-describedby="bd-requests-count"
          className={cn(fieldControl, "py-3", errors.specialRequests && "border-bad")}
        />
        <p id="bd-requests-count" className={cn("m-0 text-xs", errors.specialRequests ? "text-bad" : "text-muted-foreground")}>
          {errors.specialRequests ?? `${value.specialRequests.length} / ${MAX_SPECIAL_REQUESTS}`}
        </p>
      </div>
    </div>
  );
}
