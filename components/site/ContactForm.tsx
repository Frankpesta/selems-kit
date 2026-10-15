"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, m } from "framer-motion";
import { CheckIcon, CircleAlertIcon, LoaderIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convexAction, preloadConvex } from "@/lib/convex-http";
import { EASE_OUT } from "@/components/motion/tokens";
import { isValidEmail, normalisePhone } from "@/convex/lib/validators";
import { toAppError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { fieldControl, fieldLabel } from "./stay-shared";

const SUBJECTS = [
  ["reservation", "Reservation enquiry"],
  ["group", "Group or event booking"],
  ["request", "Request"],
  ["suggestion", "Suggestion"],
  ["testimony", "Testimony"],
  ["complaint", "Complaint"],
] as const;
type Subject = (typeof SUBJECTS)[number][0];
type Fields = { name: string; phone: string; email: string; subject: Subject; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const MAX_MESSAGE = 2000;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Enter your name.";
  if (!isValidEmail(f.email)) e.email = "Enter a valid email address, like name@example.com.";
  const phone = f.phone.trim();
  if (phone && phone !== "+234" && !normalisePhone(phone)) e.phone = "Enter a valid phone number, or leave it blank.";
  if (f.message.trim().length < 2) e.message = "Write a short message.";
  if (f.message.length > MAX_MESSAGE) e.message = `Keep your message under ${MAX_MESSAGE} characters.`;
  return e;
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>({ name: "", phone: "+234 ", email: "", subject: "reservation", message: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Preselect the subject from ?subject= (e.g. /contact?subject=group).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("subject");
    if (SUBJECTS.some(([v]) => v === s)) setFields((f) => ({ ...f, subject: s as Subject }));
  }, []);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    const next = { ...fields, [k]: v };
    setFields(next);
    if (errors[k]) setErrors(validate(next));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(fields);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`cf-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await convexAction(api.public.inquiries.submit, {
        name: fields.name,
        email: fields.email,
        phone: fields.phone.trim() === "+234" ? undefined : fields.phone,
        subject: fields.subject,
        message: fields.message,
      });
      setSent(true);
    } catch (err) {
      const a = toAppError(err);
      if (a.field && a.field in fields) setErrors({ [a.field]: a.message });
      else setNotice(a.message);
    } finally {
      setBusy(false);
    }
  }

  const input = (k: "name" | "phone" | "email", label: string, type: string, autoComplete: string) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`cf-${k}`} className={fieldLabel}>
        {label}
      </label>
      <input
        id={`cf-${k}`}
        type={type}
        autoComplete={autoComplete}
        value={fields[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `cf-${k}-err` : undefined}
        className={cn(fieldControl, errors[k] && "border-bad")}
      />
      {errors[k] ? (
        <p id={`cf-${k}-err`} className="m-0 text-sm text-bad">
          {errors[k]}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="border border-line bg-paper p-6 min-[760px]:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <m.div
            key="sent"
            role="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="flex flex-col gap-4"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-ok-bg text-ok">
              <CheckIcon className="size-6" aria-hidden="true" />
            </span>
            <h2 className="font-display m-0 text-[32px]">Thanks, {fields.name.split(" ")[0]}. Your message is with us.</h2>
            <p className="m-0 text-body">
              The front office will reply to {fields.email}. If it&rsquo;s urgent, call or WhatsApp us: someone is on
              duty around the clock.
            </p>
          </m.div>
        ) : (
          <m.form
            key="form"
            onSubmit={onSubmit}
            onFocus={preloadConvex}
            noValidate
            aria-labelledby="cf-title"
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-5"
          >
            <h2 id="cf-title" className="font-display m-0 text-[32px]">
              Send a message
            </h2>
            <div className="grid grid-cols-1 gap-5 min-[560px]:grid-cols-2">
              <div className="min-[560px]:col-span-2">{input("name", "Full name", "text", "name")}</div>
              {input("phone", "Phone (optional)", "tel", "tel")}
              {input("email", "Email", "email", "email")}
              <div className="flex min-w-0 flex-col gap-1.5 min-[560px]:col-span-2">
                <span id="cf-subject-label" className={fieldLabel}>
                  Subject
                </span>
                <Select value={fields.subject} onValueChange={(v) => set("subject", v as Subject)}>
                  <SelectTrigger aria-labelledby="cf-subject-label" className={cn(fieldControl, "h-12 w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="rounded-sm">
                    {SUBJECTS.map(([v, label]) => (
                      <SelectItem key={v} value={v} className="min-h-11">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 min-[560px]:col-span-2">
                <label htmlFor="cf-message" className={fieldLabel}>
                  Message
                </label>
                <textarea
                  id="cf-message"
                  rows={6}
                  value={fields.message}
                  onChange={(e) => set("message", e.target.value)}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby="cf-message-help"
                  className={cn(fieldControl, "py-3", errors.message && "border-bad")}
                />
                <p id="cf-message-help" className={cn("m-0 text-sm", errors.message ? "text-bad" : "text-xs text-muted-foreground")}>
                  {errors.message ?? (fields.subject === "group" ? "Tell us the dates, how many rooms and the occasion." : `${fields.message.length} / ${MAX_MESSAGE}`)}
                </p>
              </div>
            </div>
            {notice ? (
              <p role="alert" className="m-0 flex items-start gap-2 text-sm text-bad">
                <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" /> {notice}
              </p>
            ) : null}
            <div>
              <button type="submit" disabled={busy} className={buttonVariants({ variant: "amber", size: "cta" })}>
                {busy ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                {busy ? "Sending…" : "Send message"}
              </button>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              We use your details only to reply to you. See our <a href="/privacy">privacy notice</a>.
            </p>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  );
}
